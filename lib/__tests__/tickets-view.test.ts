import { describe, it, expect } from 'vitest';
import {
  FILTER_LABEL, countTickets, decisionOrder, decisionPosition, filterTickets, nextDecision,
  parseFilter, ticketsSummary, type TicketRow,
} from '../tickets-view';
import type { TicketStatusGroup } from '../tickets';

/**
 * Tickets as one screen (FB-129).
 *
 * The load-bearing property is the decision ORDER: a founder clearing three in a row must get the
 * oldest each time, must not be offered one they have just answered, and must not have the sequence
 * reshuffle underneath them.
 */

let n = 0;
const row = (over: Partial<TicketRow> & { group?: TicketStatusGroup } = {}): TicketRow => {
  const id = over.id ?? `ARCA-${String(++n).padStart(3, '0')}`;
  return {
    id,
    title: over.title ?? `Ticket ${id}`,
    repo: over.repo ?? 'arca',
    group: over.group ?? 'todo',
    surface: over.surface ?? 'Build',
    waiting: over.waiting ?? null,
    item: over.item === null ? null : ({ ticket: { id, title: `Ticket ${id}` }, warnings: [] } as unknown as TicketRow['item']),
  };
};
const waiting = (ageMs: number) => ({ repo: 'arca', number: 1, ageMs });

describe('which tickets a filter contains', () => {
  const rows = [
    row({ id: 'A', group: 'pr-open', waiting: waiting(3_000) }),
    row({ id: 'B', group: 'in-progress' }),
    row({ id: 'C', group: 'todo' }),
    row({ id: 'D', group: 'done' }),
    row({ id: 'E', group: 'filed' }),
  ];

  it('“Needs you” is what is actually waiting, not what column it sits in', () => {
    // A ticket can be moved between columns by anything. A decision is waiting or it is not.
    expect(filterTickets(rows, 'needs').map((r) => r.id)).toEqual(['A']);
  });

  it('“Underway” is work in flight and nothing waiting on the founder', () => {
    expect(filterTickets(rows, 'underway').map((r) => r.id)).toEqual(['B', 'C', 'E']);
  });

  it('“Done and stopped” is what is finished', () => {
    expect(filterTickets(rows, 'settled').map((r) => r.id)).toEqual(['D']);
  });

  it('“All” hides nothing', () => {
    expect(filterTickets(rows, 'all')).toHaveLength(5);
  });

  it('a ticket waiting on the founder is never also counted as underway', () => {
    // Otherwise the filters add up to more than the list, and a founder counts the same work twice.
    const c = countTickets(rows);
    expect(c.needs + c.underway + c.settled).toBe(c.total);
  });

  it('counts work that has no ticket file, because it still waits on the founder', () => {
    // The rail said "Needs you 4" over a filter showing 2: the badge counted what was waiting and
    // the screen counted what happened to have a ticket. Finished work nobody wrote a ticket for is
    // a fact about the venture, not a row to leave out.
    const withOrphan = [...rows, row({ id: 'arca#12', item: null, group: 'pr-open', waiting: waiting(1) })];
    expect(filterTickets(withOrphan, 'needs').map((r) => r.id)).toEqual(['A', 'arca#12']);
    expect(countTickets(withOrphan).needs).toBe(2);
  });

  it('reads a filter out of a URL, and shrugs at a typo', () => {
    expect(parseFilter('needs')).toBe('needs');
    expect(parseFilter('settled')).toBe('settled');
    expect(parseFilter('nonsense')).toBe('all');
    expect(parseFilter(undefined)).toBe('all');
    expect(FILTER_LABEL.needs).toBe('Needs you');
  });
});

describe('what the list says about itself', () => {
  it('reads as the design writes it', () => {
    const rows = [
      ...[1, 2, 3].map(() => row({ group: 'pr-open', waiting: waiting(1) })),
      ...[1, 2].map(() => row({ group: 'in-progress' })),
      ...[1, 2, 3, 4].map(() => row({ group: 'done' })),
    ];
    expect(ticketsSummary(countTickets(rows))).toBe(
      '9 tickets: 3 waiting on you, 2 moving and 4 settled. Every one can be followed to where it changed things.',
    );
  });

  it('drops the clauses that are not true rather than reporting zeroes', () => {
    expect(ticketsSummary(countTickets([row({ group: 'done' })])))
      .toBe('1 ticket: 1 settled. Every one can be followed to where it changed things.');
  });

  it('says something useful when there is nothing at all', () => {
    expect(ticketsSummary(countTickets([]))).toBe('No tickets yet. The first one your team files lands here.');
  });
});

describe('clearing three decisions in one sitting', () => {
  const rows = [
    row({ id: 'NEW', group: 'pr-open', waiting: waiting(1_000) }),
    row({ id: 'OLD', group: 'pr-open', waiting: waiting(9_000) }),
    row({ id: 'MID', group: 'pr-open', waiting: waiting(5_000) }),
    row({ id: 'QUIET', group: 'todo' }),
  ];

  it('takes the oldest first, because it has waited longest', () => {
    // The same ordering the desk's banner counts from, so "the oldest has waited 44 days" and the
    // first decision here are the same piece of work.
    expect(decisionOrder(rows).map((r) => r.id)).toEqual(['OLD', 'MID', 'NEW']);
  });

  it('is stable when two arrived in the same second', () => {
    // A queue that reshuffles under a founder deciding three in a row is a queue they stop trusting.
    const tie = [row({ id: 'B', group: 'pr-open', waiting: waiting(5) }), row({ id: 'A', group: 'pr-open', waiting: waiting(5) })];
    expect(decisionOrder(tie).map((r) => r.id)).toEqual(['A', 'B']);
  });

  it('says which decision this is of how many', () => {
    expect(decisionPosition(decisionOrder(rows), 'MID')).toEqual({ n: 2, of: 3 });
    expect(decisionPosition(decisionOrder(rows), 'QUIET')).toBeNull();
  });

  it('never offers back a ticket the founder just answered', () => {
    // Asked before the page has reloaded: the server does not yet know the decision was made, so
    // reading the rows alone would hand them the one they have just approved.
    const order = decisionOrder(rows);
    expect(nextDecision(order, new Set())?.id).toBe('OLD');
    expect(nextDecision(order, new Set(['OLD']))?.id).toBe('MID');
    expect(nextDecision(order, new Set(['OLD', 'MID']))?.id).toBe('NEW');
    expect(nextDecision(order, new Set(['OLD', 'MID', 'NEW']))).toBeNull();
  });
});
