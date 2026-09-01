/**
 * Attention queue (FB-007): the one funnel for everything needing a human. v0 = the engineering
 * gate — open PRs across a venture's manifest repos (the workshop never merges, so every open PR
 * is by definition awaiting a human). Modeled as `Approval(kind='pr')` so later gate kinds
 * (GTM/ActiveGraph, post-FB-012) are additive, not a rewrite.
 *
 * Also derives ticket status from PR state (open PR → `pr-open`, merged → `done`) for FB-006's
 * views — one PR-list pass per repo, cached, so statuses update without an API-quota blowout.
 *
 * The fetch source is injectable so mapping/linking/inference are unit-tested without network, and
 * Playwright/dev run against local fixtures (`PRS_FIXTURE_DIR`).
 */

import { readFileSync } from 'node:fs';
import { failIfFaulted } from './read-faults';
import { join } from 'node:path';
import { loadVentures, type VentureSummary } from './ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from './authz';
import { GitHubClient, GitHubError } from './github';
// The type lives here, the combining logic lives with the founder-facing gate that depends on it
// being right. `import type` above means there is no runtime cycle.
import { previewUrlFrom } from './work';
import { linkedTicketId, matchWorkToTicket, type MatchableTicket } from './ticket-match';

/** A raw PR as our source yields it — the minimum the queue and inference need. */
export interface RawPr {
  number: number;
  title: string;
  url: string;
  author: string | null;
  createdAt: string; // ISO
  branch: string;
  state: 'open' | 'closed';
  merged: boolean;
  ciStatus?: PrCiStatus;
  previewUrl?: string | null;
  /**
   * The head commit, when the query carried one (FB-129).
   *
   * It rides on the GraphQL query that was already being made — `commits(last: 1) { commit { oid } }`
   * was fetched for the check rollup and thrown away. It exists so a founder deciding from the
   * Tickets screen accepts the commit they were shown: `acceptWork`'s `seenHeadSha` refuses when
   * something has been pushed since the page rendered, and without this that guard was simply not
   * passed from the one screen that is now the primary place decisions are made.
   */
  headSha?: string | null;
  /**
   * Paths this pull request changes (FB-120). Open PRs only, and capped — it exists to tell a
   * ticket FILING (one file under docs/tickets) from everything else, not to describe a diff. It
   * rides on the query that was already being made, so it costs nothing.
   */
  files?: string[];
}

/**
 * `unknown` means "this work has no automatic checks" — a settled fact, nothing to wait for.
 * `unavailable` means "the studio could not find out" — never treat it as either a pass or an
 * absence, because a gate that cannot read its evidence must block rather than guess.
 */
export type PrCiStatus = 'success' | 'failure' | 'pending' | 'unknown' | 'unavailable';

/** An Approval(kind='pr') — a PR awaiting the human gate. */
export interface PrApproval {
  id: string; // `${repo}#${number}`
  kind: 'pr';
  ventureId: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  author: string | null;
  createdAt: string;
  ageMs: number;
  linkedTicketId: string | null;
  /** The matched ticket's human title (FB-099). Null when nothing matched. */
  ticketTitle: string | null;
  ciStatus: PrCiStatus;
  /** Vercel preview — the primary click target when present (parity §3). Wired in FB-009. */
  previewUrl: string | null;
  /** The commit the founder is being shown, so accepting can refuse a push that landed since. */
  headSha: string | null;
  /** The branch the work is on. Carried so the trail can name it instead of saying "Work started on ". */
  branch: string | null;
}

export interface RepoPrs {
  prs: RawPr[];
  error: string | null;
}

export type RepoPrFetcher = (repo: string) => Promise<RepoPrs>;

// The id matcher moved to lib/ticket-match (FB-099), which owns every way a piece of work can be
// tied to its ticket. Re-exported so the callers of `linkedTicketId` did not all have to move.
export { linkedTicketId };

function toApproval(
  ventureId: string,
  repo: string,
  pr: RawPr,
  now: number,
  ticket: MatchableTicket | null = null,
): PrApproval {
  const created = Date.parse(pr.createdAt);
  return {
    id: `${repo}#${pr.number}`,
    kind: 'pr',
    ventureId,
    repo,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    createdAt: pr.createdAt,
    ageMs: Number.isFinite(created) ? Math.max(0, now - created) : 0,
    linkedTicketId: ticket?.id ?? linkedTicketId(pr),
    // FB-099: the founder reads the ticket's name, not the branch the lane happened to choose.
    // Null when nothing matched, which the queue then says out loud rather than hiding.
    ticketTitle: ticket?.title ?? null,
    ciStatus: pr.ciStatus ?? 'unknown',
    previewUrl: pr.previewUrl ?? null,
    headSha: pr.headSha ?? null,
    branch: pr.branch || null,
  };
}

