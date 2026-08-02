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
  approvalMatrix: [],
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
    // FB-083: one GraphQL query now carries the branch, the listing and every file's text. The
    // property under test is unchanged — this stubs the new call rather than the old three.
    const client = new GitHubClient({
      token: 'pat',
      fetchImpl: (async () => res(200, {
        data: {
          repository: {
            defaultBranchRef: { name: 'master' },
            object: { entries: [{ name: 'ARCA-1.md', type: 'blob', object: { text: ticketMd('ARCA-1', 'Planned'), isTruncated: false } }] },
          },
        },
      })) as unknown as typeof fetch,
    });
    const out = await githubTicketFetcher(client, 'wealthcx01')('arca');
    expect(out.error).toBeNull();
    expect(out.errorKind ?? null).toBeNull();
    expect(out.ref).toBe('master');
    const lane = groupRepoTickets('arca', out);
    expect(lane.total).toBe(1);
  });

  it('reachable repo with NO docs/tickets → empty backlog (error null, total 0), not an error state', async () => {
    // FB-083: GraphQL answers `object: null` for a repository with no docs/tickets directory —
    // readable, and genuinely empty. That must never read as an error (FB-021).
    const fetchImpl = vi.fn(async () => res(200, {
      data: { repository: { defaultBranchRef: { name: 'master' }, object: null } },
    }));
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

describe('one query for a whole backlog (FB-083)', () => {
  const reply = (entries: unknown[], branch = 'master') => ({
    repository: { defaultBranchRef: { name: branch }, object: { entries } },
  });
  const client = (graphql: unknown, rest?: unknown) => ({
    graphql: async () => graphql,
    getFileContent: rest ?? (async () => null),
    hasCredentials: () => true,
  } as never);

  it('reads every ticket from a single request', async () => {
    // REST cost one call per file: 51 requests for ARCA's 49 tickets, which was the bulk of the 87
    // a board cost. Measured against the live repository, this is one request and one point.
    const { githubTicketFetcher } = await import('../tickets');
    const files = await githubTicketFetcher(client(reply([
      { name: 'A-1.md', type: 'blob', object: { text: '# A-1', isTruncated: false } },
      { name: 'A-2.md', type: 'blob', object: { text: '# A-2', isTruncated: false } },
    ])), 'wealthcx01')('arca');
    expect(files.error).toBeNull();
    expect(files.files.map((f) => f.path)).toEqual(['docs/tickets/A-1.md', 'docs/tickets/A-2.md']);
    expect(files.files[0].content).toBe('# A-1');
  });

  it('learns the default branch from the same query', async () => {
    // arca is `master`, not `main`, and a wrong ref makes every GitHub file link 404.
    const { githubTicketFetcher } = await import('../tickets');
    expect((await githubTicketFetcher(client(reply([])), 'wealthcx01')('arca')).ref).toBe('master');
  });

  it('ignores directories and non-markdown', async () => {
    const { githubTicketFetcher } = await import('../tickets');
    const r = await githubTicketFetcher(client(reply([
      { name: 'archive', type: 'tree' },
      { name: 'diagram.png', type: 'blob', object: {} },
      { name: 'A-1.md', type: 'blob', object: { text: '# A-1', isTruncated: false } },
    ])), 'wealthcx01')('arca');
    expect(r.files).toHaveLength(1);
  });

  it('refetches a truncated blob instead of treating it as short', async () => {
    // GraphQL declines to inline a blob past ~512KB. A ticket that came back truncated would
    // silently parse as a shorter ticket — the kind of wrong that never announces itself.
    const { githubTicketFetcher } = await import('../tickets');
    const r = await githubTicketFetcher(
      client(reply([{ name: 'big.md', type: 'blob', object: { text: '# cut off', isTruncated: true } }]),
             async () => '# the whole thing'),
      'wealthcx01',
    )('arca');
    expect(r.files[0].content).toBe('# the whole thing');
  });

  it('refetches rather than inventing an empty ticket when text is missing', async () => {
    const { githubTicketFetcher } = await import('../tickets');
    const r = await githubTicketFetcher(
      client(reply([{ name: 'x.md', type: 'blob', object: null }]), async () => '# recovered'),
      'wealthcx01',
    )('arca');
    expect(r.files[0].content).toBe('# recovered');
  });

  it('reads a repo with no docs/tickets as empty, not as broken', async () => {
    const { githubTicketFetcher } = await import('../tickets');
    const r = await githubTicketFetcher(
      client({ repository: { defaultBranchRef: { name: 'main' }, object: null } }), 'wealthcx01',
    )('arca');
    expect(r.error).toBeNull();
    expect(r.files).toEqual([]);
  });

  it('never reads a repo it cannot see as an empty backlog', async () => {
    // The distinction FB-021 exists for. An empty backlog and a repository the studio has no access
    // to must never look the same to a founder.
    const { githubTicketFetcher } = await import('../tickets');
    const r = await githubTicketFetcher(client({ repository: null }), 'wealthcx01')('arca');
    expect(r.error).toContain("Can't read");
    expect(r.errorKind).toBe('unreadable');
  });

  it('degrades this lane rather than blanking the board when the query throws', async () => {
    const { githubTicketFetcher } = await import('../tickets');
    const { GitHubError } = await import('../github');
    const throwing = { graphql: async () => { throw new GitHubError('429', 429, true); }, hasCredentials: () => true } as never;
    const r = await githubTicketFetcher(throwing, 'wealthcx01')('arca');
    expect(r.errorKind).toBe('rate-limit');
  });
});
