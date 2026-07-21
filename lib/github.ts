/**
 * Server-side GitHub API client (FB-005) — shared by FB-006 (lanes/tickets), FB-007 (attention
 * queue), FB-008 (CI/activity). Git is the source of truth (D2); this is the read path onto it.
 *
 * - Token from `GITHUB_TOKEN` (an org-scoped PAT for v0; the production path is a GitHub App
 *   installation token — documented in the FB-005 PR, wired in FB-009/deploy).
 * - Rate-limit aware: on a primary-rate-limit 403 (`x-ratelimit-remaining: 0`) or a secondary
 *   429, it waits for the reset / `retry-after` and retries up to `maxRetries`; 5xx get backoff.
 * - Never runs in the browser — keep the token server-only.
 */

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubClientOptions {
  token?: string;
  baseUrl?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests (default real timer). */
  sleepImpl?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** Clock source for reset-wait math; injectable for tests. */
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class GitHubClient {
  private readonly token?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly now: () => number;

  constructor(opts: GitHubClientOptions = {}) {
    this.token = opts.token ?? process.env.GITHUB_TOKEN;
    this.baseUrl = (opts.baseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleepImpl = opts.sleepImpl ?? realSleep;
    this.maxRetries = opts.maxRetries ?? 3;
    this.now = opts.now ?? Date.now;
  }

  /** How long to wait before a retry, from `retry-after` (secs) or `x-ratelimit-reset` (epoch secs). */
  private waitMs(headers: Headers, attempt: number): number {
    const retryAfter = headers.get('retry-after');
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
    }
    const reset = headers.get('x-ratelimit-reset');
    if (reset) {
      const resetMs = Number(reset) * 1000;
      // Cap the wait: a primary-rate-limit reset can be tens of minutes out, which would hang the
      // page request. Wait at most 60s, then let the retry fail into a surfaced error state.
      if (Number.isFinite(resetMs)) return Math.min(60_000, Math.max(0, resetMs - this.now()));
    }
    // Fallback: exponential backoff capped at 60s.
    return Math.min(60_000, 1000 * 2 ** attempt);
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let attempt = 0;
    for (;;) {
      const res = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(init?.headers ?? {}),
        },
      });

      const rateLimited =
        res.status === 429 ||
        (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');

      if ((rateLimited || res.status >= 500) && attempt < this.maxRetries) {
        await this.sleepImpl(this.waitMs(res.headers, attempt));
        attempt += 1;
        continue;
      }

      if (!res.ok) {
        throw new GitHubError(`GitHub ${res.status} for ${path}`, res.status);
      }
      return (await res.json()) as T;
    }
  }

  /** Fetch and decode a file's text content, or null if it doesn't exist (404). */
  async getFileContent(repo: string, path: string, ref = 'main'): Promise<string | null> {
    try {
      const data = await this.request<{ content?: string; encoding?: string }>(
        `/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
      );
      if (!data.content) return null;
      return Buffer.from(data.content, (data.encoding as BufferEncoding) ?? 'base64').toString('utf8');
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  /** List a directory's entries (name + type), or [] if it doesn't exist. */
  async listDir(repo: string, path: string, ref = 'main'): Promise<Array<{ name: string; type: string }>> {
    try {
      const data = await this.request<Array<{ name: string; type: string }>>(
        `/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
      );
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
  }
}
