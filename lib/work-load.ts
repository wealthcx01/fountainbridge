/**
 * Loading one piece of work from GitHub (FB-064).
 *
 * Split from lib/work.ts for the same reason lib/budgets-load.ts is split from lib/budgets.ts: the
 * pure half — classification, readability, the accept decision — is imported by a client component,
 * and a module that reaches for the network cannot be.
 */

import type { GitHubClient } from './github';
import type { VentureSummary } from './ventures';
import { approvalRepos } from './venture-repos';
import { classify, isReadable, readableAdditions, type ChangedFile, type WorkItem } from './work';
import type { PrCiStatus } from './attention';

/** Injectable, so the view is testable and the UI gate can run offline. */
export interface WorkSource {
  get(repo: string, number: number): Promise<{
    number: number; title: string; body: string | null; state: string; merged: boolean;
    mergeable: boolean | null; author: string | null; createdAt: string; headSha: string;
  } | null>;
  files(repo: string, number: number): Promise<Array<{ path: string; added: number; removed: number; patch?: string }>>;
  checks(repo: string, sha: string): Promise<PrCiStatus>;
}

export function githubWorkSource(client: GitHubClient): WorkSource {
  return {
    async get(repo, number) {
      const pr = await client.getPullRequest(repo, number);
      if (!pr) return null;
      return {
        number: pr.number, title: pr.title, body: pr.body, state: pr.state,
        merged: pr.merged, mergeable: pr.mergeable,
        author: pr.user?.login ?? null, createdAt: pr.created_at, headSha: pr.head.sha,
      };
    },
    async files(repo, number) {
      const files = await client.listPullFiles(repo, number);
      return files.map((f) => ({ path: f.filename, added: f.additions, removed: f.deletions, patch: f.patch }));
    },
    async checks(repo, sha) {
      try {
        const s = await client.request<{ state: string }>(`/repos/${repo}/commits/${sha}/status`);
        if (s.state === 'success') return 'success';
        if (s.state === 'failure' || s.state === 'error') return 'failure';
        if (s.state === 'pending') return 'pending';
        return 'unknown';
      } catch {
        // A checks read that fails must not present as "no checks" — that would let the accept path
        // treat an unknown state as a pass.
        return 'unknown';
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
    author: pr.author,
    createdAt: pr.createdAt,
    checks: pr.merged || pr.state !== 'open' ? 'unknown' : await source.checks(repo, pr.headSha),
    previewUrl: null,
    merged: pr.merged,
    state: pr.state === 'open' ? 'open' : 'closed',
    mergeable: pr.mergeable,
    headSha: pr.headSha,
    files,
    moreFiles: Math.max(0, raw.length - RENDER_CAP),
  };
}
