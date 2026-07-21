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
import { join } from 'node:path';
import { loadVentures, type VentureSummary } from './ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from './authz';
import { GitHubClient, GitHubError } from './github';

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
}

export type PrCiStatus = 'success' | 'failure' | 'pending' | 'unknown';

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
  ciStatus: PrCiStatus;
  /** Vercel preview — the primary click target when present (parity §3). Wired in FB-009. */
  previewUrl: string | null;
}

export interface RepoPrs {
  prs: RawPr[];
  error: string | null;
}

export type RepoPrFetcher = (repo: string) => Promise<RepoPrs>;

// Case-insensitive so a lowercase branch (`fb-007-x`, `grs-0147b-x`) matches; canonicalized to the
// contract form (uppercase prefix, lowercase suffix) so `FB-007` and `fb-007` resolve identically.
const TICKET_ID = /([A-Za-z]{2,})-(\d+)([A-Za-z]?)/;

function canonicalId(m: RegExpMatchArray): string {
  return `${m[1].toUpperCase()}-${m[2]}${m[3].toLowerCase()}`;
}

/** Extract a linked ticket id from a PR's branch (e.g. `fb-007-x`) or title (`FB-007: …`). */
export function linkedTicketId(pr: { branch: string; title: string }): string | null {
  const fromBranch = pr.branch.match(TICKET_ID);
  if (fromBranch) return canonicalId(fromBranch);
  const fromTitle = pr.title.match(TICKET_ID);
  return fromTitle ? canonicalId(fromTitle) : null;
}

function toApproval(ventureId: string, repo: string, pr: RawPr, now: number): PrApproval {
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
    linkedTicketId: linkedTicketId(pr),
    ciStatus: pr.ciStatus ?? 'unknown',
    previewUrl: pr.previewUrl ?? null,
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
): { approvals: PrApproval[]; ticketStatus: Map<string, 'pr-open' | 'done'>; errors: string[] } {
  const approvals: PrApproval[] = [];
  const ticketStatus = new Map<string, 'pr-open' | 'done'>();
  const errors: string[] = [];

  for (const { repo, result } of perRepo) {
    if (result.error) errors.push(`${repo}: ${result.error}`);
    for (const pr of result.prs) {
      const tid = linkedTicketId(pr);
      const key = tid ? inferenceKey(repo, tid) : null;
      if (pr.state === 'open') {
        approvals.push(toApproval(venture.id, repo, pr, now));
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

interface RawGhPr {
  number: number;
  title: string;
  html_url: string;
  user: { login: string } | null;
  created_at: string;
  head: { ref: string; sha: string };
  state: string;
  merged_at: string | null;
  draft?: boolean;
}

/** Live GitHub source: one pulls-list per repo (state=all), plus a combined-status call per OPEN PR. */
export function githubPrFetcher(client: GitHubClient, org: string): RepoPrFetcher {
  return async (repo) => {
    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    try {
      // Two bounded queries: ALL currently-open PRs (the queue + pr-open inference), and the most
      // recently-updated closed PRs (merged→done inference). Never a `created&asc` window that
      // silently drops current open PRs once a repo has >50 lifetime PRs.
      const [open, closed] = await Promise.all([
        client.request<RawGhPr[]>(`/repos/${fullName}/pulls?state=open&per_page=100`),
        client.request<RawGhPr[]>(`/repos/${fullName}/pulls?state=closed&sort=updated&direction=desc&per_page=30`),
      ]);
      const merged = closed.filter((p) => p.merged_at);
      const prs = await Promise.all([...open, ...merged].map((p) => mapGhPr(client, fullName, p)));
      return { prs, error: null };
    } catch (e) {
      if (e instanceof GitHubError) {
        if (e.status === 404) return { prs: [], error: `Repository ${fullName} not found.` };
        if (e.status === 403 || e.status === 429) return { prs: [], error: 'GitHub rate limit hit — try refresh shortly.' };
        return { prs: [], error: `GitHub error ${e.status} listing PRs for ${fullName}.` };
      }
      // A non-HTTP failure (DNS/connection) must NOT propagate — it would 500 every page via the
      // nav badge. Degrade this repo to an error row instead.
      return { prs: [], error: `Could not reach GitHub for ${fullName}.` };
    }
  };
}

async function mapGhPr(client: GitHubClient, fullName: string, p: RawGhPr): Promise<RawPr> {
  const base: RawPr = {
    number: p.number,
    title: p.title,
    url: p.html_url,
    author: p.user?.login ?? null,
    createdAt: p.created_at,
    branch: p.head?.ref ?? '',
    state: p.state === 'open' ? 'open' : 'closed',
    merged: Boolean(p.merged_at),
    previewUrl: null,
  };
  // CI status only for open PRs (the queue items) to bound quota; failure → 'unknown', never a throw.
  if (base.state === 'open' && p.head?.sha) {
    try {
      const status = await client.request<{ state: string }>(`/repos/${fullName}/commits/${p.head.sha}/status`);
      base.ciStatus = mapCombinedStatus(status.state);
    } catch {
      base.ciStatus = 'unknown';
    }
  }
  return base;
}

function mapCombinedStatus(state: string): PrCiStatus {
  if (state === 'success') return 'success';
  if (state === 'failure' || state === 'error') return 'failure';
  if (state === 'pending') return 'pending';
  return 'unknown';
}

/** Offline fixture source (dev / Playwright): reads `<dir>/<repo>.json` as RawPr[]. */
export function fixturePrFetcher(dir: string): RepoPrFetcher {
  return async (repo) => {
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
}

const cache = new Map<string, VentureAttention>();

export function clearAttentionCache(): void {
  cache.clear();
}

export async function loadVentureAttention(
  venture: VentureSummary,
  opts: { fetcher?: RepoPrFetcher; refresh?: boolean; now?: () => number } = {},
): Promise<VentureAttention> {
  const now = opts.now ?? Date.now;
  const cached = cache.get(venture.id);
  if (!opts.refresh && cached && now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const fetcher = opts.fetcher ?? defaultPrFetcher();
  const perRepo = await Promise.all(
    venture.repos.map(async (repo) => ({ repo, result: await fetcher(repo) })),
  );
  const { approvals, ticketStatus, errors } = buildAttention(venture, perRepo, now());
  const result: VentureAttention = { ventureId: venture.id, approvals, ticketStatus, errors, fetchedAt: now() };
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
  opts: { fetcher?: RepoPrFetcher; refresh?: boolean; now?: () => number } = {},
): Promise<AccessibleAttention> {
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const visible = ventures.filter((v) => canAccessVenture(access, v.id));
  const results = await Promise.all(visible.map((v) => loadVentureAttention(v, opts)));
  const approvals = results.flatMap((r) => r.approvals).sort((a, b) => b.ageMs - a.ageMs);
  const ventureNames: Record<string, string> = {};
  for (const v of visible) ventureNames[v.id] = v.name;
  return { approvals, ventureNames, errors: results.flatMap((r) => r.errors) };
}