/**
 * Map a venture's PRs (all repos) to the open-PR attention queue (oldest-first) plus a
 * ticketId → status map for FB-006 inference. Pure — the heart of FB-007.
 */
/** Inference key: `repo::id` so a ticket id is only regrouped by a PR in its OWN repo (two repos
 * in one venture may share an id namespace). Use `inferenceKey` to read it back. */
export function inferenceKey(repo: string, ticketId: string): string {
  return `${repo}::${ticketId}`;
}

export function buildAttention(
  venture: VentureSummary,
  perRepo: Array<{ repo: string; result: RepoPrs }>,
  now: number,
  /**
   * What the studio knows about this venture's tickets, per repo (FB-099).
   *
   * Optional, and the difference between a board that adds up and one that does not: without it a
   * piece of work is only tied to a ticket when it says the id outright, which the lane's own
   * branches (`foundry/<slug>`) never do. Callers that have already read the tickets pass them;
   * callers that have not get the id-only behaviour, honestly.
   */
  tickets?: ReadonlyMap<string, readonly MatchableTicket[]>,
): { approvals: PrApproval[]; ticketStatus: Map<string, 'pr-open' | 'done'>; errors: string[] } {
  const approvals: PrApproval[] = [];
  const ticketStatus = new Map<string, 'pr-open' | 'done'>();
  const errors: string[] = [];

  for (const { repo, result } of perRepo) {
    if (result.error) errors.push(`${repo}: ${result.error}`);
    const known = tickets?.get(repo) ?? null;
    for (const pr of result.prs) {
      const matched = known ? matchWorkToTicket(pr, known) : null;
      const tid = matched?.id ?? linkedTicketId(pr);
      const key = tid ? inferenceKey(repo, tid) : null;
      if (pr.state === 'open') {
        approvals.push(toApproval(venture.id, repo, pr, now, matched));
        if (key) ticketStatus.set(key, 'pr-open'); // open PR wins for inference
      } else if (pr.merged && key && !ticketStatus.has(key)) {
        ticketStatus.set(key, 'done'); // merged → done, unless an open PR already claimed it
      }
    }
  }
  approvals.sort((a, b) => b.ageMs - a.ageMs); // oldest (largest age) first
  return { approvals, ticketStatus, errors };
}

// --- fetchers -------------------------------------------------------------------------------


/**
 * Every pull request a venture cares about, and their checks, in ONE query (FB-083 extended).
 *
 * The REST version cost two list calls plus **two calls per open pull request** — one for the
 * combined status, one for check runs. On ARCA that is 2 + 28 = 30 requests for one repository.
 * This is one query for 2 points, and it carries the head commit and the check rollup with it.
 *
 * `statusCheckRollup: null` is the honest "no checks at all" case, which is true of a young venture
 * and must not read as a failure — the same distinction FB-064 drew between `unknown` and
 * `unavailable`, kept here rather than re-derived.
 */
