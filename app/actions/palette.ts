'use server';

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets } from '@/lib/tickets';
import { loadVentureAttention } from '@/lib/attention';
import { ticketsByRepoFrom } from '@/lib/venture-tickets-index';
import { ventureApprovals } from '@/lib/venture-reads';
import { sendsWaitingOnFounder } from '@/lib/needs-you';
import { paletteItems, type PaletteItem, type PaletteSend, type PaletteTicket, type PaletteWork } from '@/lib/palette';

/**
 * What "Go to anything" can reach, for the person signed in (FB-179).
 *
 * A server action is a public endpoint (FB-127), so the venture named by the browser is checked
 * against the session here, on the server, before anything is read. Someone who names another
 * founder's venture gets the ventures they can see and nothing from that one — the same refusal as
 * every other door (CLAUDE.md #6).
 *
 * Reads only what the screens already read, through the same caches: the ticket list and the queue
 * are both held for two minutes, so opening the palette on a screen that has just loaded costs no
 * extra round trip to the code host.
 *
 * Every read degrades on its own and says so (CLAUDE.md #10): if the tickets could not be read, the
 * palette still reaches every screen and every venture, and tells the founder in words that the
 * tickets are missing rather than showing a shorter list as though it were the whole one.
 */
export interface PaletteData {
  items: PaletteItem[];
  /** Sentences about what could not be read. Empty when everything was. */
  missing: string[];
}

export async function loadPalette(currentVentureId: string | null): Promise<PaletteData> {
  const email = (await auth())?.user?.email;
  if (!email) return { items: [], missing: ['You need to sign in.'] };

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const mine = ventures.filter((v) => canAccessVenture(access, v.id)).map((v) => ({ id: v.id, name: v.name }));
  const venture = currentVentureId && canAccessVenture(access, currentVentureId)
    ? ventures.find((v) => v.id === currentVentureId) ?? null
    : null;
  if (!venture) return { items: paletteItems({ ventures: mine, current: null }), missing: [] };

  const missing: string[] = [];
  const [ticketData, approvals] = await Promise.all([
    loadVentureTickets(venture).catch(() => null),
    ventureApprovals(venture).catch(() => null),
  ]);
  const attention = await loadVentureAttention(venture, ticketData ? { tickets: ticketsByRepoFrom(ticketData.lanes) } : {})
    .catch(() => null);

  const tickets: PaletteTicket[] = [];
  if (ticketData) {
    for (const lane of ticketData.lanes) {
      for (const group of Object.values(lane.groups)) {
        for (const { ticket } of group) tickets.push({ repo: lane.repo, id: ticket.id, title: ticket.title });
      }
    }
    if (ticketData.lanes.some((l) => l.error)) missing.push('Some of your tickets could not be read just now, so not all of them are listed.');
  } else {
    missing.push('Your tickets could not be read just now, so none are listed. Every screen is still here.');
  }

  // A piece of work goes to its ticket only when that ticket is really on the board. A branch named
  // `ARCA-061-...` for a ticket filed as `ARCA-61` is not matched, and an address naming `ARCA-061`
  // would open the Tickets screen on whatever ticket happened to be first. Its own page is exact.
  const onBoard = new Set(tickets.map((t) => `${t.repo}/${t.id}`));
  const work: PaletteWork[] = attention
    ? attention.approvals.map((a) => ({
      repo: a.repo,
      number: a.number,
      title: a.ticketTitle ?? a.title,
      ticketId: a.linkedTicketId && onBoard.has(`${a.repo}/${a.linkedTicketId}`) ? a.linkedTicketId : null,
    }))
    : [];
  if (!attention || attention.errors.length > 0) missing.push('Some finished work waiting on you could not be read just now.');

  const sends: PaletteSend[] = approvals
    ? sendsWaitingOnFounder(approvals).map((a) => ({ repo: a.repo, id: a.id, summary: a.summary }))
    : [];
  if (!approvals) missing.push('Sends waiting on you could not be read just now.');

  return {
    items: paletteItems({ ventures: mine, current: { venture: { id: venture.id, name: venture.name }, work, sends, tickets } }),
    missing,
  };
}
