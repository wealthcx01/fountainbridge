/**
 * Ticket loading service (FB-006). The data path per D2 (git is the source of truth):
 *   manifest (FB-003) → GitHub contents API (lib/github) → parser (FB-004) → Ticket[], grouped
 *   by status per repo, cached ~2 min with a manual-refresh bypass.
 *
 * The fetch source is injectable (`RepoTicketFetcher`) so the grouping/caching logic is unit-tested
 * without network, and Playwright/dev can run against local fixtures (`TICKETS_FIXTURE_DIR`) instead
 * of live GitHub. Venture SCOPING is enforced by the caller (server component) before this runs —
 * this module never decides access, it only fetches for a repo it's told to.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTicket, looksLikeTicket, type Ticket, type ParseWarning } from '../tools/ticket-parser/src/index';
import type { VentureSummary } from './ventures';
import { GitHubClient, GitHubError } from './github';

export type TicketStatusGroup = 'todo' | 'in-progress' | 'pr-open' | 'done';
export const STATUS_GROUPS: readonly TicketStatusGroup[] = ['todo', 'in-progress', 'pr-open', 'done'];

export interface TicketWithMeta {
  ticket: Ticket;
  warnings: ParseWarning[];
}

export interface LaneTickets {
  repo: string;
  /** The repo's default branch (arca is `master`, not `main`) — for correct GitHub file links. */
  ref: string;
  groups: Record<TicketStatusGroup, TicketWithMeta[]>;
  total: number;
  /** `.md` files in docs/tickets that don't look like tickets (e.g. a README) — surfaced, not shown as cards. */
  skipped: number;
  /** Non-null when the repo couldn't be read (unreachable / rate-limited) — surfaced, not hidden. */
  error: string | null;
}

export interface VentureTickets {
  ventureId: string;
  lanes: LaneTickets[];
  fetchedAt: number;
  totalWarnings: number;
}

export interface RepoTicketFiles {
  files: Array<{ path: string; content: string }>;
  /** Set when the repo itself is unreachable (vs. simply having no tickets). */
  error: string | null;
  /** Default branch the files were read from (for GitHub links). Defaults to 'main'. */
  ref?: string;
}

export type RepoTicketFetcher = (repo: string) => Promise<RepoTicketFiles>;

function emptyGroups(): Record<TicketStatusGroup, TicketWithMeta[]> {
  return { todo: [], 'in-progress': [], 'pr-open': [], done: [] };
}

/** Parse a repo's ticket files into status-grouped lanes. Pure — the heart of the service. */
export function groupRepoTickets(repo: string, fetched: RepoTicketFiles): LaneTickets {
  const groups = emptyGroups();
  let total = 0;
  let skipped = 0;
  for (const file of fetched.files) {
    const result = parseTicket(file.content, { repo, path: file.path });
    // A file that isn't a ticket (e.g. a stray README) is counted as skipped, not rendered as a
    // bogus card — surfaced via the count, never masquerading as a ticket.
    if (!looksLikeTicket(result)) {
      skipped += 1;
      continue;
    }
    groups[result.ticket.status].push({ ticket: result.ticket, warnings: result.warnings });
    total += 1;
  }
  for (const g of STATUS_GROUPS) {
    groups[g].sort((a, b) => a.ticket.id.localeCompare(b.ticket.id, undefined, { numeric: true }));
  }
  return { repo, ref: fetched.ref ?? 'main', groups, total, skipped, error: fetched.error };
}

// --- fetchers -------------------------------------------------------------------------------

