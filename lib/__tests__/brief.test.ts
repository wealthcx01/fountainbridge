import { describe, it, expect } from 'vitest';
import { composeBrief, bucketRuns, stuckTickets, type BriefInput } from '../brief';
import type { RunReport } from '../runreports';

const NOW = Date.parse('2026-08-04T12:00:00Z');
const at = (iso: string) => iso;

const run = (over: Partial<RunReport>): RunReport => ({
  laneId: 'arca', startedAt: '2026-08-04T10:00:00Z', endedAt: '2026-08-04T10:05:00Z',
  trigger: 'scheduled', outcome: 'progress', summaryMd: '', ticketsTouched: ['ARCA-1'],
  errorDetail: null, prUrl: null, repo: 'arca', isHeartbeat: false, ...over,
});

const input = (over: Partial<BriefInput> = {}): BriefInput => ({
  ventureName: 'ARCA', awaitingApproval: 0, openWork: [], runs: [],
  engine: { state: 'running', text: 'Your team checked in just now.', ageMinutes: 0 },
  overBudget: [], degraded: false, now: NOW, ...over,
});

/** Every sentence the brief produced, headline included — it is the first sentence, not a fifth. */
const all = (b: ReturnType<typeof composeBrief>) => [b.headline, ...b.lines.map((l) => l.text)];
const days = (n: number) => n * 24 * 60 * 60 * 1000;

describe('the walk that produced this ticket', () => {
  // John's real board on 2026-08-04: five stopped reports across two tickets (one retried three
  // times), one run in flight, work waiting, a send waiting, a department over budget, and a read
  // that failed. The old brief rendered this as a disclaimer followed by eight bullets.
  const walk = () =>
    composeBrief(
      input({
        awaitingApproval: 4,
        openWork: [
          { ticketId: 'ARCA-1', ageMs: days(3) },
          { ticketId: 'ARCA-5', ageMs: days(1) },
        ],
        runs: [
          run({ outcome: 'blocked', ticketsTouched: ['ARCA-31'], errorDetail: 'the gate check changed the working tree instead of just reporting, so its verdicts do not describe the committed code' }),
          run({ outcome: 'blocked', ticketsTouched: ['ARCA-31'], errorDetail: 'second attempt, same fault' }),
          run({ outcome: 'error', ticketsTouched: ['ARCA-31'], errorDetail: 'third attempt, same fault' }),
          run({ outcome: 'blocked', ticketsTouched: ['ARCA-12'], errorDetail: 'price history unavailable' }),
          run({ outcome: 'error', ticketsTouched: ['ARCA-12'], errorDetail: 'and again' }),
          run({ outcome: null, endedAt: null, ticketsTouched: ['ARCA-40'] }),
          run({ outcome: 'opened-pr', ticketsTouched: ['ARCA-2'], endedAt: at('2026-08-03T09:00:00Z') }),
          run({ outcome: 'progress', ticketsTouched: ['ARCA-3'], endedAt: at('2026-08-02T09:00:00Z') }),
        ],
        engine: { state: 'running', text: 'Your team checked in 2 minutes ago.', ageMinutes: 2 },
        ticketTitles: { 'ARCA-31': 'the sign-in tagline', 'ARCA-12': 'the price-history work', 'ARCA-40': 'the interface audit' },
        overBudget: ['Sell'],
        degraded: true,
      }),
    );

  it('renders in four sentences plus one honesty line, however much happened', () => {
    expect(all(walk())).toHaveLength(5);
  });

  it('leads with what needs the founder, counted across both kinds and aged', () => {
    const b = walk();
    expect(b.headline).toContain('6 things are waiting for your OK');
    expect(b.headline).toContain('2 pieces of finished work to read');
    expect(b.headline).toContain('4 actions that would go outside the company');
    expect(b.headline).toContain('the oldest has waited 3 days');
  });

  it('says five stopped reports about two tickets as two tickets, by name', () => {
    const stuck = all(walk()).find((s) => s.includes('stuck'));
    expect(stuck).toBe('2 tickets are stuck and need a human: the sign-in tagline and the price-history work.');
  });

  it('never quotes the machine’s own reasoning into the summary', () => {
    // The whole reason this ticket exists: "the gate check changed the working tree instead of just
    // reporting" is true, and belongs beside the attempt it describes, not in the orientation line.
    expect(all(walk()).join(' ')).not.toContain('working tree');
    expect(all(walk()).join(' ')).not.toContain('same fault');
  });

  it('says what the team is doing and what it finished, in one sentence', () => {
    const team = all(walk()).find((s) => s.includes('Your team'));
    expect(team).toBe('Your team is working on the interface audit and has finished 2 tickets this week; it checked in 2 minutes ago.');
  });

  it('puts what could not be read last, and never in the headline', () => {
    const b = walk();
    expect(b.headline).not.toContain('could not be read');
    expect(b.lines[b.lines.length - 1].text).toContain('Part of the picture could not be read');
    expect(b.degraded).toBe(true);
  });

  it('gives every sentence somewhere to be expanded, except the one with nowhere to go', () => {
    const b = walk();
    expect(b.headlineHref).toBe('/attention');
    const withoutLink = b.lines.filter((l) => !l.href);
    expect(withoutLink).toHaveLength(1);
    expect(withoutLink[0].text).toContain('could not be read');
  });
});

