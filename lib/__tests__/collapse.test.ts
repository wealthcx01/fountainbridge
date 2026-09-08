import { describe, it, expect } from 'vitest';
import { collapseRepeats, repeatClause } from '../runreports';
import type { RunReport } from '../runreports';

const run = (over: Partial<RunReport> = {}): RunReport => ({
  repo: 'arca', laneId: 'build', ticketsTouched: ['ARCA-61'], outcome: 'blocked',
  summaryMd: 'Daily plan: team budget reached — parked until tomorrow',
  startedAt: '2026-09-02T16:00:00Z', endedAt: '2026-09-02T16:00:30Z',
  prUrl: null, isHeartbeat: false, ...over,
} as RunReport);

describe('collapsing repeated runs (FB-178)', () => {
  it('merges a consecutive run of identical outcomes into one, counted', () => {
    // ARCA's real shape: a lane at its daily budget re-parks every five minutes.
    const out = collapseRepeats([run(), run(), run(), run()]);
    expect(out).toHaveLength(1);
    expect(out[0].repeats).toBe(4);
  });

  it('keeps the NEWEST of the group, because that is the row that is shown', () => {
    const newest = run({ startedAt: '2026-09-02T16:30:00Z' });
    const out = collapseRepeats([newest, run({ startedAt: '2026-09-02T16:00:00Z' })]);
    expect(out[0].startedAt).toBe('2026-09-02T16:30:00Z');
  });

  it('does NOT merge across something else — those are two things that happened', () => {
    const parked = run();
    const other = run({ outcome: 'opened-pr', summaryMd: 'Opened a pull request' });
    const out = collapseRepeats([parked, other, run()]);
    expect(out.map((r) => r.repeats), 'merged across a gap').toEqual([1, 1, 1]);
  });

  it('does not merge two lanes that happen to say the same thing', () => {
    const out = collapseRepeats([run({ laneId: 'build' }), run({ laneId: 'sell' })]);
    expect(out).toHaveLength(2);
  });

  it('leaves a list with nothing repeated exactly as it was', () => {
    const a = run({ summaryMd: 'one' }), b = run({ summaryMd: 'two' });
    expect(collapseRepeats([a, b]).map((r) => r.summaryMd)).toEqual(['one', 'two']);
  });
});

describe('repeatClause (FB-203, item 9)', () => {
  // The situation this exists for, taken from ARCA on production: 3,461 run reports, every one of
  // them the same park, of which the studio reads 20.
  it('does not understate a venture that has been stuck for weeks', () => {
    expect(repeatClause(20, 20, 3461)).toBe('every one of the last 20 runs says this');
  });

  it('never claims to have read what it did not read', () => {
    // The number 3,461 must not appear. The studio opened twenty files; saying "3,461 times" would
    // be a statement it cannot support, and a founder who checked would find it wrong.
    expect(repeatClause(20, 20, 3461)).not.toContain('3,461');
  });

  it('is an ordinary count when the whole history was read', () => {
    // Nothing was left unopened, so the count is exact and saying so plainly is better.
    expect(repeatClause(3, 8, 8)).toBe('the same thing 3 times');
    expect(repeatClause(8, 8, 8)).toBe('the same thing 8 times');
  });

  it('is an ordinary count for a group smaller than the read window', () => {
    // Three of the twenty read. That is exact, whatever the total is.
    expect(repeatClause(3, 20, 3461)).toBe('the same thing 3 times');
  });

  it('writes four-figure counts as numbers a person can read', () => {
    expect(repeatClause(1200, 1200, 9000)).toBe('every one of the last 1,200 runs says this');
  });
});
