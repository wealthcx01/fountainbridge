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

import type { TicketStatusGroup, TicketWithMeta } from './tickets';

/** The work waiting on a ticket — a pull request carrying finished work, or an external action. */
export interface WaitingOn {
  repo: string;
  number: number;
  /** How long it has waited. Drives the decision order: oldest first, because it has waited longest. */
  ageMs: number;
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

export const TICKET_FILTERS = ['needs', 'all', 'underway', 'settled'] as const;
export type TicketFilter = (typeof TICKET_FILTERS)[number];

/** The URL's filter, or the default. Never throws: a bookmark with a typo shows the whole list. */
export function parseFilter(raw: unknown): TicketFilter {
  return TICKET_FILTERS.includes(raw as TicketFilter) ? (raw as TicketFilter) : 'all';
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

/** Work in flight: started, not finished, and not waiting on anyone. */
export const isUnderway = (r: TicketRow): boolean =>
  !needsFounder(r) && (r.group === 'in-progress' || r.group === 'todo' || r.group === 'filed');

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
  needs: rows.filter(needsFounder).length,
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
    .sort((a, b) => (b.waiting?.ageMs ?? 0) - (a.waiting?.ageMs ?? 0) || a.id.localeCompare(b.id));
}

/** "decision 2 of 5", or null when this ticket is not one. */
export function decisionPosition(order: TicketRow[], id: string): { n: number; of: number } | null {
  const i = order.findIndex((r) => r.id === id);
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
  return order.find((r) => !decided.has(r.id)) ?? null;
}