describe('what the brief leads with', () => {
  it('puts waiting work above everything, including good news', () => {
    // A brief that opens with "3 tickets moved" while a send sits unapproved is worse than none.
    const b = composeBrief(input({ awaitingApproval: 1, runs: [run({ outcome: 'opened-pr' })] }));
    expect(b.headline).toContain('1 action is waiting for your OK');
    expect(b.headline).toContain('nothing has been sent');
  });

  it('leads with a stop when nothing is waiting on the founder', () => {
    const b = composeBrief(input({ runs: [run({ outcome: 'blocked', ticketsTouched: ['ARCA-7'] })] }));
    expect(b.headline).toContain('1 ticket is stuck and needs a human: ARCA-7');
  });

  it('leads with the stalled team before routine review work', () => {
    const b = composeBrief(input({ engine: { state: 'stalled', text: 'Your team has not checked in for 3 hours.', ageMinutes: 180 } }));
    expect(b.headline).toContain('has not checked in for 3 hours');
  });

  it('answers "does anything need me?" even when the answer is no', () => {
    const b = composeBrief(input({ engine: { state: 'running', text: 'x', ageMinutes: 0 } }));
    expect(b.headline).toBe('ARCA: nothing is waiting on you.');
    expect(b.lines[0].text).toContain('nothing in hand right now');
  });

  it('distinguishes "no team yet" from "quiet"', () => {
    const b = composeBrief(input({ engine: { state: 'unknown', text: 'Your team is not working on this venture yet.', ageMinutes: null } }));
    expect(b.headline).toContain('not working on this venture yet');
  });
});

describe('what the brief refuses to do', () => {
  it('never composes a calm summary out of an unreadable picture', () => {
    // An empty queue and an unreachable machine look identical from here; only one is fine. So the
    // reassurance is withheld — the brief must not report a clear queue it could not read.
    const b = composeBrief(input({ degraded: true }));
    expect(all(b).join(' ')).not.toContain('Nothing is waiting on you');
    expect(all(b).join(' ')).toContain('Part of the picture could not be read');
    expect(b.degraded).toBe(true);
  });

  it('counts a stuck ticket once however many times it was retried', () => {
    const retried = Array.from({ length: 6 }, () => run({ outcome: 'blocked', ticketsTouched: ['ARCA-7'] }));
    expect(composeBrief(input({ runs: retried })).headline).toContain('1 ticket is stuck');
  });

  it('counts a finished ticket once however many runs touched it', () => {
    const b = composeBrief(input({
      runs: [
        run({ outcome: 'progress', ticketsTouched: ['ARCA-2'] }),
        run({ outcome: 'progress', ticketsTouched: ['ARCA-2'] }),
        run({ outcome: 'opened-pr', ticketsTouched: ['ARCA-2'] }),
      ],
    }));
    expect(all(b).join(' ')).toContain('has finished 1 ticket this week');
  });

  it('does not count last month’s work as this week’s', () => {
    const b = composeBrief(input({ runs: [run({ outcome: 'opened-pr', endedAt: at('2026-06-01T09:00:00Z') })] }));
    expect(all(b).join(' ')).not.toContain('finished');
  });

  it('caps a long list of stuck tickets without pretending it is the whole list', () => {
    const many = Array.from({ length: 5 }, (_, i) => run({ outcome: 'blocked', ticketsTouched: [`T-${i}`] }));
    const b = composeBrief(input({ runs: many }));
    expect(b.headline).toContain('5 tickets are stuck');
    expect(b.headline).toContain('and 2 more');
  });
});

