import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deskQueue } from '../desk';
import { composeBrief, stuckTickets, type BriefInput, type BriefLine } from '../brief';
import { collapseRepeats, type RunReport, type RunOutcome } from '../runreports';

/**
 * The desk's height does not grow with the venture (FB-178, FB-186).
 *
 * ## Why this test, and not one measurement of production
 *
 * Both tickets ask for a height "on ARCA's production data at 1440x1000". That reading cannot be
 * taken from this machine: production needs a signed-in founder session, and every request without
 * one lands on the sign-in page. The PR says so plainly rather than implying otherwise.
 *
 * But a single production reading was never the thing worth proving. The fault FB-178 was raised for
 * was not "the desk is tall today" — it was a desk that **grew as a venture aged**, which is how it
 * reached 9,908px against a design of about 1,900. A number measured today says nothing about the
 * same screen in a month.
 *
 * So this proves the stronger property: **every list the desk renders is capped**, so the desk over
 * ARCA's 73 tickets and 1,773 run reports is the same height as the desk over the gate's 7 and 9.
 * That is what makes the 2,165px measured in the gate transferable instead of one lucky sample.
 *
 * If someone later adds a list that grows per ticket, this file fails. A screenshot would not.
 */

const ROOT = join(import.meta.dirname, '..', '..');

/** Far more of everything than a venture will carry. ARCA's real numbers are 73 and 1,773. */
const MANY = 500;

const waitingItem = (i: number, external = false) => ({
  key: `k${i}`, ref: `ARCA-${i}`, title: `waiting ${i}`, external,
});

/** A real RunReport, not a cast. A cast would let the shape drift away from the one that ships. */
function run(i: number, over: Partial<RunReport> = {}): RunReport {
  const outcome: RunOutcome = i % 3 === 0 ? 'blocked' : 'progress';
  return {
    laneId: 'build',
    startedAt: '2026-09-01T10:00:00Z',
    endedAt: '2026-09-01T10:01:00Z',
    trigger: 'scheduled',
    outcome,
    summaryMd: `did ${i}`,
    ticketsTouched: [`ARCA-${i}`],
    errorDetail: outcome === 'blocked' ? 'waiting on a decision' : null,
    prUrl: null,
    repo: 'arca',
    isHeartbeat: false,
    ...over,
  };
}

function briefInput(over: Partial<BriefInput> = {}): BriefInput {
  return {
    ventureName: 'ARCA',
    openWork: [],
    awaitingApproval: 0,
    runs: [],
    engine: { state: 'running', text: 'Your team is working.', ageMinutes: 0 },
    overBudget: [],
    degraded: false,
    now: Date.parse('2026-09-01T12:00:00Z'),
    ...over,
  };
}

/** Every sentence the brief renders. The headline IS the first sentence, so it counts. */
const sentencesOf = (b: { headline: string; lines: BriefLine[] }) => [b.headline, ...b.lines.map((l) => l.text)];

describe('the waiting queue is capped, and the cap keeps the send', () => {
  it('shows four rows however many are waiting', () => {
    expect(deskQueue(Array.from({ length: 3 }, (_, i) => waitingItem(i)), 4)).toHaveLength(3);
    expect(deskQueue(Array.from({ length: MANY }, (_, i) => waitingItem(i)), 4)).toHaveLength(4);
  });

  it('keeps an external send on the desk when hundreds of pull requests would push it out', () => {
    // The cap must not become the way the one thing that leaves the company falls off the screen.
    // This is `deskQueue`'s whole reason for existing, in the other direction from the comment on it:
    // there it was sends erasing the work, here it is work erasing the send.
    const shown = deskQueue(
      [...Array.from({ length: MANY }, (_, i) => waitingItem(i)), waitingItem(9_999, true)],
      4,
    );
    expect(shown).toHaveLength(4);
    expect(shown.some((i) => i.external), 'the external send fell off the desk').toBe(true);
  });
});

describe('the engine list is capped', () => {
  it('slices to DESK_RUNS, and DESK_RUNS is small', () => {
    // Read out of the component, because the property being guarded is that the shipped number stays
    // small and the slice stays there. A behavioural test on `.slice(0, 4)` would only prove that
    // slice works.
    const src = readFileSync(join(ROOT, 'components', 'EngineActivity.tsx'), 'utf8');
    const cap = Number(/const DESK_RUNS\s*=\s*(\d+)/.exec(src)?.[1]);
    expect(cap, 'DESK_RUNS is no longer a plain number — check the cap by hand').toBeGreaterThan(0);
    expect(cap).toBeLessThanOrEqual(8);
    expect(src, 'the engine list stopped slicing to the cap').toMatch(/collapseRepeats\(reports\)\.slice\(0,\s*DESK_RUNS\)/);
  });

  it('collapses a thousand identical runs to one row, so the four slots are not wasted', () => {
    // ARCA's real history: 3,459 runs, all the same park. Collapsing before slicing is what stops
    // the whole panel reading as one sentence four times.
    const identical = Array.from({ length: 1_000 }, () => run(0));
    expect(collapseRepeats(identical)).toHaveLength(1);
    expect(collapseRepeats(identical)[0].repeats).toBe(1_000);
  });
});

