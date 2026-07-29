import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  groupRepoTickets,
  githubTicketFetcher,
  loadVentureTickets,
  clearTicketCache,
  applyStatusInference,
  type RepoTicketFetcher,
} from '../tickets';
import { GitHubClient } from '../github';
import { inferenceKey } from '../attention';
import type { VentureSummary } from '../ventures';

const ticketMd = (id: string, status?: string) =>
  `# ${id} — Test ${id}\n${status ? `**Status:** ${status}\n` : ''}`;

const venture: VentureSummary = {
  id: 'arca',
  name: 'ARCA',
  status: 'active',
  founderName: null,
  founderEmail: null,
  repos: ['arca'],
  vpsHost: null,
  departments: [],
};

describe('groupRepoTickets', () => {
  it('groups tickets by status and counts them', () => {
    const lane = groupRepoTickets('arca', {
      files: [
        { path: 'docs/tickets/AR-1.md', content: ticketMd('AR-1', 'In progress') },
        { path: 'docs/tickets/AR-2.md', content: ticketMd('AR-2', 'Done') },
        { path: 'docs/tickets/AR-3.md', content: ticketMd('AR-3') },
      ],
      error: null,
    });
    expect(lane.total).toBe(3);
    expect(lane.groups['in-progress'].map((t) => t.ticket.id)).toEqual(['AR-1']);
    expect(lane.groups.done.map((t) => t.ticket.id)).toEqual(['AR-2']);
    expect(lane.groups.todo.map((t) => t.ticket.id)).toEqual(['AR-3']);
  });

  it('passes a repo error through, unhidden', () => {
    const lane = groupRepoTickets('x', { files: [], error: 'Repository not found' });
    expect(lane.error).toBe('Repository not found');
    expect(lane.total).toBe(0);
  });

  it('skips non-ticket markdown (a README) instead of rendering a bogus card', () => {
    const lane = groupRepoTickets('r', {
      files: [{ path: 'docs/tickets/readme.md', content: '# Just a readme' }],
      error: null,
    });
    expect(lane.total).toBe(0);
    expect(lane.skipped).toBe(1);
    expect(Object.values(lane.groups).flat()).toHaveLength(0);
  });

  it('surfaces a warning on a real-but-imperfect ticket (unrecognized status)', () => {
    const lane = groupRepoTickets('r', {
      files: [{ path: 'docs/tickets/RR-1.md', content: '# RR-1 — t\n**Status:** Frobnicated\n' }],
      error: null,
    });
    expect(lane.total).toBe(1);
    expect(lane.skipped).toBe(0);
    const item = Object.values(lane.groups).flat()[0];
    expect(item.warnings.some((w) => w.code === 'unrecognized-status')).toBe(true);
  });
});

describe('applyStatusInference (FB-007 status overlay)', () => {
  const laneOf = (id: string, status: string) =>
    groupRepoTickets('arca', {
      files: [{ path: `docs/tickets/${id}.md`, content: `# ${id} — t\n**Status:** ${status}\n` }],
      error: null,
    });

  it('moves a ticket to the PR-derived status using the same key buildAttention writes', () => {
    const lane = laneOf('ARCA-1', 'In progress');
    expect(lane.groups['in-progress'].map((t) => t.ticket.id)).toEqual(['ARCA-1']);
    // Key built exactly as buildAttention does — catches any separator drift between the two.
    const statusMap = new Map([[inferenceKey('arca', 'ARCA-1'), 'pr-open' as const]]);
    const inferred = applyStatusInference(lane, statusMap);
    expect(inferred.groups['pr-open'].map((t) => t.ticket.id)).toEqual(['ARCA-1']);
    expect(inferred.groups['in-progress']).toHaveLength(0);
  });

  it('does not apply a PR from a DIFFERENT repo to this lane', () => {
    const lane = laneOf('ARCA-1', 'In progress');
    const wrongRepo = new Map([[inferenceKey('other-repo', 'ARCA-1'), 'pr-open' as const]]);
    expect(applyStatusInference(lane, wrongRepo).groups['pr-open']).toHaveLength(0);
    expect(applyStatusInference(lane, wrongRepo).groups['in-progress'].map((t) => t.ticket.id)).toEqual(['ARCA-1']);
  });
});