const PRS_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    open: pullRequests(states: [OPEN], first: 100, orderBy: {field: CREATED_AT, direction: ASC}) {
      nodes { number title url createdAt state merged headRefName author { login }
        files(first: 20) { nodes { path } }
        commits(last: 1) { nodes { commit { oid
          statusCheckRollup { state
            contexts(first: 100) { nodes {
              __typename
              ... on StatusContext { state description targetUrl }
              ... on CheckRun { conclusion status } } } } } } } }
    }
    recent: pullRequests(states: [MERGED, CLOSED], first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { number title url createdAt state merged headRefName author { login } }
    }
  }
}`;

interface GqlPr {
  number: number; title: string; url: string; createdAt: string;
  state: string; merged: boolean; headRefName: string; author: { login: string } | null;
  files?: { nodes: Array<{ path: string }> } | null;
  commits?: { nodes: Array<{ commit: { oid: string; statusCheckRollup: GqlRollup | null } }> };
}
interface GqlRollup {
  state: string;
  contexts?: { nodes: Array<{ __typename: string; state?: string; description?: string | null; targetUrl?: string | null; conclusion?: string | null; status?: string | null }> };
}

/** GitHub's own roll-up, in the studio's vocabulary. Null means no checks exist — not a failure. */
export function rollupToStatus(rollup: GqlRollup | null | undefined): PrCiStatus {
  if (!rollup) return 'unknown';
  switch (rollup.state) {
    case 'SUCCESS': return 'success';
    case 'FAILURE': case 'ERROR': return 'failure';
    case 'PENDING': case 'EXPECTED': return 'pending';
    default: return 'unknown';
  }
}

function toRawPr(p: GqlPr, ciStatus?: PrCiStatus, previewUrl?: string | null): RawPr {
  return {
    number: p.number,
    title: p.title,
    url: p.url,
    author: p.author?.login ?? null,
    createdAt: p.createdAt,
    branch: p.headRefName ?? '',
    state: p.state === 'OPEN' ? 'open' : 'closed',
    merged: Boolean(p.merged),
    ...(ciStatus ? { ciStatus } : {}),
    ...(p.files ? { files: p.files.nodes.map((f) => f.path) } : {}),
    previewUrl: previewUrl ?? null,
    headSha: p.commits?.nodes?.[0]?.commit?.oid ?? null,
  };
}

/** Live GitHub source: ONE query per repo for every pull request and every check (FB-083). */
export function githubPrFetcher(client: GitHubClient, org: string): RepoPrFetcher {
  return async (repo) => {
    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    try {
      const [owner, name] = fullName.split('/');
      const data = await client.graphql<{ repository: { open: { nodes: GqlPr[] }; recent: { nodes: GqlPr[] } } | null }>(
        PRS_QUERY, { owner, name },
      );
      if (!data.repository) return { prs: [], error: `Repository ${fullName} not found.` };

      const open = data.repository.open.nodes.map((p) => {
        const rollup = p.commits?.nodes?.[0]?.commit?.statusCheckRollup ?? null;
        // The preview link is read from the SAME contexts the rollup carries, so it costs nothing
        // extra — the REST version needed its own `/commits/:sha/status` call for this.
        const preview = previewUrlFrom(
          (rollup?.contexts?.nodes ?? [])
            .filter((c) => c.__typename === 'StatusContext')
            .map((c) => ({ state: c.state?.toLowerCase(), description: c.description, target_url: c.targetUrl })),
        );
        return toRawPr(p, rollupToStatus(rollup), preview);
      });
      // Merged only: a closed-unmerged PR must not move its ticket to `done`.
      const merged = data.repository.recent.nodes.filter((p) => p.merged).map((p) => toRawPr(p));
      return { prs: [...open, ...merged], error: null };
    } catch (e) {
      if (e instanceof GitHubError) {
        if (e.status === 404) return { prs: [], error: `Repository ${fullName} not found.` };
        // `rateLimited` — 429, or a 403 whose remaining budget is genuinely zero — is the ONLY
        // transient case. The previous version called every 403 a rate limit, so a permissions
        // problem was reported to the founder as "try refresh shortly": advice that could never
        // work, offered forever. Measured on 2026-08-01: three repositories showed that message
        // while GitHub was answering `Resource not accessible by integration` with 4,896 requests
        // still in the budget.
        if (e.rateLimited) return { prs: [], error: 'GitHub rate limit hit — try refresh shortly.' };
        if (e.status === 403) {
          return {
            prs: [],
            error: `The studio does not have permission to read ${fullName}. This will not clear on `
              + 'its own — an admin needs to give the Foundry GitHub App access to that repository.',
          };
        }
        return { prs: [], error: `GitHub error ${e.status} listing PRs for ${fullName}.` };
      }
      // A non-HTTP failure (DNS/connection) must NOT propagate — it would 500 every page via the
      // nav badge. Degrade this repo to an error row instead.
      return { prs: [], error: `Could not reach GitHub for ${fullName}.` };
    }
  };
}



/** Offline fixture source (dev / Playwright): reads `<dir>/<repo>.json` as RawPr[]. */
export function fixturePrFetcher(dir: string): RepoPrFetcher {
  return async (repo) => {
    // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
    failIfFaulted('prs');
    try {
      const raw = readFileSync(join(dir, `${repo}.json`), 'utf8');
      return { prs: JSON.parse(raw) as RawPr[], error: null };
    } catch {
      return { prs: [], error: null };
    }
  };
}

export function defaultPrFetcher(): RepoPrFetcher {
  const fixtureDir = process.env.PRS_FIXTURE_DIR;
  if (fixtureDir) return fixturePrFetcher(fixtureDir);
  const org = process.env.GITHUB_ORG ?? 'wealthcx01';
  return githubPrFetcher(new GitHubClient(), org);
}

// --- cache + top-level load -----------------------------------------------------------------

const CACHE_TTL_MS = 2 * 60 * 1000;

export interface VentureAttention {
  ventureId: string;
  approvals: PrApproval[];
  ticketStatus: Map<string, 'pr-open' | 'done'>;
  errors: string[];
  fetchedAt: number;
  /**
   * The raw fetch, kept so the derived view can be rebuilt with ticket knowledge (FB-099).
   *
   * What is CACHED is the network read; what is DERIVED is the matching. Caching the derived view
   * instead would mean whichever page loaded first decided how well the whole studio matched for the
   * next two minutes — the attention queue (which has no tickets to hand) would poison the board.
   */
  perRepo: Array<{ repo: string; result: RepoPrs }>;
}

const cache = new Map<string, VentureAttention>();

export function clearAttentionCache(): void {
  cache.clear();
}

export async function loadVentureAttention(
  venture: VentureSummary,
  opts: {
    fetcher?: RepoPrFetcher;
    refresh?: boolean;
    now?: () => number;
    /** This venture's tickets per repo, when the caller has already read them (FB-099). */
    tickets?: ReadonlyMap<string, readonly MatchableTicket[]>;
  } = {},
): Promise<VentureAttention> {
  const now = opts.now ?? Date.now;
  const cached = cache.get(venture.id);
  const fresh = !opts.refresh && cached && now() - cached.fetchedAt < CACHE_TTL_MS;

  const fetchedAt = fresh ? cached.fetchedAt : now();
  const perRepo = fresh
    ? cached.perRepo
    : await Promise.all(
        venture.repos.map(async (repo) => {
          // A fetcher that THROWS must not take the page with it (FB-137). `RepoPrs` already has an
          // `error` field and both shipped fetchers use it; this is for the ones that do not get
          // the chance — a rate limit, a reset socket. `/attention` was a 500 when one threw.
          try {
            return { repo, result: await (opts.fetcher ?? defaultPrFetcher())(repo) };
          } catch {
            return { repo, result: { prs: [], error: `The studio could not read ${repo} just now.` } };
          }
        }),
      );

  // Derived on every read, from whatever ticket knowledge THIS caller has. The network read is what
  // the cache is for.
  const { approvals, ticketStatus, errors } = buildAttention(venture, perRepo, fetchedAt, opts.tickets);
  const result: VentureAttention = { ventureId: venture.id, approvals, ticketStatus, errors, fetchedAt, perRepo };
  cache.set(venture.id, result);
  return result;
}

export interface AccessibleAttention {
  approvals: PrApproval[];
  ventureNames: Record<string, string>;
  errors: string[];
}

/**
 * The global attention queue for an identity: open PRs across every venture they can access,
 * aggregated oldest-first. Scoping runs here (server-side) — a founder only ever sees their own
 * venture's PRs. Shares the per-venture cache with the venture page's inference load.
 */
export async function loadAccessibleAttention(
  email: string,
  opts: {
    fetcher?: RepoPrFetcher;
    refresh?: boolean;
    now?: () => number;
    /** Ticket knowledge per venture id, so the queue can name work the way the board does (FB-099). */
    ticketsFor?: (venture: VentureSummary) => Promise<ReadonlyMap<string, readonly MatchableTicket[]> | undefined>;
  } = {},
): Promise<AccessibleAttention> {
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const visible = ventures.filter((v) => canAccessVenture(access, v.id));
  const results = await Promise.all(
    visible.map(async (v) => loadVentureAttention(v, { ...opts, tickets: await opts.ticketsFor?.(v) })),
  );
  const approvals = results.flatMap((r) => r.approvals).sort((a, b) => b.ageMs - a.ageMs);
  const ventureNames: Record<string, string> = {};
  for (const v of visible) ventureNames[v.id] = v.name;
  return { approvals, ventureNames, errors: results.flatMap((r) => r.errors) };
}