describe('the sentences themselves', () => {
  it('gets its singulars and plurals right — a brief that says "1 actions" reads as a machine', () => {
    const needs = (over: Partial<BriefInput>) => composeBrief(input(over)).headline;
    expect(needs({ awaitingApproval: 1 })).toContain('1 action is waiting for your OK before it goes outside');
    expect(needs({ awaitingApproval: 2 })).toContain('2 actions are waiting for your OK before they go outside');
    expect(needs({ openWork: [{ ticketId: null, ageMs: 0 }] })).toContain('1 piece of finished work is waiting');
    expect(needs({ openWork: [{ ticketId: null, ageMs: 0 }, { ticketId: null, ageMs: 0 }] })).toContain('2 pieces of finished work are waiting');
    const money = (over: Partial<BriefInput>) => all(composeBrief(input(over))).join(' ');
    expect(money({ overBudget: ['Sell'] })).toContain('Sell is over');
    expect(money({ overBudget: ['Sell', 'Scale'] })).toContain('Sell and Scale are over');
  });

  it('does not claim an age it does not have', () => {
    const b = composeBrief(input({ openWork: [{ ticketId: null, ageMs: 5_000 }] }));
    expect(b.headline).not.toContain('oldest');
  });

  it('falls back to the ticket id when the board is not showing that ticket', () => {
    const b = composeBrief(input({ runs: [run({ outcome: 'blocked', ticketsTouched: ['SELL-9'] })], ticketTitles: {} }));
    expect(b.headline).toContain('SELL-9');
  });

  it('gives a stalled team a blocked tone, not a working one', () => {
    const b = composeBrief(input({
      awaitingApproval: 1,
      engine: { state: 'stalled', text: 'silent for 3 hours', ageMinutes: 180 },
    }));
    expect(b.lines.find((l) => l.text.includes('silent'))?.tone).toBe('blocked');
  });

  it('says the team is idle rather than pretending it is working', () => {
    const b = composeBrief(input({ awaitingApproval: 1, engine: { state: 'running', text: 'x', ageMinutes: 0 } }));
    expect(b.lines.some((l) => l.text.includes('nothing in hand right now'))).toBe(true);
  });
});

describe('stuckTickets', () => {
  it('dedupes by ticket and keeps only what stopped', () => {
    expect(stuckTickets([
      run({ outcome: 'blocked', ticketsTouched: ['A'] }),
      run({ outcome: 'error', ticketsTouched: ['A'] }),
      run({ outcome: 'blocked', ticketsTouched: ['B'] }),
      run({ outcome: 'progress', ticketsTouched: ['C'] }),
      run({ outcome: null, ticketsTouched: ['D'] }),
    ])).toEqual(['A', 'B']);
  });

  it('does not lose a stopped run that names no ticket', () => {
    const out = stuckTickets([run({ outcome: 'blocked', ticketsTouched: [], repo: 'arca', laneId: 'build' })]);
    expect(out).toEqual(['arca/build']);
  });
});

describe('bucketRuns', () => {
  it('splits the history the way the board reads it, from one place', () => {
    const out = bucketRuns([
      run({ outcome: 'blocked' }), run({ outcome: 'error' }), run({ outcome: 'opened-pr' }),
      run({ outcome: 'progress' }), run({ outcome: 'no-useful-work' }), run({ outcome: null }),
    ]);
    expect(out.blocked).toHaveLength(1);
    expect(out.failed).toHaveLength(1);
    expect(out.progressed).toHaveLength(2);
  });

  it('does not count an idle wake or an in-flight run as progress', () => {
    expect(bucketRuns([run({ outcome: 'no-useful-work' }), run({ outcome: null })]).progressed).toHaveLength(0);
  });
});
