/**
 * Loading one piece of work from GitHub (FB-064).
 *
 * Split from lib/work.ts for the same reason lib/budgets-load.ts is split from lib/budgets.ts: the
 * pure half — classification, readability, the accept decision — is imported by a client component,
 * and a module that reaches for the network cannot be.
 */

import { parseTicket, looksLikeTicket } from '../tools/ticket-parser/src/index';
import type { GitHubClient } from './github';
import type { VentureSummary } from './ventures';
import { approvalRepos } from './venture-repos';
import { classify, combineChecks, isReadable, readableAdditions, previewUrlFrom, type ChangedFile, type WorkItem } from './work';
import type { PrCiStatus } from './attention';

/** Injectable, so the view is testable and the UI gate can run offline. */
export interface WorkSource {
  get(repo: string, number: number): Promise<{
    number: number; title: string; body: string | null; state: string; merged: boolean;
    mergeable: boolean | null; author: string | null; createdAt: string; headSha: string;
    /** Every file the work changed, not just the page of them we fetched. */
    changedFiles: number;
    /** Where this work lives on the code host, for the reference link. */
    url: string | null;
  } | null>;
  files(repo: string, number: number): Promise<Array<{ path: string; added: number; removed: number; patch?: string }>>;
  /**
   * One file's whole text at a commit. Used for the ticket this work came from (FB-107) — a diff of
   * a ticket is not the ask, and the ask is the first thing the page has to show.
   */
  file(repo: string, path: string, ref: string): Promise<string | null>;
  checks(repo: string, sha: string): Promise<PrCiStatus>;
  /** Where the work can be seen running, when a deployment advertised one. */
  preview(repo: string, sha: string): Promise<string | null>;
}

/**
 * `org` qualifies a short repo name before it reaches GitHub.
 *
 * A venture manifest declares repos by short name (`arca`), because that is what a founder would
 * recognise — but the API needs `wealthcx01/arca`. `lib/attention.ts` has always done this; this
 * loader did not, so every live lookup asked GitHub for `/repos/arca/pulls/23` and got a 404. The
 * fixture path hid it completely: a fixture keys on whatever string it is handed, so the tests and
 * the UI gate both passed while the real thing could not find a single piece of work.
 */
export function githubWorkSource(client: GitHubClient, org = process.env.GITHUB_ORG ?? 'wealthcx01'): WorkSource {
  const full = (repo: string) => (repo.includes('/') ? repo : `${org}/${repo}`);
  return {
    async get(repo, number) {
      const pr = await client.getPullRequest(full(repo), number);
      if (!pr) return null;
      return {
        number: pr.number, title: pr.title, body: pr.body, state: pr.state,
        merged: pr.merged, mergeable: pr.mergeable,
        author: pr.user?.login ?? null, createdAt: pr.created_at, headSha: pr.head.sha,
        changedFiles: pr.changed_files ?? 0,
        url: pr.html_url ?? null,
      };
    },
    async file(repo, path, ref) {
      try {
        return await client.getFileContent(full(repo), path, ref);
      } catch {
        return null; // no ask is a state the page renders honestly; it is never a broken page
      }
    },
    async files(repo, number) {
      const files = await client.listPullFiles(full(repo), number);
      return files.map((f) => ({ path: f.filename, added: f.additions, removed: f.deletions, patch: f.patch }));
    },
    async preview(repo, sha) {
      try {
        const s = await client.request<{ statuses?: Array<{ state?: string; description?: string | null; target_url?: string | null }> }>(
          `/repos/${full(repo)}/commits/${sha}/status`,
        );
        return previewUrlFrom(s.statuses ?? []);
      } catch {
        return null; // no deployment is the normal case for a venture repo, not an error
      }
    },
    async checks(repo, sha) {
      try {
        // Both systems, because neither one can see the other. See combineChecks for what each
        // endpoint knows and what reading only one of them got wrong.
        const [combined, runs] = await Promise.all([
          client.request<{ state: string; total_count?: number }>(`/repos/${full(repo)}/commits/${sha}/status`),
          // per_page=100 is the API maximum; the client does not paginate, and 30 (the default) is
          // within reach of a repo with a few workflows.
          client.request<{ total_count?: number; check_runs?: Array<{ status: string; conclusion: string | null }> }>(
            `/repos/${full(repo)}/commits/${sha}/check-runs?per_page=100`,
          ),
        ]);
        const checkRuns = runs.check_runs ?? [];
        return combineChecks({
          combined: { state: combined.state, total: combined.total_count ?? 0 },
          checkRuns,
          checkRunsTruncated: (runs.total_count ?? checkRuns.length) > checkRuns.length,
        });
      } catch {
        // A checks read that fails must not present as "no checks" — that would let the accept path
        // treat a failed read as a pass. `unavailable` blocks; `unknown` does not.
        return 'unavailable';
      }
    },
  };
}