describe('loadVentureTickets — caching + refresh', () => {
  it('fetches once, then serves from cache within the TTL', async () => {
    clearTicketCache();
    const fetcher: RepoTicketFetcher = vi.fn(async () => ({
      files: [{ path: 'docs/tickets/AR-1.md', content: ticketMd('AR-1') }],
      error: null,
    }));
    let t = 1000;
    const now = () => t;
    const a = await loadVentureTickets(venture, { fetcher, now });
    expect(a.lanes[0].total).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);

    t = 1000 + 60_000; // still within 2-min TTL
    const b = await loadVentureTickets(venture, { fetcher, now });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it('refresh bypasses the cache and TTL expiry refetches', async () => {
    clearTicketCache();
    const fetcher: RepoTicketFetcher = vi.fn(async () => ({ files: [], error: null }));
    let t = 0;
    const now = () => t;
    await loadVentureTickets(venture, { fetcher, now });
    await loadVentureTickets(venture, { fetcher, now, refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(2);

    t = 3 * 60_000; // past the TTL
    await loadVentureTickets(venture, { fetcher, now });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

// FB-021: the live githubTicketFetcher must tell apart "not connected", "can't read this repo",
// "empty backlog", and "rate limit" — a bare 404 otherwise conflates missing with no-access.
describe('githubTicketFetcher — failure states are distinct (FB-021)', () => {
  function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  }
  // Routes /repos meta vs the docs/tickets dir listing vs a file read.
  function routing(repoStatus: number, repoBody: unknown, entries: Array<{ name: string; type: string }> = [], fileContent = '') {
    return vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/contents/docs/tickets/')) {
        return res(200, { content: Buffer.from(fileContent, 'utf8').toString('base64'), encoding: 'base64' });
      }
      if (u.includes('/contents/docs/tickets')) return res(200, entries);
      return res(repoStatus, repoBody);
    });
  }

  beforeEach(() => {
    // Guarantee "no credentials" regardless of the runner's environment.
    vi.stubEnv('GITHUB_TOKEN', '');
    vi.stubEnv('GITHUB_APP_ID', '');
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', '');
    vi.stubEnv('GITHUB_APP_INSTALLATION_ID', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('404 with NO credentials → no-credentials ("not connected"), not "not found"', async () => {
    const client = new GitHubClient({ fetchImpl: routing(404, { message: 'Not Found' }) as unknown as typeof fetch });
    expect(client.hasCredentials()).toBe(false);
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.errorKind).toBe('no-credentials');
    expect(out.error).toMatch(/isn.t connected to GitHub/i);
    expect(out.error).not.toMatch(/not provisioned/i);
    expect(out.files).toEqual([]);
  });

  it('404 WITH credentials → unreadable (missing or no read access)', async () => {
    const client = new GitHubClient({ token: 'pat', fetchImpl: routing(404, { message: 'Not Found' }) as unknown as typeof fetch });
    expect(client.hasCredentials()).toBe(true);
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.errorKind).toBe('unreadable');
    expect(out.error).toMatch(/don.t have read access|doesn.t exist/i);
  });

  it('permission 403 (no rate-limit header) WITH creds → unreadable, NOT rate-limit', async () => {
    // "Resource not accessible by integration": an App/PAT lacking contents:read. A permanent
    // access problem, not a transient rate limit — must not tell the founder to "try refresh".
    const client = new GitHubClient({
      token: 'pat',
      maxRetries: 0,
      sleepImpl: async () => {},
      fetchImpl: vi.fn(async () => res(403, { message: 'Resource not accessible by integration' })) as unknown as typeof fetch,
    });
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.errorKind).toBe('unreadable');
    expect(out.error).not.toMatch(/rate limit|refresh/i);
  });

  it('an unexpected (non-GitHub) error degrades the lane, never blanks the board', async () => {
    // e.g. a malformed App key throwing in the token mint. Must resolve to an error lane, not reject.
    const client = new GitHubClient({
      token: 'pat',
      fetchImpl: vi.fn(async () => {
        throw new TypeError('boom');
      }) as unknown as typeof fetch,
    });
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.errorKind).toBe('error');
    expect(out.files).toEqual([]);
  });

  it('reachable repo with tickets → reads them on the default branch, no error', async () => {
    const client = new GitHubClient({
      token: 'pat',
      fetchImpl: routing(200, { default_branch: 'master' }, [{ name: 'ARCA-1.md', type: 'file' }], ticketMd('ARCA-1', 'Planned')) as unknown as typeof fetch,
    });
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.error).toBeNull();
    expect(out.errorKind ?? null).toBeNull();
    expect(out.ref).toBe('master');
    const lane = groupRepoTickets('arca', out);
    expect(lane.total).toBe(1);
  });

  it('reachable repo with NO docs/tickets → empty backlog (error null, total 0), not an error state', async () => {
    // listDir 404 → [] (no tickets dir yet).
    const fetchImpl = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/contents/docs/tickets')) return res(404, { message: 'Not Found' });
      return res(200, { default_branch: 'master' });
    });
    const client = new GitHubClient({ token: 'pat', fetchImpl: fetchImpl as unknown as typeof fetch });
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.error).toBeNull();
    expect(out.errorKind ?? null).toBeNull();
    const lane = groupRepoTickets('arca', out);
    expect(lane.total).toBe(0);
    expect(lane.error).toBeNull();
  });

  it('rate limit → rate-limit kind (transient), distinct from an access problem', async () => {
    // A 403 with x-ratelimit-remaining:0 is a rate limit; maxRetries:0 makes it surface at once.
    const client = new GitHubClient({
      token: 'pat',
      maxRetries: 0,
      sleepImpl: async () => {},
      fetchImpl: vi.fn(async () => res(403, { message: 'rate limited' }, { 'x-ratelimit-remaining': '0' })) as unknown as typeof fetch,
    });
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.errorKind).toBe('rate-limit');
  });
});
