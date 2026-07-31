import { describe, it, expect } from 'vitest';
import { fromLaneRecord, loadRunReports, engineState, describeRun, type RunReportSource } from '../runreports';

const venture = {
  id: 'arca',
  repos: ['arca'],
  departments: [{ id: 'build', repo: 'arca' }, { id: 'sell', repo: 'arca-marketing' }],
} as never;

const source = (byRepo: Record<string, Record<string, unknown>>): RunReportSource => ({
  async list(repo) { return Object.keys(byRepo[repo] ?? {}); },
  async read(repo, name) { return byRepo[repo]?.[name] ?? null; },
});

describe('reading what the lane actually wrote', () => {
  it('normalises the lane shape that has been on the ref since FB-040', () => {
    // Copied from ARCA's live foundry-state ref, not invented.
    const r = fromLaneRecord({
      ticket: 'ARCA-12', lane: 'arca', status: 'opened_pr',
      summary: 'Added the screener filter.', pr_url: 'https://github.com/wealthcx01/arca/pull/12',
      started: '2026-07-31T13:55:00Z', finished: '2026-07-31T14:02:00Z', repo: 'wealthcx01/arca',
    }, 'arca');
    expect(r).toMatchObject({
      laneId: 'arca', outcome: 'opened-pr', ticketsTouched: ['ARCA-12'],
      endedAt: '2026-07-31T14:02:00Z', prUrl: 'https://github.com/wealthcx01/arca/pull/12',
    });
  });

  it('also reads the contract shape, so the writer can migrate without a flag day', () => {
    const r = fromLaneRecord({
      lane_id: 'sell', started_at: '2026-07-31T13:00:00Z', ended_at: '2026-07-31T13:10:00Z',
      trigger: 'manual', outcome: 'awaiting-approval', summary_md: 'Proposed the send.',
      tickets_touched: ['SELL-002'],
    }, 'arca-marketing');
    expect(r).toMatchObject({ laneId: 'sell', outcome: 'awaiting-approval', trigger: 'manual', ticketsTouched: ['SELL-002'] });
  });

  it('keeps blocked and failed apart — the whole reason the enum was extended', () => {
    expect(fromLaneRecord({ lane: 'a', started: '1', finished: '2', status: 'blocked' }, 'r')?.outcome).toBe('blocked');
    expect(fromLaneRecord({ lane: 'a', started: '1', finished: '2', status: 'failed' }, 'r')?.outcome).toBe('error');
    expect(fromLaneRecord({ lane: 'a', started: '1', finished: '2', status: 'awaiting_founder' }, 'r')?.outcome).toBe('awaiting-approval');
  });

  it('carries the reason for the outcomes that owe one', () => {
    const r = fromLaneRecord({ lane: 'a', started: '1', finished: '2', status: 'blocked', summary: 'Tried 3 times; needs a human.' }, 'r');
    expect(r?.errorDetail).toBe('Tried 3 times; needs a human.');
    // A clean outcome does not manufacture one.
    expect(fromLaneRecord({ lane: 'a', started: '1', finished: '2', status: 'idle', summary: 'Nothing to do.' }, 'r')?.errorDetail).toBeNull();
  });

  it('treats an in-flight run as having no outcome, both ways round', () => {
    // status=working: the lane is mid-run.
    const working = fromLaneRecord({ lane: 'a', started: '1', status: 'working', summary: 'x' }, 'r');
    expect(working?.outcome).toBeNull();
    expect(working?.endedAt).toBeNull();
    // An outcome with no end time is the drift the contract validator refuses; the reader must not
    // render it as finished either.
    const half = fromLaneRecord({ lane: 'a', started: '1', status: 'opened_pr' }, 'r');
    expect(half?.outcome).toBeNull();
    expect(half?.endedAt).toBeNull();
  });

  it('surfaces a status it does not recognise instead of dropping the run', () => {
    // A lane that grows a new state should read as "something I can't explain", never as nothing.
    const r = fromLaneRecord({ lane: 'a', started: '1', finished: '2', status: 'quantum', summary: 'hm' }, 'r');
    expect(r?.outcome).toBe('blocked');
  });

  it('refuses a record with no lane or no start, rather than inventing a run', () => {
    expect(fromLaneRecord({ status: 'opened_pr' }, 'r')).toBeNull();
    expect(fromLaneRecord({ lane: 'a', status: 'opened_pr' }, 'r')).toBeNull();
    expect(fromLaneRecord('not an object', 'r')).toBeNull();
    expect(fromLaneRecord(null, 'r')).toBeNull();
  });
});

