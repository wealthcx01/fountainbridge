import { describe, it, expect } from 'vitest';
import { buildFeed as build, type FeedInput } from '../activity-feed';

/** The items alone, for the assertions that are about the list rather than the cap. */
const buildFeed = (input: FeedInput) => build(input).items;
import type { ActivityEvent } from '../health';
import type { RunReport } from '../runreports';
import type { ActiveGraphApproval } from '../approvals';

/**
 * What happened, as one record (FB-132).
 *
 * The standard is the design's own line: *"Sent, failed, refused: it stays here with its state."* A
 * log that quietly drops failures is worse than no log, because it teaches a founder that silence
 * means nothing happened. Most of these tests are about what must NOT be filtered out.
 */

const event = (over: Partial<ActivityEvent> = {}): ActivityEvent => ({
  kind: 'commit',
  repo: 'arca',
  title: 'Show set names on card pages',
  url: 'https://github.com/wealthcx01/arca/commit/abc',
  at: '2026-08-20T10:00:00.000Z',
  ...over,
} as ActivityEvent);

const run = (over: Partial<RunReport> = {}): RunReport => ({
  laneId: 'arca',
  repo: 'arca',
  startedAt: '2026-08-21T10:00:00.000Z',
  endedAt: null,
  trigger: 'scheduled',
  outcome: 'opened-pr',
  summaryMd: 'did a thing',
  ticketsTouched: ['ARCA-1'],
  errorDetail: null,
  prUrl: 'https://github.com/wealthcx01/arca/pull/10',
  isHeartbeat: false,
  ...over,
} as RunReport);

const approval = (over: Partial<ActiveGraphApproval> = {}): ActiveGraphApproval => ({
  id: 'a1',
  kind: 'activegraph',
  ventureId: 'arca',
  repo: 'arca-marketing',
  status: 'granted',
  summary: 'the launch announcement',
  committedAt: '2026-08-22T10:00:00.000Z',
  grantedAt: '2026-08-22T10:00:00.000Z',
  approver: 'john.gallagher@wealthcx.com',
  checks: [],
  ...over,
} as ActiveGraphApproval);

const input = (over: Partial<FeedInput> = {}): FeedInput => ({
  activity: [], runs: [], approvals: [], ...over,
});

describe('a founder can see their own decisions', () => {
  it('shows an approval the moment it is recorded, BY NAME', () => {
    // The thing that has never been on this page. A founder could not see their own yes in the
    // record, which is a strange omission from a page called "what happened".
    //
    // By name and not as "you": under D7 Bruntsfield approves platform changes on a founder's
    // venture, and the first version addressed every decision to whoever was reading — so a founder
    // read "You approved" on a decision they never made.
    const feed = buildFeed(input({ approvals: [approval()] }));
    expect(feed).toHaveLength(1);
    expect(feed[0].text).toBe('john.gallagher@wealthcx.com approved: the launch announcement');
    expect(feed[0].source).toBe('decision');
    expect(feed[0].meta).toContain('a decision');
  });

  it('shows a refusal, named, and in the colour the rest of the studio uses for one', () => {
    // `approvalTone` is the shared vocabulary (`lib/status.ts`): a founder learns a colour once and
    // it holds on every screen. This file had its own table, so the same approval was one colour on
    // the desk and another in the record.
    const feed = buildFeed(input({ approvals: [approval({ status: 'rejected' })] }));
    expect(feed[0].text).toBe('john.gallagher@wealthcx.com sent back: the launch announcement');
    expect(feed[0].tone).toBe('blocked');
  });

  it('does not show a proposal, because nothing has happened yet', () => {
    // It belongs in the queue, where a founder acts on it. Putting it in the history would say
    // something was done when the whole point is that it was not.
    expect(buildFeed(input({ approvals: [approval({ status: 'proposed' })] }))).toEqual([]);
  });

  it('drops a decision it cannot date rather than stamping it with now', () => {
    // A history whose times are invented is not a history.
    expect(buildFeed(input({ approvals: [approval({ committedAt: null, grantedAt: null })] }))).toEqual([]);
  });
});

