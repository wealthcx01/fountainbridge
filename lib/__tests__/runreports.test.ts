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
    expect(s.text).toContain('something is wrong with this venture’s machine');
  });

  it('says "no lane yet" rather than "offline" when there has never been one', () => {
    // A venture whose box was never provisioned has no lane to be offline, and telling a founder
    // their engine is down would be false.
    const s = engineState([], NOW);
    expect(s.state).toBe('unknown');
    expect(s.text).toContain('starts with this venture’s own machine');
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

  it('quotes the machine’s reason in the founder’s vocabulary (FB-103)', () => {
    // The reason is written on the venture's own machine, in the machine's words, and the brief
    // quotes it verbatim — so the board said "Your team" at the top and "The lane" four lines down.
    const said = describeRun(run({ outcome: 'blocked', errorDetail: 'The lane tried this 3 times.' }));
    expect(said).toContain('Your team tried this 3 times.');
    expect(said).not.toContain('lane');
  });

  it('still hands over the whole reason, translated but not trimmed', () => {
    const detail = 'The agent lane could not get typecheck to pass on lib/work.ts. Parked.';
    expect(describeRun(run({ outcome: 'error', errorDetail: detail })))
      .toContain('Your team could not get typecheck to pass on lib/work.ts. Parked.');
  });
});

/**
 * The board must not open every report ever written (FB-123).
 *
 * It used to. Measured on ARCA: 117 files, one GitHub read each at 339ms, sequential — a board that
 * took 40 seconds on every single load, to display twenty of them. And it grew with every wake of
 * the lane (76 reports one day, 105 the next), so the studio got slower the more the product worked.
 *
 * These count READS rather than assert a duration: a timing test would be flaky and would not say
 * what was wrong. The read count is the thing that was broken and the thing that must stay bounded.
 */
describe('what the board opens to render twenty runs', () => {
  /** A source that records every read, so the cost is a fact in the test rather than a hope. */
  const countingSource = (byRepo: Record<string, Record<string, unknown>>) => {
    const reads: string[] = [];
    const src: RunReportSource = {
      async list(repo) { return Object.keys(byRepo[repo] ?? {}); },
      async read(repo, name) { reads.push(`${repo}/${name}`); return byRepo[repo]?.[name] ?? null; },
    };
    return { src, reads };
  };

  /** ARCA's real shape: a lot of history, named the way the lane names it. */
  const manyReports = (n: number) => {
    const files: Record<string, unknown> = {
      '_heartbeat.json': { ticket: 'heartbeat', lane: 'arca', status: 'idle', started: '2026-08-27T11:00:00Z', finished: '2026-08-27T11:00:00Z' },
    };
    for (let i = 0; i < n; i++) {
      // `<slug>-YYYYMMDDTHHMMSSZ.json`, fixed width and zero padded, exactly as foundry-lib.sh writes it.
      const stamp = `202608${String(10 + Math.floor(i / 100)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}0000Z`;
      files[`ARCA-${String(i).padStart(3, '0')}-thing-${stamp}.json`] = {
        ticket: `ARCA-${String(i).padStart(3, '0')}`, lane: 'arca', status: 'opened_pr',
        summary: 'did a thing', started: `2026-08-${String(10 + Math.floor(i / 100)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`,
        finished: `2026-08-${String(10 + Math.floor(i / 100)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:30:00Z`,
      };
    }
    return files;
  };

  it('opens a bounded number of files, not one per report in the history', async () => {
    const { src, reads } = countingSource({ arca: manyReports(117) });
    await loadRunReports(venture, src, 20);
    // The exact bound is limit × margin + the beacon; what matters is that 117 files did not become
    // 117 reads, and that adding a thousand more reports would not change this number.
    expect(reads.length).toBeLessThanOrEqual(20 * 3 + 1);
    expect(reads.length).toBeLessThan(117);
  });

  it('does not read more as the history grows, which was the real fault', async () => {
    // 76 reports one day, 105 the next, 117 the day after. The old code got slower each time.
    // Both above the bound: below it, reading everything IS reading the newest N, and comparing
    // 40-vs-400 would only prove the cap exists, not that growth stops costing.
    const small = countingSource({ arca: manyReports(200) });
    const large = countingSource({ arca: manyReports(2000) });
    await loadRunReports(venture, small.src, 20);
    await loadRunReports(venture, large.src, 20);
    expect(large.reads.length).toBe(small.reads.length);
  });

  it('still reports the true total, so "showing 20 of N" stays honest', async () => {
    const { src } = countingSource({ arca: manyReports(117) });
    const out = await loadRunReports(venture, src, 20);
    expect(out.total).toBe(117);
    expect(out.reports).toHaveLength(20);
  });

  it('always opens the heartbeat, even on a venture whose runs are all older than it', async () => {
    // The case that would break engineState: pick by recency alone and a quiet venture loses the one
    // file that says whether its engine is alive.
    const { src, reads } = countingSource({ arca: manyReports(117) });
    const out = await loadRunReports(venture, src, 5);
    expect(reads).toContain('arca/_heartbeat.json');
    expect(out.heartbeats).toHaveLength(1);
    expect(engineState(out.heartbeats, new Date('2026-08-27T11:05:00Z')).state).not.toBe('unknown');
  });

  it('still orders by when a run STARTED, not by the timestamp in its filename', async () => {
    const files = {
      // Written last, started first — the case the read margin exists for.
      'ARCA-001-a-20260827T120000Z.json': { ticket: 'ARCA-001', lane: 'arca', status: 'opened_pr', started: '2026-08-27T09:00:00Z', finished: '2026-08-27T12:00:00Z' },
      'ARCA-002-b-20260827T100000Z.json': { ticket: 'ARCA-002', lane: 'arca', status: 'opened_pr', started: '2026-08-27T10:00:00Z', finished: '2026-08-27T10:00:00Z' },
    };
    const { src } = countingSource({ arca: files });
    const out = await loadRunReports(venture, src, 20);
    expect(out.reports.map((r) => r.ticketsTouched[0])).toEqual(['ARCA-002', 'ARCA-001']);
  });

  it('loses one unreadable report rather than the whole board', async () => {
    // Only the product repo has reports; the venture also declares arca-marketing, and a source that
    // answered for every repo would double-count.
    const src: RunReportSource = {
      async list(repo) { return repo === 'arca' ? ['_heartbeat.json', 'ARCA-001-a-20260827T120000Z.json', 'ARCA-002-b-20260827T110000Z.json'] : []; },
      async read(_repo, name) {
        if (name.startsWith('ARCA-001')) throw new Error('unreadable');
        if (name === '_heartbeat.json') return { ticket: 'heartbeat', lane: 'arca', status: 'idle', started: '2026-08-27T11:00:00Z', finished: '2026-08-27T11:00:00Z' };
        return { ticket: 'ARCA-002', lane: 'arca', status: 'opened_pr', started: '2026-08-27T11:00:00Z', finished: '2026-08-27T11:00:00Z' };
      },
    };
    const out = await loadRunReports(venture, src, 20);
    expect(out.reports.map((r) => r.ticketsTouched[0])).toEqual(['ARCA-002']);
  });
});
