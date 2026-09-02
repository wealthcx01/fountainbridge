import { describe, it, expect } from 'vitest';
import { collapseRepeats } from '../runreports';
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
