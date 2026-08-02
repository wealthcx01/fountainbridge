import { describe, it, expect, vi } from 'vitest';
import {
  linkedTicketId,
  buildAttention,
  loadVentureAttention,
  clearAttentionCache,
  inferenceKey,
  type RawPr,
  type RepoPrFetcher,
} from '../attention';
import type { VentureSummary } from '../ventures';

const venture: VentureSummary = {
  id: 'arca',
  name: 'ARCA',
  status: 'active',
  founderName: null,
  founderEmail: null,
  repos: ['arca'],
  vpsHost: null,
  departments: [],
  approvalMatrix: [],
};

const NOW = Date.parse('2026-07-21T00:00:00Z');

function pr(number: number, branch: string, title: string, over: Partial<RawPr> = {}): RawPr {
  return {
    number,
    title,
    url: `https://github.com/x/arca/pull/${number}`,
    author: 'dev',
    createdAt: '2026-07-20T00:00:00Z',
    branch,
    state: 'open',
    merged: false,
    ...over,
  };
}

describe('linkedTicketId', () => {
  it('reads a ticket id from the branch', () => {
    expect(linkedTicketId({ branch: 'fb-007-attention', title: 'whatever' })).toBe('FB-007');
    expect(linkedTicketId({ branch: 'grs-0147b-x', title: 'x' })).toBe('GRS-0147b');
  });
  it('falls back to the title', () => {
    expect(linkedTicketId({ branch: 'main', title: 'FB-005: shell + auth' })).toBe('FB-005');
  });
  it('returns null when nothing matches', () => {
    expect(linkedTicketId({ branch: 'hotfix', title: 'quick patch' })).toBeNull();
  });
});

describe('buildAttention', () => {
  it('collects open PRs oldest-first and infers pr-open status', () => {
    const { approvals, ticketStatus } = buildAttention(
      venture,
      [
        {
          repo: 'arca',
          result: {
            prs: [
              pr(2, 'arca-2-newer', 'ARCA-2 newer', { createdAt: '2026-07-20T12:00:00Z' }),
              pr(1, 'arca-1-older', 'ARCA-1 older', { createdAt: '2026-07-19T00:00:00Z' }),
            ],
            error: null,
          },
        },
      ],
      NOW,
    );
    expect(approvals.map((a) => a.number)).toEqual([1, 2]); // oldest first
    expect(approvals[0].id).toBe('arca#1');
    expect(ticketStatus.get(inferenceKey('arca','ARCA-1'))).toBe('pr-open');
    expect(ticketStatus.get(inferenceKey('arca','ARCA-2'))).toBe('pr-open');
  });

  it('infers done from a merged PR, but an open PR wins for the same ticket', () => {
    const { ticketStatus } = buildAttention(
      venture,
      [
        {
          repo: 'arca',
          result: {
            prs: [
              pr(1, 'arca-1', 'ARCA-1', { state: 'closed', merged: true }),
              pr(2, 'arca-2', 'ARCA-2', { state: 'closed', merged: true }),
              pr(3, 'arca-2-again', 'ARCA-2 reopened work', { state: 'open' }),
            ],
            error: null,
          },
        },
      ],
      NOW,
    );
    expect(ticketStatus.get(inferenceKey('arca','ARCA-1'))).toBe('done');
    expect(ticketStatus.get(inferenceKey('arca','ARCA-2'))).toBe('pr-open'); // open beats merged
  });

  it('only open PRs become approvals; errors are collected', () => {
    const { approvals, errors } = buildAttention(
      venture,
      [
        { repo: 'arca', result: { prs: [pr(1, 'arca-1', 'ARCA-1', { state: 'closed', merged: true })], error: null } },
        { repo: 'ghost', result: { prs: [], error: 'Repository ghost not found.' } },
      ],
      NOW,
    );
    expect(approvals).toHaveLength(0); // the only PR is merged, not open
    expect(errors).toEqual(['ghost: Repository ghost not found.']);
  });

  it('scopes inference per repo — a colliding id in another repo does not cross-contaminate', () => {
    const v = { ...venture, repos: ['arca', 'other'] };
    const { ticketStatus } = buildAttention(
      v,
      [
        { repo: 'arca', result: { prs: [pr(1, 'fb-1-x', 'FB-1', { state: 'open' })], error: null } },
        { repo: 'other', result: { prs: [pr(2, 'fb-1-y', 'FB-1', { state: 'closed', merged: true })], error: null } },
      ],
      NOW,
    );
    expect(ticketStatus.get(inferenceKey('arca', 'FB-1'))).toBe('pr-open');
    expect(ticketStatus.get(inferenceKey('other', 'FB-1'))).toBe('done'); // not overwritten by arca's
  });

  it('a malformed createdAt yields age 0, not NaN', () => {
    const { approvals } = buildAttention(
      venture,
      [{ repo: 'arca', result: { prs: [pr(1, 'arca-1', 'ARCA-1', { createdAt: 'not-a-date' })], error: null } }],
      NOW,
    );
    expect(approvals[0].ageMs).toBe(0);
  });
});

