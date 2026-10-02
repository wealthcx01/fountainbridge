/**
 * "Go to anything" — the studio's keyboard palette (FB-179).
 *
 * ⌘K on a Mac, Ctrl-K elsewhere, from any screen: type a few letters of a venture, a ticket or a
 * screen, press Enter, and you are there. This file decides what is in the list and how typing
 * narrows it. It is pure, so both can be tested without a browser.
 *
 * ## It only ever goes somewhere
 *
 * The palette navigates. It never approves, refuses or sends anything. "Approve the thing that is
 * waiting" means *take me to it*: the decision is made on that item's own page, which is the one
 * place a grant is signed (FB-183). A second place to approve would be a second place to get it
 * wrong.
 *
 * ## Every address is the studio's own
 *
 * Each entry is a path inside the studio — the same addresses a notification, an email or a message
 * can carry (`/venture/arca/tickets?filter=all&t=arca/ARCA-61`). Nothing here links to the code host.
 */

export type PaletteGroup = 'Waiting on you' | 'Screens' | 'Tickets' | 'Ventures';

export interface PaletteItem {
  /** Unique within one list; used for the screen reader's "active option". */
  key: string;
  label: string;
  /** A second line in small type — the ticket id, the venture, the state. Searched too. */
  hint: string;
  /** Other words that should find it, never shown: "home" finds the desk. */
  words?: string;
  href: string;
  group: PaletteGroup;
}

export interface PaletteVenture {
  id: string;
  name: string;
}

/** A piece of finished work waiting on the founder — an open pull request. */
export interface PaletteWork {
  repo: string;
  number: number;
  title: string;
  /** The ticket it was matched to, when there is one. */
  ticketId: string | null;
}

/** A send waiting on the founder. */
export interface PaletteSend {
  repo: string;
  id: string;
  summary: string;
}

export interface PaletteTicket {
  repo: string;
  id: string;
  title: string;
}

const v = (id: string) => `/venture/${encodeURIComponent(id)}`;

/**
 * The address of one ticket on the Tickets screen.
 *
 * `filter=all` so the ticket is in the list beside it whatever its state — the screen resolves `t`
 * against every ticket, but a "Needs you" list without the selected ticket in it reads as a mistake.
 * Keyed `repo/id`, as the screen keys rows: two repositories in one venture may share an id.
 */
export const ticketHref = (ventureId: string, t: { repo: string; id: string }): string =>
  `${v(ventureId)}/tickets?filter=all&t=${encodeURIComponent(`${t.repo}/${t.id}`)}`;

/** Where a piece of waiting work is decided: its ticket when it has one, its own page when not. */
export const workHref = (ventureId: string, w: PaletteWork): string =>
  w.ticketId
    ? ticketHref(ventureId, { repo: w.repo, id: w.ticketId })
    : `${v(ventureId)}/work/${encodeURIComponent(w.repo)}/${w.number}`;

/** A send's own page — the only place it is approved or refused (FB-183). */
export const sendHref = (ventureId: string, s: Pick<PaletteSend, 'repo' | 'id'>): string =>
  `${v(ventureId)}/approvals/${encodeURIComponent(s.repo)}/${encodeURIComponent(s.id)}`;

/** The screens of one venture, in the rail's order. */
const SCREENS: Array<{ slug: string; label: string; words: string }> = [
  { slug: '', label: 'The desk', words: 'home desk' },
  { slug: '/tickets?filter=needs', label: 'Needs you', words: 'waiting decide approve' },
  { slug: '/tickets', label: 'Tickets', words: 'work board' },
  { slug: '/composer', label: 'Composer', words: 'new ticket write ask file talk' },
  { slug: '/activity', label: 'What happened', words: 'activity history log' },
  { slug: '/knowledge', label: 'Memory', words: 'documents knowledge files' },
  { slug: '/handbook', label: 'Handbook', words: 'guide help playbook' },
];