describe('nothing is filtered for tidiness', () => {
  it('keeps a send that failed, with its state', () => {
    const feed = buildFeed(input({ approvals: [approval({ status: 'failed' })] }));
    expect(feed.some((f) => f.text.includes('Tried and failed to send') && f.tone === 'blocked')).toBe(true);
  });

  it('keeps a lane that gave up, with its reason', () => {
    const feed = buildFeed(input({ runs: [run({ outcome: 'blocked', errorDetail: 'it needs a person' })] }));
    expect(feed).toHaveLength(1);
    expect(feed[0].tone).toBe('blocked');
  });

  it('keeps an approval the studio did not issue, and says so', () => {
    // A grant that does not verify is the one entry nobody wants and everybody needs.
    const feed = buildFeed(input({ approvals: [approval({ status: 'unverified-action', approver: null })] }));
    expect(feed[0].text).toContain('the studio did not issue that approval');
    expect(feed[0].tone).toBe('blocked');
  });
});

describe('an approval and a send are two things that happened', () => {
  it('keeps the approval when the send goes out, at its own time', () => {
    // One row per approval meant "Went out" REPLACED "approved" — so the founder's own yes, the
    // whole point of this ticket, was visible only between the grant and the execution. And it was
    // stamped with the execution's clock, filing a Monday decision under Thursday.
    const feed = buildFeed(input({
      approvals: [approval({
        status: 'executed',
        grantedAt: '2026-08-20T09:00:00.000Z',
        committedAt: '2026-08-23T09:00:00.000Z',
      })],
    }));
    expect(feed).toHaveLength(2);
    expect(feed[0].text).toContain('Went out');
    expect(feed[0].at).toBe('2026-08-23T09:00:00.000Z');
    expect(feed[1].text).toContain('approved');
    expect(feed[1].at).toBe('2026-08-20T09:00:00.000Z');
  });

  it('says "Someone" rather than crediting a name it cannot verify', () => {
    // A name on an unattested grant is a name anyone holding a copy could have written.
    const feed = buildFeed(input({ approvals: [approval({ approver: null })] }));
    expect(feed[0].text.startsWith('Someone ')).toBe(true);
  });
});

describe('what must not be orderable out of sight', () => {
  it('keeps an unverified action past the render cap', () => {
    // Its timestamp comes out of the very grant nobody can verify, so whoever forged it also chose
    // where it sorts: `granted_at: "2020-01-01"` put it at the bottom and the cap cut it entirely.
    const noise = Array.from({ length: 60 }, (_, i) =>
      run({ startedAt: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z` }));
    const forged = approval({
      status: 'unverified-action',
      approver: null,
      committedAt: '2020-01-01T00:00:00.000Z',
    });
    const { items } = build(input({ runs: noise, approvals: [forged], limit: 10 }));
    expect(items.some((f) => f.text.includes('did not issue that approval'))).toBe(true);
  });
});

describe('one record, newest first', () => {
  it('merges all three sources into one order', () => {
    const feed = buildFeed(input({
      activity: [event()],                       // 20 Aug
      runs: [run()],                             // 21 Aug
      approvals: [approval()],                   // 22 Aug
    }));
    expect(feed.map((f) => f.source)).toEqual(['decision', 'run', 'repo']);
  });

  it('does not reshuffle when two things share a second', () => {
    // A feed that reorders itself on refresh is one a founder stops believing.
    const same = '2026-08-20T10:00:00.000Z';
    const a = buildFeed(input({ runs: [run({ startedAt: same }), run({ startedAt: same, summaryMd: 'second' })] }));
    const b = buildFeed(input({ runs: [run({ startedAt: same }), run({ startedAt: same, summaryMd: 'second' })] }));
    expect(a.map((f) => f.text)).toEqual(b.map((f) => f.text));
  });

  it('renders at most what it was asked for', () => {
    const many = Array.from({ length: 50 }, (_, i) => run({ startedAt: `2026-08-${String(i % 28 + 1).padStart(2, '0')}T10:00:00.000Z` }));
    const capped = build(input({ runs: many, limit: 12 }));
    expect(capped.items).toHaveLength(12);
    expect(capped.truncated).toBe(true);
    // And it does not claim truncation when nothing was cut — a small false statement on a page
    // arguing for literal honesty.
    expect(build(input({ runs: many.slice(0, 12), limit: 12 })).truncated).toBe(false);
  });

  it('drops an undateable entry from every source rather than guessing', () => {
    const feed = buildFeed(input({
      activity: [event({ at: 'not a date' })],
      runs: [run({ startedAt: '' })],
      approvals: [approval({ committedAt: 'nonsense', grantedAt: null })],
    }));
    expect(feed).toEqual([]);
  });

  it('never renders a link it cannot form', () => {
    const feed = buildFeed(input({ activity: [event({ url: '' })], runs: [run({ prUrl: null })] }));
    for (const f of feed) expect(f.href ?? null).not.toBe('');
  });
});
