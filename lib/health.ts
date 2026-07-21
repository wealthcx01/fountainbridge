/**
 * Lane health + activity (FB-008). Completes the read-only studio: at a glance, is every lane of a
 * venture healthy, and what shipped recently. Also the first surface for spotting silent lane death
 * (a founder must never wonder whether their agents are actually working — CLAUDE.md #10).
 *
 * Per repo: latest CI run on the default branch, branch-protection state, a 14-day activity feed
 * (merged PRs, CI failures, commits), and a staleness flag (no activity in N days). The staleness
 * threshold is a default here; a per-lane manifest override needs a new field in the FB-002 Venture
 * schema (`additionalProperties:false` forbids unknown keys) — tracked as a follow-up, not forced in.
 *
 * Fetch source is injectable so computation is unit-tested offline and Playwright runs against
 * fixtures (`HEALTH_FIXTURE_DIR`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVentures, type VentureSummary } from './ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from './authz';
import { GitHubClient, GitHubError } from './github';

export const DEFAULT_STALE_DAYS = 7;
const ACTIVITY_WINDOW_MS = 14 * 86_400_000;

export type RunConclusion = 'success' | 'failure' | 'cancelled' | 'in_progress' | 'unknown';
export type ActivityKind = 'pr-merged' | 'ci-failed' | 'commit';

export interface LatestRun {
  conclusion: RunConclusion;
  url: string;
  createdAt: string;
}

export interface ActivityEvent {
  kind: ActivityKind;
  repo: string;
  title: string;
  url: string;
  at: string; // ISO
}

/** What a fetch source yields for one repo. */
export interface RepoHealthRaw {
  defaultBranch: string;
  protected: boolean;
  latestRun: LatestRun | null;
  activity: ActivityEvent[];
  error: string | null;
}

export interface RepoHealth extends RepoHealthRaw {
  repo: string;
  lastActivityMs: number | null;
  stale: boolean;
}

export interface VentureHealth {
  ventureId: string;
  repos: RepoHealth[];
  /** Merged, most-recent-first activity across all the venture's repos (14-day window). */
  activity: ActivityEvent[];
  fetchedAt: number;
}

export type RepoHealthFetcher = (repo: string) => Promise<RepoHealthRaw>;

function latestMs(...isoOrNull: Array<string | null | undefined>): number | null {
  let best: number | null = null;
  for (const v of isoOrNull) {
    if (!v) continue;
    const t = Date.parse(v);
    if (Number.isFinite(t) && (best === null || t > best)) best = t;
  }
  return best;
}

/** Compute a repo's health from raw data. Pure — the heart of FB-008. Tolerant of a partial
 * fetch/fixture object: missing fields default rather than crash the page. */
export function buildRepoHealth(
  repo: string,
  raw: RepoHealthRaw,
  now: number,
  staleDays: number = DEFAULT_STALE_DAYS,
): RepoHealth {
  const activity = Array.isArray(raw.activity) ? raw.activity : [];
  const latestRun = raw.latestRun ?? null;
  const error = raw.error ?? null;
  const lastActivityMs = latestMs(latestRun?.createdAt ?? null, ...activity.map((a) => a.at));
  // A repo we couldn't read isn't "stale" (that would be a false alarm) — its error is surfaced instead.
  const stale = error ? false : lastActivityMs === null || now - lastActivityMs > staleDays * 86_400_000;
  return {
    repo,
    defaultBranch: raw.defaultBranch ?? 'main',
    protected: Boolean(raw.protected),
    latestRun,
    activity,
    error,
    lastActivityMs,
    stale,
  };
}

// --- fetchers -------------------------------------------------------------------------------

interface GhRun {
  conclusion: string | null;
  status: string;
  html_url: string;
  created_at: string;
  name?: string;
}
interface GhPr {
  title: string;
  html_url: string;
  merged_at: string | null;
}
interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { date?: string } };
}

function mapConclusion(run: GhRun): RunConclusion {
  if (run.status !== 'completed') return 'in_progress';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure') return 'failure';
  if (run.conclusion === 'cancelled') return 'cancelled';
  return 'unknown';
}

