import { describe, it, expect } from 'vitest';
import { composeBrief, bucketRuns, type BriefInput } from '../brief';
import type { RunReport } from '../runreports';

const run = (over: Partial<RunReport>): RunReport => ({
  laneId: 'arca', startedAt: '2026-07-31T10:00:00Z', endedAt: '2026-07-31T10:05:00Z',
  trigger: 'scheduled', outcome: 'progress', summaryMd: '', ticketsTouched: ['ARCA-1'],
  errorDetail: null, prUrl: null, repo: 'arca', isHeartbeat: false, ...over,
});

const input = (over: Partial<BriefInput> = {}): BriefInput => ({
  ventureName: 'ARCA', awaitingApproval: 0, openPrs: 0,
  blocked: [], failed: [], progressed: [],
  engine: { state: 'running', text: 'The agent lane checked in just now.' },
  overBudget: [], degraded: false, ...over,
});

describe('what the brief leads with', () => {
  it('puts a waiting approval above everything, including good news', () => {
    // A brief that opens with "3 tickets moved" while a send sits unapproved is worse than none.
    const b = composeBrief(input({ awaitingApproval: 1, progressed: [run({ outcome: 'opened-pr' })] }));
    expect(b.headline).toContain('needs you');
    expect(b.headline).toContain('waiting for your approval');
    expect(b.lines[0].text).toContain('Nothing has been sent.');
  });

  it('leads with a stop when nothing is waiting on approval', () => {
    const b = composeBrief(input({ blocked: [run({ outcome: 'blocked', errorDetail: 'x' })], openPrs: 2 }));
    expect(b.headline).toContain('stopped');
  });

  it('leads with the stalled engine before routine review work', () => {
    const b = composeBrief(input({ openPrs: 3, engine: { state: 'stalled', text: 'not checked in for 3 hours' } }));
    expect(b.headline).toContain('stopped checking in');
  });

  it('says a quiet venture is quiet, and says why that is fine', () => {
    const b = composeBrief(input());
    expect(b.headline).toContain('quiet');
    expect(b.headline).toContain('nothing waiting on you');
  });

  it('distinguishes "no lane yet" from "quiet"', () => {
    const b = composeBrief(input({ engine: { state: 'unknown', text: 'No sign of an agent lane yet' } }));
    expect(b.headline).toContain('no agent lane running yet');
  });
});

describe('what the brief refuses to do', () => {
  it('never composes a calm summary out of an unreadable picture', () => {
    // An empty queue and an unreachable box look identical from here; only one of them is fine.
    const b = composeBrief(input({ degraded: true }));
    expect(b.headline).toContain('could not read everything');
    expect(b.lines.some((l) => l.text.includes('not a sign that nothing is happening'))).toBe(true);
    expect(b.degraded).toBe(true);
  });

  it('names each stopped run with its reason rather than counting them', () => {
    const b = composeBrief(input({
      blocked: [run({ outcome: 'blocked', ticketsTouched: ['ARCA-7'], errorDetail: 'Tests it could not fix.' })],
      failed: [run({ outcome: 'error', ticketsTouched: ['ARCA-9'], errorDetail: 'Claude auth expired.' })],
    }));
    const text = b.lines.map((l) => l.text).join(' | ');
    expect(text).toContain('ARCA-7');
    expect(text).toContain('Tests it could not fix.');
    expect(text).toContain('ARCA-9');
    expect(text).toContain('Claude auth expired.');
  });

  it('always reports the engine, even when everything else is silent', () => {
    // "Nothing happened" and "nothing could happen" are the two states most worth telling apart.
    const b = composeBrief(input());
    expect(b.lines.some((l) => l.text.includes('checked in'))).toBe(true);
  });
});

describe('ordering and tone', () => {
  it('orders by who is needed: approvals, then stops, then budget, then progress, then the engine', () => {
    const b = composeBrief(input({
      awaitingApproval: 1,
      blocked: [run({ outcome: 'blocked', errorDetail: 'r' })],
      overBudget: ['Sell'],
      progressed: [run({ outcome: 'opened-pr' })],
    }));
    const kinds = b.lines.map((l) => l.text);
    expect(kinds[0]).toContain('approval');
    expect(kinds[1]).toContain('Stopped');
    expect(kinds[2]).toContain('over the spend limit');
    expect(kinds[3]).toContain('moved');
    expect(kinds[4]).toContain('checked in');
  });

  it('gives a stalled engine a blocked tone, not a working one', () => {
    const b = composeBrief(input({ engine: { state: 'stalled', text: 'silent for 3 hours' } }));
    expect(b.lines.find((l) => l.text.includes('silent'))?.tone).toBe('blocked');
  });

  it('gets its singulars and plurals right — a brief that says "1 actions" reads as a machine', () => {
    expect(composeBrief(input({ awaitingApproval: 1 })).lines[0].text).toContain('1 action outside the company is waiting');
    expect(composeBrief(input({ awaitingApproval: 2 })).lines[0].text).toContain('2 actions outside the company are waiting');
    expect(composeBrief(input({ openPrs: 1 })).lines[0].text).toContain('1 pull request is open');
    expect(composeBrief(input({ overBudget: ['Sell'] })).lines[0].text).toContain('Sell is over');
    expect(composeBrief(input({ overBudget: ['Sell', 'Scale'] })).lines[0].text).toContain('Sell and Scale are over');
  });

  it('truncates a long list of progress without pretending it is the whole list', () => {
    const b = composeBrief(input({ progressed: Array.from({ length: 5 }, (_, i) => run({ ticketsTouched: [`T-${i}`] })) }));
    expect(b.lines[0].text).toContain('5 tickets moved');
    expect(b.lines[0].text).toContain('and more');
  });
});

describe('bucketRuns', () => {
  it('splits the history the way the brief reads it, from one place', () => {
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
