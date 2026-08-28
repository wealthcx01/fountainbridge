import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference, STATUS_GROUPS } from '@/lib/tickets';
import { loadFiledForLanes, defaultBranchFileReader, type FiledTicket } from '@/lib/filed-tickets';
import { ticketsByRepoFrom } from '@/lib/venture-tickets-index';
import { loadVentureAttention } from '@/lib/attention';
import { VentureForbidden } from '@/components/VentureForbidden';
import { TicketsView } from '@/components/TicketsView';
import { parseFilter, type TicketRow } from '@/lib/tickets-view';

/**
 * Tickets (FB-129) — the list, the ticket, and the decision, on one screen.
 *
 * A founder used to read a ticket in a drawer and decide about it on a different page, with nothing
 * on either saying the other existed. This is where both live.
 *
 * ## The selection is in the URL, deliberately
 *
 * Not component state. "Discuss in the composer →" leaves this screen and the founder comes back;
 * dependency chips link ticket to ticket; "Next decision →" is a navigation. All three break if a
 * ticket cannot be addressed — and it is also what makes a ticket linkable at all, from the desk's
 * queue, from a run report, from a message.
 */
export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; t?: string; refresh?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const { id } = await params;
  const { filter, t, refresh } = await searchParams;

  const ventures = loadVentures();
  const access = authorizeVentures(session.user.email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  // Denied BEFORE any data fetch, the same as the desk: an unauthorized session sees the refusal.
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const refreshing = refresh === '1';
  const data = await loadVentureTickets(venture, { refresh: refreshing });
  const attention = await loadVentureAttention(venture, {
    refresh: refreshing,
    tickets: ticketsByRepoFrom(data.lanes),
  });

  const inferred = data.lanes.map((lane) => applyStatusInference(lane, attention.ticketStatus));
  // FB-120: work filed minutes ago is not on the default branch yet, and a founder who just pressed
  // "File all" must find it here. Degrades to none rather than blanking a list that was fine.
  const filedByRepo = await loadFiledForLanes(inferred, attention.perRepo, defaultBranchFileReader())
    .catch(() => new Map<string, FiledTicket[]>());

  // What is actually waiting, keyed the same way the board keys it, so this screen and the desk
  // cannot disagree about which tickets need the founder.
  const waitingFor = new Map<string, { repo: string; number: number; ageMs: number }>();
  for (const pr of attention.approvals) {
    if (pr.linkedTicketId) waitingFor.set(`${pr.repo} ${pr.linkedTicketId}`, { repo: pr.repo, number: pr.number, ageMs: pr.ageMs });
  }
  const surfaceOf = new Map((venture.departments ?? []).map((d) => [d.repo, d.name]));

  const rows: TicketRow[] = [];
  for (const lane of inferred) {
    const filed = filedByRepo.get(lane.repo) ?? [];
    const groups = filed.length ? { ...lane.groups, filed } : lane.groups;
    for (const group of STATUS_GROUPS) {
      for (const item of groups[group] ?? []) {
        rows.push({
          id: item.ticket.id,
          title: item.ticket.title,
          repo: lane.repo,
          group,
          item,
          waiting: waitingFor.get(`${lane.repo} ${item.ticket.id}`) ?? null,
          surface: surfaceOf.get(lane.repo) ?? null,
        });
      }
    }
  }

  // Finished work tied to no ticket at all (FB-099's gap, and FB-129's version of it). It still
  // waits on the founder, so it is a row. Leaving it out is how the rail came to say "Needs you 4"
  // over a filter showing 2: the badge counted what was waiting, the screen counted what happened
  // to have a ticket file.
  const onBoard = new Set(rows.map((r) => `${r.repo} ${r.id}`));
  for (const pr of attention.approvals) {
    if (pr.linkedTicketId && onBoard.has(`${pr.repo} ${pr.linkedTicketId}`)) continue;
    rows.push({
      id: `${pr.repo}#${pr.number}`,
      title: pr.ticketTitle ?? pr.title,
      repo: pr.repo,
      group: 'pr-open',
      item: null,
      waiting: { repo: pr.repo, number: pr.number, ageMs: pr.ageMs },
      surface: surfaceOf.get(pr.repo) ?? null,
    });
  }

  const refs = new Map(inferred.map((lane) => [lane.repo, lane.ref]));

  return (
    <TicketsView
      ventureId={venture.id}
      ventureName={venture.name}
      rows={rows}
      filter={parseFilter(filter)}
      selectedId={typeof t === 'string' ? t : null}
      refs={Object.fromEntries(refs)}
      org={process.env.GITHUB_ORG ?? 'wealthcx01'}
      errors={[...data.lanes.filter((l) => l.error).map((l) => l.error as string), ...attention.errors]}
    />
  );
}
