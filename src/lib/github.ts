// FB-005 — server-side GitHub API client (shared by FB-006/007/008).
//
// The studio is a read/write view over git via the GitHub API (D2). This is the one place that
// talks to GitHub: an org-scoped token from the environment, a rate-limit-aware fetch wrapper, and
// small typed helpers. It runs only on the server (the token never reaches the browser).
//
// Auth decision (documented per FB-005): a classic/fine-grained **PAT** in `GITHUB_TOKEN` is the
// v0 choice — simplest to provision for a single org, sufficient for read-heavy studio traffic.
// A GitHub App (per-install tokens, higher rate limits, finer scopes) is the Phase-2+ upgrade when
// write volume and multi-tenant isolation justify it; the wrapper below is where that swaps in.

const GITHUB_API = "https://api.github.com";

export interface GitHubError {
  status: number;
  message: string;
  rateLimited: boolean;
}

export class GitHubApiError extends Error {
  status: number;
  rateLimited: boolean;
  constructor(info: GitHubError) {
    super(info.message);
    this.name = "GitHubApiError";
    this.status = info.status;
    this.rateLimited = info.rateLimited;
  }
}

function token(): string | null {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

/** The org the studio reads venture repos from. */
export function githubOrg(): string {
  return process.env.GITHUB_ORG?.trim() || "wealthcx01";
}

export interface RateLimit {
  remaining: number | null;
  limit: number | null;
  resetAt: Date | null;
}

function readRateLimit(res: Response): RateLimit {
  const num = (h: string) => {
    const v = res.headers.get(h);
    return v === null ? null : Number(v);
  };
  const reset = num("x-ratelimit-reset");
  return {
    remaining: num("x-ratelimit-remaining"),
    limit: num("x-ratelimit-limit"),
    resetAt: reset === null ? null : new Date(reset * 1000),
  };
}

export interface GitHubResponse<T> {
  data: T;
  rateLimit: RateLimit;
}

/**
 * GET a GitHub REST path (e.g. `/repos/{org}/{repo}/contents/docs/tickets`). Adds auth + version
 * headers, surfaces rate-limit state, and throws a typed error (flagging 403/429 rate limits) so
 * callers can render an honest "rate-limited" state instead of a blank screen (FB-006/007/008).
 *
 * `retries` retries once on a rate-limit or 5xx after a short, bounded wait — enough to ride out a
 * transient secondary-rate-limit blip without hammering the API.
 */
export async function githubGet<T>(
  path: string,
  init: RequestInit = {},
  retries = 1,
): Promise<GitHubResponse<T>> {
  const t = token();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (t) headers.Authorization = `Bearer ${t}`;

  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, { ...init, headers });
  const rateLimit = readRateLimit(res);

  if (res.ok) {
    return { data: (await res.json()) as T, rateLimit };
  }

  const rateLimited =
    (res.status === 403 || res.status === 429) && rateLimit.remaining === 0;

  // One bounded retry for rate-limit / transient 5xx.
  if (retries > 0 && (rateLimited || res.status >= 500)) {
    const waitMs = rateLimited ? backoffUntil(rateLimit.resetAt) : 1000;
    await sleep(Math.min(waitMs, 5000));
    return githubGet<T>(path, init, retries - 1);
  }

  let message = `GitHub ${res.status} for ${path}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) message = body.message;
  } catch {
    // non-JSON error body; keep the default message
  }
  throw new GitHubApiError({ status: res.status, message, rateLimited });
}

function backoffUntil(resetAt: Date | null): number {
  if (!resetAt) return 1000;
  return Math.max(0, resetAt.getTime() - Date.now());
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Whether a usable token is configured (studio can degrade gracefully when not). */
export function hasGithubToken(): boolean {
  return token() !== null;
}