/** Live GitHub source: distinguishes "repo unreachable" from "no docs/tickets" (empty queue). */
export function githubTicketFetcher(client: GitHubClient, org: string): RepoTicketFetcher {
  return async (repo) => {
    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    let ref = 'main';
    try {
      // Confirm the repo exists first (so a missing repo reads as an error, not an empty queue)
      // and learn its default branch (arca is `master`).
      const repoData = await client.request<{ default_branch?: string }>(`/repos/${fullName}`);
      if (repoData.default_branch) ref = repoData.default_branch;
    } catch (e) {
      if (e instanceof GitHubError) {
        if (e.status === 404) return { files: [], error: `Repository ${fullName} not found (not provisioned yet?).`, ref };
        if (e.status === 403 || e.status === 429) return { files: [], error: 'GitHub rate limit hit — try refresh shortly.', ref };
        return { files: [], error: `GitHub error ${e.status} reading ${fullName}.`, ref };
      }
      throw e;
    }
    try {
      const entries = await client.listDir(fullName, 'docs/tickets', ref);
      const mdFiles = entries.filter((e) => e.type === 'file' && e.name.endsWith('.md'));
      const files = await Promise.all(
        mdFiles.map(async (e) => {
          const content = (await client.getFileContent(fullName, `docs/tickets/${e.name}`, ref)) ?? '';
          return { path: `docs/tickets/${e.name}`, content };
        }),
      );
      return { files, error: null, ref };
    } catch (e) {
      // A rate-limit / 5xx while listing or reading a file degrades THIS lane to an error state —
      // it never blanks the whole board (Promise.all in loadVentureTickets would otherwise reject).
      if (e instanceof GitHubError) {
        if (e.status === 403 || e.status === 429) return { files: [], error: 'GitHub rate limit hit — try refresh shortly.', ref };
        return { files: [], error: `GitHub error ${e.status} reading ${fullName}/docs/tickets.`, ref };
      }
      throw e;
    }
  };
}

/** Offline fixture source (dev / Playwright): reads `<dir>/<repo>/*.md`. */
export function fixtureTicketFetcher(dir: string): RepoTicketFetcher {
  return async (repo) => {
    const repoDir = join(dir, repo);
    try {
      const names = readdirSync(repoDir).filter((n) => n.endsWith('.md'));
      const files = names.map((n) => ({
        path: `docs/tickets/${n}`,
        content: readFileSync(join(repoDir, n), 'utf8'),
      }));
      return { files, error: null };
    } catch {
      return { files: [], error: null }; // no fixtures for this repo → empty queue
    }
  };
}

/** Pick the configured source: fixtures if `TICKETS_FIXTURE_DIR` is set, else live GitHub. */
export function defaultFetcher(): RepoTicketFetcher {
  const fixtureDir = process.env.TICKETS_FIXTURE_DIR;
  if (fixtureDir) return fixtureTicketFetcher(fixtureDir);
  const org = process.env.GITHUB_ORG ?? 'wealthcx01';
  return githubTicketFetcher(new GitHubClient(), org);
}

// --- cache + top-level load -----------------------------------------------------------------

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, VentureTickets>();

export function clearTicketCache(): void {
  cache.clear();
}

/**
 * Load a venture's tickets (all its repos), grouped by status, cached ~2 min. `refresh: true`
 * bypasses the cache. `now`/`fetcher` are injectable for tests.
 */
export async function loadVentureTickets(
  venture: VentureSummary,
  opts: { fetcher?: RepoTicketFetcher; refresh?: boolean; now?: () => number } = {},
): Promise<VentureTickets> {
  const now = opts.now ?? Date.now;
  const cached = cache.get(venture.id);
  if (!opts.refresh && cached && now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }
  const fetcher = opts.fetcher ?? defaultFetcher();
  const repos = venture.repos.length > 0 ? venture.repos : [];
  const lanes = await Promise.all(repos.map(async (repo) => groupRepoTickets(repo, await fetcher(repo))));
  const totalWarnings = lanes.reduce(
    (sum, lane) => sum + STATUS_GROUPS.reduce((s, g) => s + lane.groups[g].reduce((w, t) => w + t.warnings.length, 0), 0),
    0,
  );
  const result: VentureTickets = { ventureId: venture.id, lanes, fetchedAt: now(), totalWarnings };
  cache.set(venture.id, result);
  return result;
}
