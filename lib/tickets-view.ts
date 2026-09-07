/**
 * Tickets as one screen (FB-129).
 *
 * ## Why this exists
 *
 * A founder used to read a ticket in one place and decide about it in another — the drawer showed
 * the work, `/attention` held the lever, and nothing on either said the other existed. They had to
 * hold two screens in their head to say yes.
 *
 * This is the pure half of making them one: which tickets a filter contains, what the list says
 * about itself, and — the part that turns three navigations into one sitting — the order decisions
 * are taken in, so "Next decision →" has somewhere to point.
 *
 * Everything here is a pure function of rows the page already loaded. The screen is a view over the
 * board's own data, not a second read of it.
 */

import type { TicketProgress } from './ticket-progress';
import type { TicketStatusGroup, TicketWithMeta } from './tickets';

/** The work waiting on a ticket — a pull request carrying finished work, or an external action. */
export interface WaitingOn {
  repo: string;
  number: number;
  /** How long it has waited. Drives the decision order: oldest first, because it has waited longest. */
  ageMs: number;
  /**
   * Further pull requests open on the SAME ticket — a lane retried, or filed a revision.
   *
   * Counted rather than dropped. The row is one row, because it is one piece of work a founder
   * thinks about; the count is what keeps this screen's total equal to the rail's badge, which
   * counts pull requests. A `Map` that simply took the last one seen made the two disagree.
   */
  also?: number;
  /**
   * The commit the founder is being shown.
   *
   * Passed to `acceptWork`, which refuses when something has been pushed since the page rendered.
   * Without it a founder can approve from a list, having never opened the work, and merge a commit
   * that landed after they looked — which is precisely what that parameter exists to prevent.
   */
  headSha?: string | null;
}

export interface TicketRow {
  /** The ticket id — or `repo#number` for finished work that is tied to no ticket at all. */
  id: string;
  title: string;
  /** The repository this ticket lives in. Two repos in one venture may share an id namespace. */
  repo: string;
  /** The column the board would put it in — inferred status, never the markdown's own claim. */
  group: TicketStatusGroup;
  /**
   * What is actually happening to this ticket, from evidence only (FB-098, moved here by FB-178).
   *
   * This lived on the desk's board and the desk no longer has one. It is the founder's answer to
   * "is anything happening to the thing I asked for" — *picked up 3h ago*, *attempt 2*, *worked,
   * read it and decide* — and it was the half of FB-098 John asked for by name. Removing the board
   * without bringing it here would have deleted the feature and left the tests passing against a
   * screen nobody uses.
   *
   * Null when the studio has no evidence either way, which is different from "nothing is happening".
   */
  progress: TicketProgress | null;
  /**
   * The ticket file, or **null** when there is none.
   *
   * A row with no ticket is not a bug in this screen; it is a fact about the venture. Work sometimes
   * lands that nobody wrote a ticket for, and it still waits on the founder. Leaving it out is how
   * the rail came to say "Needs you 4" over a filter showing 2 — the badge counted what was waiting
   * and the screen counted what happened to have a ticket file.
   */
  item: TicketWithMeta | null;
  /** Non-null when something is waiting on the founder about this ticket. */
  waiting: WaitingOn | null;
  /** The surface it belongs to (Build / Sell / Scale), when the venture declares one. */
  surface: string | null;
}

/**
 * The row a URL is asking for, resolved ONCE.
 *
 * Server and client both need it — the server to load that ticket's history, the client to render
 * it — and they resolved it separately, with different fallbacks. So landing on `/tickets` with no
 * `?t=` (which is what the rail's own Tickets row does) rendered a full ticket with **no trail at
 * all**, and a legacy bare-id link could render one ticket's history under another's heading. On the
 * one surface whose claim is that nothing shown can disagree with what ran.
 *
 * Falls back to the first row of the current filter, which is what the screen shows anyway.
 */
export function resolveSelected(rows: TicketRow[], shown: TicketRow[], t: string | null): TicketRow | null {
  if (t) {
    const byKey = rows.find((r) => rowKey(r) === t);
    if (byKey) return byKey;
    // A link written before repositories were part of the key. Resolved against the whole list, not
    // the filtered one, so following an old link never silently lands on a different ticket.
    const byId = rows.find((r) => r.id === t);
    if (byId) return byId;
  }
  return shown[0] ?? null;
}

/**
 * How a row is addressed — by repository AND id.
 *
 * Two repositories in one venture may share an id namespace, so an id alone is not a name. Used for
 * the URL, the selection, the decided set and the decision order, so all four agree.
 */
export const rowKey = (r: Pick<TicketRow, 'repo' | 'id'>): string => `${r.repo}/${r.id}`;

export const TICKET_FILTERS = ['needs', 'all', 'underway', 'settled'] as const;
export type TicketFilter = (typeof TICKET_FILTERS)[number];

/**
 * What Tickets shows when nobody has chosen a filter (FB-185).
 *
 * **"Needs you", not "All"** — and this is a decision, not a default that nobody set.
 *
 * The design's Tickets is a filtered list: it opens on `Needs you (3)` and the other three tabs sit
 * beside it. Ours opened on `All`, which on ARCA's real backlog is 80 tickets, 37 of them finished.
 * That made this the least design-conformant screen in the studio — 7,123px against a design of
 * 1,090px — and FB-178 had just made it the screen a founder uses for the whole queue, because the
 * desk's board was removed on the grounds that Tickets is where the queue lives.
 *
 * A founder opening Tickets is asking "what needs me?". Answering with everything that ever
 * happened is not a smaller version of that answer; it is a different one.
 *
 * Nothing is hidden: the four tabs are unchanged and every finished ticket is one press away under
 * "Done and stopped". The counts beside each tab are of the whole backlog either way, so the screen
 * still says how much there is.
 */