describe('loadVentureAttention caching', () => {
  it('caches within TTL and refresh bypasses', async () => {
    clearAttentionCache();
    const fetcher: RepoPrFetcher = vi.fn(async () => ({ prs: [pr(1, 'arca-1', 'ARCA-1')], error: null }));
    let t = 1000;
    const now = () => t;
    const a = await loadVentureAttention(venture, { fetcher, now });
    expect(a.approvals).toHaveLength(1);
    t += 60_000;
    await loadVentureAttention(venture, { fetcher, now });
    expect(fetcher).toHaveBeenCalledTimes(1); // cached
    await loadVentureAttention(venture, { fetcher, now, refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('telling a permissions problem from a rate limit (FB-082)', () => {
  // FB-083: the fetcher asks GraphQL now. The properties under test are unchanged — a permissions
  // failure must never wear a rate limit's words — so only the stubbed method moves.
  const fetcherThrowing = (err: unknown) => async () => { throw err; };

  it('does not call a permissions error a rate limit', async () => {
    // Measured on 2026-08-01: three repositories showed "GitHub rate limit hit — try refresh
    // shortly" while GitHub was answering "Resource not accessible by integration" with 4,896
    // requests still in the budget. The founder was given advice that could never work, forever.
    const { githubPrFetcher } = await import('../attention');
    const { GitHubError } = await import('../github');
    const client = { graphql: fetcherThrowing(new GitHubError('403', 403, false)) } as never;
    const { error } = await githubPrFetcher(client, 'wealthcx01')('arca-marketing');
    expect(error).not.toContain('rate limit');
    expect(error).toContain('does not have permission');
    expect(error).toContain('will not clear on its own');
  });

  it('still calls a real rate limit a rate limit', async () => {
    const { githubPrFetcher } = await import('../attention');
    const { GitHubError } = await import('../github');
    const client = { graphql: fetcherThrowing(new GitHubError('429', 429, true)) } as never;
    const { error } = await githubPrFetcher(client, 'wealthcx01')('arca');
    expect(error).toContain('rate limit');
  });

  it('still says plainly when a repository is missing', async () => {
    const { githubPrFetcher } = await import('../attention');
    const { GitHubError } = await import('../github');
    const client = { graphql: fetcherThrowing(new GitHubError('404', 404, false)) } as never;
    const { error } = await githubPrFetcher(client, 'wealthcx01')('thereset-platform');
    expect(error).toContain('not found');
  });
});


describe('reading GitHub\u2019s own check roll-up (FB-083)', () => {
  it('maps the roll-up into the studio\u2019s vocabulary', async () => {
    const { rollupToStatus } = await import('../attention');
    expect(rollupToStatus({ state: 'SUCCESS' })).toBe('success');
    expect(rollupToStatus({ state: 'FAILURE' })).toBe('failure');
    expect(rollupToStatus({ state: 'ERROR' })).toBe('failure');
    expect(rollupToStatus({ state: 'PENDING' })).toBe('pending');
  });

  it('reads "no checks at all" as unknown, never as a failure', async () => {
    // ARCA has no CI, and its roll-up comes back null. That is the normal state of a young venture
    // and must not read as something being wrong — the same distinction FB-064 drew.
    const { rollupToStatus } = await import('../attention');
    expect(rollupToStatus(null)).toBe('unknown');
    expect(rollupToStatus(undefined)).toBe('unknown');
    expect(rollupToStatus({ state: 'SOMETHING_NEW' })).toBe('unknown');
  });
});