describe('loadRunReports', () => {
  it('reads every department repo and orders newest first across all of them', async () => {
    const out = await loadRunReports(venture, source({
      arca: { 'a.json': { lane: 'arca', ticket: 'ARCA-1', started: '2026-07-31T10:00:00Z', finished: '2026-07-31T10:05:00Z', status: 'opened_pr' } },
      'arca-marketing': { 'b.json': { lane: 'sell', ticket: 'SELL-1', started: '2026-07-31T12:00:00Z', finished: '2026-07-31T12:05:00Z', status: 'blocked' } },
    }));
    expect(out.reports.map((r) => r.ticketsTouched[0])).toEqual(['SELL-1', 'ARCA-1']);
    expect(out.total).toBe(2);
  });

  it('separates the heartbeat from run history — it is liveness, not work', async () => {
    const out = await loadRunReports(venture, source({
      arca: {
        '_heartbeat.json': { lane: 'arca', ticket: 'heartbeat', started: '2026-07-31T14:00:00Z', finished: '2026-07-31T14:00:00Z', status: 'idle' },
        'a.json': { lane: 'arca', ticket: 'ARCA-1', started: '2026-07-31T10:00:00Z', finished: '2026-07-31T10:05:00Z', status: 'opened_pr' },
      },
      'arca-marketing': {},
    }));
    expect(out.reports).toHaveLength(1);
    expect(out.heartbeats).toHaveLength(1);
    expect(out.reports[0].isHeartbeat).toBe(false);
  });

  it('caps the render without hiding the count', async () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [
      `r${i}.json`,
      { lane: 'arca', ticket: `T-${i}`, started: `2026-07-${String(i + 1).padStart(2, '0')}T10:00:00Z`, finished: `2026-07-${String(i + 1).padStart(2, '0')}T10:05:00Z`, status: 'opened_pr' },
    ]));
    const out = await loadRunReports(venture, source({ arca: many, 'arca-marketing': {} }), 5);
    expect(out.reports).toHaveLength(5);
    expect(out.total).toBe(30); // a capped list must never read as the whole story
  });

  it('skips unreadable records without losing the readable ones beside them', async () => {
    const out = await loadRunReports(venture, source({
      arca: { 'bad.json': { nonsense: true }, 'good.json': { lane: 'arca', ticket: 'T', started: '2026-07-31T10:00:00Z', finished: '2026-07-31T10:01:00Z', status: 'idle' } },
      'arca-marketing': {},
    }));
    expect(out.reports.map((r) => r.laneId)).toEqual(['arca']);
  });
});

describe('engineState — is anything actually running?', () => {
  const beat = (at: string) => ({ endedAt: at, startedAt: at, isHeartbeat: true }) as never;
  const NOW = new Date('2026-07-31T14:00:00Z');

  it('reports a recent check-in as running', () => {
    expect(engineState([beat('2026-07-31T13:57:00Z')], NOW).state).toBe('running');
  });

  it('calls a long silence stalled, and says what that means', () => {
    const s = engineState([beat('2026-07-31T11:00:00Z')], NOW);
    expect(s.state).toBe('stalled');
    expect(s.text).toContain('3 hours');
    expect(s.text).toContain('something is wrong with the box');
  });

  it('says "no lane yet" rather than "offline" when there has never been one', () => {
    // A venture whose box was never provisioned has no lane to be offline, and telling a founder
    // their engine is down would be false.
    const s = engineState([], NOW);
    expect(s.state).toBe('unknown');
    expect(s.text).toContain('starts with your box');
  });

  it('does not read an unparseable timestamp as healthy', () => {
    expect(engineState([beat('not a date')], NOW).state).toBe('unknown');
  });

  it('takes the most recent beat when several lanes report', () => {
    const s = engineState([beat('2026-07-31T09:00:00Z'), beat('2026-07-31T13:58:00Z')], NOW);
    expect(s.state).toBe('running');
  });
});

describe('describeRun — one owner for the words', () => {
  const run = (over: Record<string, unknown>) => ({ ticketsTouched: ['ARCA-3'], summaryMd: '', errorDetail: null, ...over }) as never;

  it('never reports a stop without its reason', () => {
    expect(describeRun(run({ outcome: 'blocked', errorDetail: 'Tests it could not fix.' }))).toContain('Tests it could not fix.');
    expect(describeRun(run({ outcome: 'error', errorDetail: 'Claude auth expired.' }))).toContain('Claude auth expired.');
  });

  it('says so plainly when a stop recorded no reason at all', () => {
    // Silence about why is itself information; it must not render as an empty sentence.
    expect(describeRun(run({ outcome: 'blocked' }))).toContain('no reason was recorded');
  });

  it('makes an awaiting-approval run sound like what it is', () => {
    expect(describeRun(run({ outcome: 'awaiting-approval' }))).toContain('waiting for your approval');
  });

  it('does not dress up an idle wake as work', () => {
    expect(describeRun(run({ outcome: 'no-useful-work', ticketsTouched: [] }))).toContain('nothing ready to work');
  });
});