/** Pull the ticket id out of the branch or title the lane produced, when there is one. */
export function ticketIdFrom(title: string, branch?: string): string | null {
  const fromBranch = branch?.match(/^foundry\/(.+)$/)?.[1];
  if (fromBranch) return fromBranch;
  const m = title.match(/\b([A-Z]{2,}-\d+)\b/);
  return m ? m[1] : null;
}

const RENDER_CAP = 12;

/**
 * Drop the ticket's own `# ARCA-44 — Title` line.
 *
 * The body keeps the heading the file opens with, and the page shows the title above it — so the ask
 * rendered its own name twice, the second time as a page-level heading competing with the work's.
 * Two `<h1>`s on one page is also two answers to "what is this page about".
 */
export function withoutTitleHeading(bodyMd: string): string {
  return bodyMd.replace(/^\s*#\s+[^\n]*\n+/, '');
}

/**
 * The ticket this work came from, read whole (FB-107).
 *
 * Read from the work's OWN head commit rather than from the default branch, so the ask a founder
 * reads is the version this work was written against — a ticket edited on main since would describe
 * something else, and "is this what I asked for?" is the question the whole page is arranged around.
 *
 * One extra request, and only when the work actually carries its ticket. When it does not, the page
 * says so rather than showing a diff fragment and calling it the ask.
 */
async function loadAsk(
  repo: string,
  files: ChangedFile[],
  ref: string,
  source: WorkSource,
): Promise<WorkItem['ask']> {
  const ticketFile = files.find((f) => f.kind === 'description');
  if (!ticketFile) return null;
  const content = await source.file(repo, ticketFile.path, ref);
  if (!content) return null;
  const parsed = parseTicket(content, { repo, path: ticketFile.path });
  // A file under docs/tickets/ that does not parse as a ticket is not an ask. Showing its raw text
  // under "What you asked for" would be the same fault this replaced, one level up.
  if (!looksLikeTicket(parsed)) return null;
  return { id: parsed.ticket.id, title: parsed.ticket.title, bodyMd: withoutTitleHeading(parsed.ticket.body_md) };
}

/**
 * Load one piece of work for the founder-facing view.
 *
 * Returns null when it does not exist or the repo is not one of this venture's — the caller turns
 * that into "that work is not here", never into a partially-rendered page.
 */
export async function loadWork(
  venture: VentureSummary,
  repo: string,
  number: number,
  source: WorkSource,
): Promise<WorkItem | null> {
  if (!approvalRepos(venture).includes(repo)) return null;
  const pr = await source.get(repo, number);
  if (!pr) return null;

  const raw = await source.files(repo, number);
  const files: ChangedFile[] = raw.slice(0, RENDER_CAP).map((f) => {
    const kind = classify(f.path);
    return {
      path: f.path, kind, added: f.added, removed: f.removed,
      preview: isReadable(kind) ? readableAdditions(f.patch) : null,
    };
  });

  return {
    repo,
    number: pr.number,
    title: pr.title,
    ticketId: ticketIdFrom(pr.title),
    description: pr.body?.trim() || null,
    author: pr.author,
    createdAt: pr.createdAt,
    checks: pr.merged || pr.state !== 'open' ? 'unknown' : await source.checks(repo, pr.headSha),
    previewUrl: pr.state === 'open' ? await source.preview(repo, pr.headSha) : null,
    merged: pr.merged,
    state: pr.state === 'open' ? 'open' : 'closed',
    mergeable: pr.mergeable,
    headSha: pr.headSha,
    files,
    // Counted from GitHub's total, not from the page we fetched — `listPullFiles` stops at 50, so
    // a 300-file change would otherwise announce itself as a 50-file one.
    moreFiles: Math.max(0, Math.max(pr.changedFiles, raw.length) - files.length),
    ask: await loadAsk(repo, files, pr.headSha, source),
    url: pr.url,
  };
}