/** Live GitHub source: default branch, protection, latest run, 14-day activity. */
export function githubHealthFetcher(client: GitHubClient, org: string): RepoHealthFetcher {
  return async (repo) => {
    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    // Widen the fetch window to cover the staleness threshold too, so a repo active within
    // STALE_AFTER_DAYS (>14) isn't falsely flagged stale just because the feed window is 14 days.
    const windowMs = Math.max(ACTIVITY_WINDOW_MS, staleDays() * 86_400_000);
    const since = new Date(Date.now() - windowMs).toISOString();
    let defaultBranch = 'main';
    try {
      const info = await client.request<{ default_branch?: string }>(`/repos/${fullName}`);
      if (info.default_branch) defaultBranch = info.default_branch;
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) {
        return { defaultBranch, protected: false, latestRun: null, activity: [], error: `Repository ${fullName} not found.` };
      }
      return { defaultBranch, protected: false, latestRun: null, activity: [], error: `Could not read ${fullName}.` };
    }

    const [isProtected, runs, prs, commits] = await Promise.all([
      client
        .request(`/repos/${fullName}/branches/${defaultBranch}/protection`)
        .then(() => true)
        .catch(() => false),
      client
        .request<{ workflow_runs?: GhRun[] }>(`/repos/${fullName}/actions/runs?branch=${defaultBranch}&per_page=20`)
        .then((r) => r.workflow_runs ?? [])
        .catch(() => [] as GhRun[]),
      client
        .request<GhPr[]>(`/repos/${fullName}/pulls?state=closed&sort=updated&direction=desc&per_page=30`)
        .catch(() => [] as GhPr[]),
      client
        .request<GhCommit[]>(`/repos/${fullName}/commits?sha=${defaultBranch}&since=${since}&per_page=30`)
        .catch(() => [] as GhCommit[]),
    ]);

    const latestRun: LatestRun | null = runs[0]
      ? { conclusion: mapConclusion(runs[0]), url: runs[0].html_url, createdAt: runs[0].created_at }
      : null;

    const activity: ActivityEvent[] = [];
    for (const r of runs) {
      if (mapConclusion(r) === 'failure' && r.created_at >= since) {
        activity.push({ kind: 'ci-failed', repo, title: r.name ?? 'CI run failed', url: r.html_url, at: r.created_at });
      }
    }
    for (const p of prs) {
      if (p.merged_at && p.merged_at >= since) {
        activity.push({ kind: 'pr-merged', repo, title: p.title, url: p.html_url, at: p.merged_at });
      }
    }
    for (const c of commits) {
      const at = c.commit?.author?.date;
      if (at && at >= since) {
        activity.push({ kind: 'commit', repo, title: c.commit?.message?.split('\n')[0] ?? '(no message)', url: c.html_url, at });
      }
    }
    activity.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

    return { defaultBranch, protected: isProtected, latestRun, activity, error: null };
  };
}

/** Offline fixture source: reads `<dir>/<repo>.json` as RepoHealthRaw. */
export function fixtureHealthFetcher(dir: string): RepoHealthFetcher {
  return async (repo) => {
    const empty: RepoHealthRaw = { defaultBranch: 'main', protected: false, latestRun: null, activity: [], error: null };
    // Guard against a manifest repo name escaping the fixture dir (path traversal).
    if (repo.includes('/') || repo.includes('..')) return empty;
    try {
      return JSON.parse(readFileSync(join(dir, `${repo}.json`), 'utf8')) as RepoHealthRaw;
    } catch {
      return empty;
    }
  };
}

export function defaultHealthFetcher(): RepoHealthFetcher {
  const fixtureDir = process.env.HEALTH_FIXTURE_DIR;
  if (fixtureDir) return fixtureHealthFetcher(fixtureDir);
  const org = process.env.GITHUB_ORG ?? 'wealthcx01';
  return githubHealthFetcher(new GitHubClient(), org);
}

// --- cache + top-level loads ----------------------------------------------------------------

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, VentureHealth>();

export function clearHealthCache(): void {
  cache.clear();
}

function staleDays(): number {
  const raw = Number(process.env.STALE_AFTER_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALE_DAYS;
}

export async function loadVentureHealth(
  venture: VentureSummary,
  opts: { fetcher?: RepoHealthFetcher; refresh?: boolean; now?: () => number } = {},
): Promise<VentureHealth> {
  const now = opts.now ?? Date.now;
  const cached = cache.get(venture.id);
  if (!opts.refresh && cached && now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const fetcher = opts.fetcher ?? defaultHealthFetcher();
  const days = staleDays();
  const repos = await Promise.all(
    venture.repos.map(async (repo) => buildRepoHealth(repo, await fetcher(repo), now(), days)),
  );
  const activity = repos.flatMap((r) => r.activity).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const result: VentureHealth = { ventureId: venture.id, repos, activity, fetchedAt: now() };
  cache.set(venture.id, result);
  return result;
}

export interface AccessibleHealth {
  ventures: Array<{ id: string; name: string; health: VentureHealth }>;
  activity: ActivityEvent[];
}

/** Health + a merged activity feed across every venture an identity can access (scoped server-side). */
export async function loadAccessibleHealth(
  email: string,
  opts: { fetcher?: RepoHealthFetcher; refresh?: boolean; now?: () => number } = {},
): Promise<AccessibleHealth> {
  const all = loadVentures();
  const access = authorizeVentures(email, all, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const visible = all.filter((v) => canAccessVenture(access, v.id));
  const ventures = await Promise.all(
    visible.map(async (v) => ({ id: v.id, name: v.name, health: await loadVentureHealth(v, opts) })),
  );
  const activity = ventures.flatMap((v) => v.health.activity).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { ventures, activity };
}