describe('the brief is capped', () => {
  it('says the same number of sentences over five hundred runs as over five', () => {
    const few = composeBrief(briefInput({ runs: [run(0), run(1), run(2), run(3), run(4)] }));
    const many = composeBrief(briefInput({ runs: Array.from({ length: MANY }, (_, i) => run(i)) }));
    expect(sentencesOf(many)).toHaveLength(sentencesOf(few).length);
    // The brief is designed as four sentences plus a degraded note. Anything above that is a panel
    // that grew.
    expect(sentencesOf(many).length).toBeLessThanOrEqual(5);
  });

  it('names at most three stuck tickets, however many are stuck', () => {
    const runs = Array.from({ length: MANY }, (_, i) => run(i));
    const stuckCount = stuckTickets(runs).length;
    expect(stuckCount, 'the fixture produced no stuck tickets, so this proves nothing').toBeGreaterThan(50);

    // Found wherever it lands. The first draft of this test filtered `brief.lines` for tone
    // 'blocked' -- and with nothing else waiting, the stuck sentence becomes the HEADLINE, so the
    // filter matched nothing and the test passed over an unbounded sentence. Same vacuous shape as
    // the ApprovalCard loop in FB-183.
    const sentence = sentencesOf(composeBrief(briefInput({ runs }))).find((t) => t.includes('stuck'));
    expect(sentence, 'no sentence mentions stuck work').toBeTruthy();
    expect(sentence).toContain(`${stuckCount} tickets`);
    expect(sentence!.length, 'the stuck sentence is listing every ticket').toBeLessThan(200);
  });

  it('shows at most two blocked rows on the desk', () => {
    // `stopped` on the desk is brief.lines filtered to tone 'blocked' (VentureBoard.tsx:277). Only
    // two sentences can carry that tone: the stuck line, and the engine line when it has stalled.
    // Worst case: something waiting takes the headline, so both land in `lines`.
    const worst = composeBrief(briefInput({
      awaitingApproval: 2,
      runs: Array.from({ length: MANY }, (_, i) => run(i)),
      engine: { state: 'stalled', text: 'Your team has not checked in for 48 days.', ageMinutes: 69_120 },
    }));
    const stopped = worst.lines.filter((l) => l.tone === 'blocked');
    expect(stopped.length, 'a third kind of blocked row appeared on the desk').toBeLessThanOrEqual(2);
    expect(stopped.length, 'the worst case produced no blocked rows, so the bound is untested').toBeGreaterThan(0);
  });

  it('counts one stuck ticket once, however many times the lane retried it overnight', () => {
    const retried = Array.from({ length: MANY }, (_, i) => run(i, { outcome: 'blocked', ticketsTouched: ['ARCA-61'] }));
    expect(stuckTickets(retried)).toEqual(['ARCA-61']);
  });
});

describe('no list on the desk escapes a cap', () => {
  it('every list the desk maps over is either capped or set by configuration', () => {
    // The structural guard, and the one that catches the next FB-178 rather than this one.
    //
    // Each allowed name is a list whose length comes from CONFIGURATION rather than from how much
    // work a venture has done, or a list something else has already capped.
    const src = readFileSync(join(ROOT, 'components', 'VentureBoard.tsx'), 'utf8');
    const BOUNDED = new Set([
      'departments',      // the venture's surfaces: three, from the manifest
      'orphanLanes',      // one per repository no department claims: config, not backlog
      'stopped',          // blocked brief lines: at most two, asserted above
      'pendingApprovals', // both of these become waitingItems, which deskQueue caps at four
      'openWorkQueue',
    ]);
    const mapped = new Set([...src.matchAll(/([A-Za-z][A-Za-z0-9_]*)\.map\(/g)].map((m) => m[1]));
    expect([...mapped].length, 'found no lists at all — has the file moved?').toBeGreaterThan(3);
    expect(
      [...mapped].filter((n) => !BOUNDED.has(n)),
      'a new list is rendered on the desk. Is its length bounded? If so add it above with the reason.',
    ).toEqual([]);
  });
});