export const DEFAULT_FILTER: TicketFilter = 'needs';

/**
 * The URL's filter, or the default. Never throws: a bookmark with a typo gets the default rather
 * than an error, which is the same thing a founder arriving with no filter at all gets.
 */
export function parseFilter(raw: unknown): TicketFilter {
  return TICKET_FILTERS.includes(raw as TicketFilter) ? (raw as TicketFilter) : DEFAULT_FILTER;
}

/** What a founder calls each filter. One owner for these words. */
export const FILTER_LABEL: Record<TicketFilter, string> = {
  needs: 'Needs you',
  all: 'All',
  underway: 'Underway',
  settled: 'Done and stopped',
};

/**
 * Waiting on the founder.
 *
 * Defined by whether something is ACTUALLY waiting — a pull request they have not read — rather than
 * by the column the ticket sits in. The two agree today and the reason to prefer the first is that
 * only it stays true: a ticket can be moved between columns by anything, and a decision is waiting
 * or it is not.
 */
export const needsFounder = (r: TicketRow): boolean => r.waiting !== null;

/**
 * Work in flight: started, not finished, and not waiting on anyone.
 *
 * Defined as "not waiting and not settled" rather than by listing the columns, because listing them
 * left a hole: a ticket whose markdown says "In review" is grouped `pr-open`, and if its pull
 * request has been merged, closed, or simply could not be read (a rate-limited repository returns no
 * pull requests at all), it waits on nobody and is not done. Under a list of columns it appeared in
 * no filter but "All", and `needs + underway + settled` quietly stopped adding up to the total.
 */
export const isUnderway = (r: TicketRow): boolean => !needsFounder(r) && r.group !== 'done';

/** Finished, one way or another. */
export const isSettled = (r: TicketRow): boolean => !needsFounder(r) && r.group === 'done';

export function filterTickets(rows: TicketRow[], filter: TicketFilter): TicketRow[] {
  switch (filter) {
    case 'needs': return rows.filter(needsFounder);
    case 'underway': return rows.filter(isUnderway);
    case 'settled': return rows.filter(isSettled);
    case 'all': return rows;
  }
}

export interface TicketCounts {
  total: number;
  needs: number;
  underway: number;
  settled: number;
}

export const countTickets = (rows: TicketRow[]): TicketCounts => ({
  total: rows.length,
  // Waiting ITEMS, not waiting rows — the rail's badge counts pull requests, and a ticket carrying
  // two of them is two decisions under one heading.
  needs: rows.reduce((n, r) => n + (r.waiting ? 1 + (r.waiting.also ?? 0) : 0), 0),
  underway: rows.filter(isUnderway).length,
  settled: rows.filter(isSettled).length,
});

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * What the list says about itself.
 *
 * Clauses only for what is true, the same rule the desk's summary follows — a founder on day one
 * should read one short sentence rather than three zeroes dressed as a report.
 *
 * The closing claim is deliberate and load-bearing: **every one can be followed to where it changed
 * things.** That is the promise the trail keeps (FB-130), and stating it here is what makes the
 * trail's absence a bug rather than a missing nicety.
 */
export function ticketsSummary(c: TicketCounts): string {
  if (c.total === 0) return 'No tickets yet. The first one your team files lands here.';

  const parts: string[] = [];
  if (c.needs > 0) parts.push(`${c.needs} waiting on you`);
  if (c.underway > 0) parts.push(`${c.underway} moving`);
  if (c.settled > 0) parts.push(`${c.settled} settled`);

  const breakdown = parts.length
    ? `: ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}`
    : '';
  return `${plural(c.total, 'ticket')}${breakdown}. Every one can be followed to where it changed things.`;
}

/**
 * The order decisions are taken in: oldest first.
 *
 * Oldest rather than newest, because the oldest has waited longest and is the one a founder is most
 * behind on — it is the same ordering the desk's blocker banner counts from, so "the oldest has
 * waited 44 days" and the first decision on this screen are the same piece of work.
 *
 * Ties broken by id so the sequence is stable: a founder deciding three in a row must not have the
 * queue reshuffle underneath them because two arrived in the same second.
 */
export function decisionOrder(rows: TicketRow[]): TicketRow[] {
  return rows
    .filter(needsFounder)
    .slice()
    .sort((a, b) => (b.waiting?.ageMs ?? 0) - (a.waiting?.ageMs ?? 0) || rowKey(a).localeCompare(rowKey(b)));
}

/** "decision 2 of 5", or null when this ticket is not one. */
export function decisionPosition(order: TicketRow[], key: string): { n: number; of: number } | null {
  const i = order.findIndex((r) => rowKey(r) === key);
  return i === -1 ? null : { n: i + 1, of: order.length };
}

/**
 * The next one to decide after this one — the oldest that is not the one just decided.
 *
 * `decided` is passed rather than inferred from the rows, because at the moment this is asked the
 * page has not reloaded: the founder has just approved something and the server does not yet know.
 * Reading the stale rows would offer them the ticket they have already answered.
 */
export function nextDecision(order: TicketRow[], decided: ReadonlySet<string>): TicketRow | null {
  return order.find((r) => !decided.has(rowKey(r))) ?? null;
}