/**
 * Everything the palette can go to, for a founder standing in one venture.
 *
 * Waiting items first — the palette is most often opened by someone who knows there is something to
 * decide. Then the venture's screens, then its tickets, then the other ventures this person can see.
 * `current` is null outside a venture (the ledger, an admin page): then only ventures are listed.
 */
export function paletteItems(input: {
  ventures: readonly PaletteVenture[];
  current: {
    venture: PaletteVenture;
    work: readonly PaletteWork[];
    sends: readonly PaletteSend[];
    tickets: readonly PaletteTicket[];
  } | null;
}): PaletteItem[] {
  const out: PaletteItem[] = [];
  const c = input.current;
  if (c) {
    for (const s of c.sends) {
      out.push({ key: `send:${s.repo}/${s.id}`, label: s.summary, hint: `${c.venture.name} · a send waiting for your yes`, href: sendHref(c.venture.id, s), group: 'Waiting on you' });
    }
    for (const w of c.work) {
      out.push({
        key: `work:${w.repo}#${w.number}`,
        label: w.title,
        hint: `${w.ticketId ?? `${w.repo} #${w.number}`} · finished, waiting for you`,
        href: workHref(c.venture.id, w),
        group: 'Waiting on you',
      });
    }
    for (const s of SCREENS) {
      out.push({ key: `screen:${s.slug}`, label: s.label, hint: c.venture.name, words: s.words, href: `${v(c.venture.id)}${s.slug}`, group: 'Screens' });
    }
    for (const t of c.tickets) {
      out.push({ key: `ticket:${t.repo}/${t.id}`, label: t.title, hint: t.id, href: ticketHref(c.venture.id, t), group: 'Tickets' });
    }
  }
  for (const venture of input.ventures) {
    if (c && venture.id === c.venture.id) continue;
    out.push({ key: `venture:${venture.id}`, label: venture.name, hint: 'Its desk', words: 'venture home', href: v(venture.id), group: 'Ventures' });
    out.push({ key: `composer:${venture.id}`, label: `Composer — ${venture.name}`, hint: 'Write to its team', words: 'new ticket ask file talk', href: `${v(venture.id)}/composer`, group: 'Ventures' });
  }
  return out;
}

/** The most the list shows at once. A palette is for jumping, not browsing: type to narrow. */
export const PALETTE_LIMIT = 30;

/**
 * Narrow the list to what was typed.
 *
 * Every word typed must appear in the label or the hint, in any order, ignoring case — so "arca 61"
 * finds ARCA-61 and "needs" finds Needs you. Matches that START a word in the label come first, then
 * the rest, each in the list's own order, so waiting items stay above tickets when both match.
 * Nothing typed shows the list as it is, capped.
 */
export function matchPalette(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.slice(0, PALETTE_LIMIT);
  const strong: PaletteItem[] = [];
  const weak: PaletteItem[] = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    const hay = `${label} ${item.hint.toLowerCase()} ${(item.words ?? '').toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const startsWord = (w: string) => label.startsWith(w) || label.includes(` ${w}`) || label.includes(`-${w}`);
    (words.every(startsWord) ? strong : weak).push(item);
  }
  return [...strong, ...weak].slice(0, PALETTE_LIMIT);
}

/** What a screen reader hears after each keystroke. */
export function paletteAnnouncement(shown: number, total: number, query: string): string {
  if (total === 0) return 'Nothing to go to yet.';
  if (shown === 0) return `Nothing matches “${query.trim()}”.`;
  if (!query.trim()) return `${shown} places. Type to narrow, arrows to choose, Enter to go.`;
  return shown === 1 ? 'One match. Enter to go.' : `${shown} matches. Arrows to choose, Enter to go.`;
}

/** True for ⌘K or Ctrl-K, and nothing else — not ⌘⇧K, not a K typed into a text box. */
export function isPaletteShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): boolean {
  return e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
}
