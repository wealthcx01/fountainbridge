/**
 * Server-side GitHub API client (FB-005) — shared by FB-006 (lanes/tickets), FB-007 (attention
 * queue), FB-008 (CI/activity). Git is the source of truth (D2); this is the read path onto it.
 *
 * - Auth resolves per request from one of two sources (FB-020):
 *     1. PAT — `GITHUB_TOKEN` / `opts.token` (v0). Static bearer, unchanged.
 *     2. GitHub App — `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` + `GITHUB_APP_INSTALLATION_ID`.
 *        We sign a short-lived RS256 JWT with the App private key, exchange it for an installation
 *        token, and cache it until ~5 min before expiry (App tokens live ~1h). Production path.
 * - Rate-limit aware: on a primary-rate-limit 403 (`x-ratelimit-remaining: 0`) or a secondary
 *   429, it waits for the reset / `retry-after` and retries up to `maxRetries`; 5xx get backoff.
 * - Never runs in the browser — keep the token/key server-only.
 */

import { sign as cryptoSign } from 'node:crypto';

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /**
     * True only when this is genuinely a rate limit (429, or 403 with `x-ratelimit-remaining: 0`).
     * A 403 is otherwise a *permission* error ("Resource not accessible by integration" — an App/PAT
     * without `contents: read`), which callers must not treat as transient. See FB-021.
     */
    readonly rateLimited: boolean = false,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: string;
}

export interface GitHubClientOptions {
  token?: string;
  /** GitHub App credentials; falls back to GITHUB_APP_* env when omitted. Ignored if a PAT is set. */
  app?: GitHubAppConfig;
  baseUrl?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests (default real timer). */
  sleepImpl?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** Clock source for reset-wait math + token-cache expiry; injectable for tests. */
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const b64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url');

/** Read App config from opts or GITHUB_APP_* env; null unless all three are present. */
function resolveAppConfig(opts: GitHubClientOptions): GitHubAppConfig | null {
  const appId = opts.app?.appId ?? process.env.GITHUB_APP_ID;
  const privateKey = opts.app?.privateKey ?? process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = opts.app?.installationId ?? process.env.GITHUB_APP_INSTALLATION_ID;
  if (!appId || !privateKey || !installationId) return null;
  // Env-encoded PEMs often carry literal "\n"; normalise to real newlines for the crypto layer.
  const normalisedKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
  return { appId, privateKey: normalisedKey, installationId };
}

/**
 * How the studio pays for what it reads (FB-077).
 *
 * One founder walking their own studio once — sign in, venture, composer, one question, attention
 * queue — exhausted the budget for three of five repositories. Not under load. Not in a loop.
 *
 * Two mechanisms, both of which cost nothing when they do not apply:
 *
 *  1. **Conditional requests.** GitHub does not count a `304 Not Modified` against the rate limit.
 *     Almost everything the studio reads — a ticket file, a repository's default branch, a closed
 *     pull request — changes rarely, so sending the ETag back turns most page views into requests
 *     that are free.
 *  2. **Coalescing.** The same URL asked for twice while the first is still in flight is one
 *     request. A venture page reads the same repository from several read models, and FB-064 asks
 *     for `/commits/:sha/status` twice by itself — once for the checks, once for the preview.
 *
 * Both are per-process, which is the honest scope: Railway runs one long-lived server, so the cache
 * survives between page views, and a restart merely costs what today costs.
 */
export const githubStats = { requests: 0, notModified: 0, coalesced: 0, rateLimited: 0 };

/**
 * Requests per endpoint SHAPE, when `GITHUB_STATS_BY_PATH` is set.
 *
 * Off by default — it is a measuring tool, not a feature. Ids are collapsed, so the shape of the
 * cost is visible rather than a thousand distinct URLs. Kept because the first measurement of this
 * contradicted the guess in the ticket, and the next person to change a read model should be able
 * to see the bill they are adding to.
 */
export const githubByPath = new Map<string, number>();

function recordPath(url: string): void {
  if (!process.env.GITHUB_STATS_BY_PATH) return;
  const shape = url
    .replace(/^https:\/\/api\.github\.com/, '')
    .replace(/\?.*$/, '')
    .replace(/\/repos\/[^/]+\/[^/]+/, '/repos/*')
    .replace(/\/(pulls|commits|contents|issues)\/[^/]+/, '/$1/*');
  githubByPath.set(shape, (githubByPath.get(shape) ?? 0) + 1);
}

/** Reset the counters — for a measurement run, and for tests. */
export function resetGithubStats(): void {
  githubStats.requests = 0;
  githubStats.notModified = 0;
  githubStats.coalesced = 0;
  githubStats.rateLimited = 0;
  githubByPath.clear();
}

/**
 * ETag → last body, so a 304 can be answered without a re-fetch.
 *
 * Bounded and insertion-ordered: at the cap the oldest entry goes, and a re-read re-inserts so the
 * things a founder actually looks at stay. Unbounded would be a slow leak on a server that runs for
 * weeks.
 */
const ETAG_CACHE_MAX = 2_000;
const etagCache = new Map<string, { etag: string; body: unknown }>();

/** In-flight GETs by URL, so concurrent duplicates become one request. */
const requestsInFlight = new Map<string, Promise<unknown>>();

/**
 * How many requests may be in the air at once.
 *
 * This is the one aimed at the failure actually observed. A venture board fires **87** requests, and
 * the studio fanned them out with `Promise.all`, so they left more or less simultaneously. GitHub
 * applies a *secondary* rate limit to concurrent bursts, separate from the hourly budget — which is
 * why the walk saw "rate limit hit" on three repositories while the hourly budget was barely
 * touched (485 of 5,000 used, and zero primary rate limits in three consecutive measured renders).
 *
 * GitHub's own guidance is to avoid concurrent requests and to make them serially where possible.
 * Eight is a compromise: a cold render still completes quickly, and the burst is no longer a burst.
 */
const MAX_CONCURRENT = Number(process.env.GITHUB_MAX_CONCURRENT ?? 8);

/** The most requests the studio has had in the air at once — for the measurement runs. */
export const githubPeakConcurrency = { peak: 0 };

/**
 * When the primary budget is exhausted, stop asking until it resets.
 *
 * Retrying into a rate limit is what deepens it: every refused request still counts as a request
 * against the secondary limits, and the studio fans out dozens per page. So the first refusal shuts
 * the door, and every read after it fails immediately with the same honest answer — which is also
 * far faster for the founder than watching a page hang through a retry ladder.
 *
 * Deliberately only the PRIMARY limit (the hourly budget, which reports a reset time). A secondary
 * limit is a burst problem, and the fix for that is the concurrency cap above, not a closed door.
 */
let blockedUntilMs = 0;

/** When the studio expects to be able to read GitHub again, or null when it is not blocked. */
export function githubBlockedUntil(now = Date.now()): Date | null {
  return blockedUntilMs > now ? new Date(blockedUntilMs) : null;
}

/**
 * How much of GitHub's budget is left (FB-083's last acceptance criterion).
 *
 * FB-077 measured the ceiling and FB-083 lowered it, and through both of those an operator still had
 * no way to see how close the studio was to it — the first sign would have been a founder's board
 * quietly failing to show their work. `githubBlockedUntil` existed and nothing rendered it.
 *
 * Read from the headers of requests the studio was making anyway. GitHub answers every response with
 * the remaining budget for the resource that response used, so this costs **nothing** — which
 * matters on the one ticket whose whole subject is not spending requests. (`/rate_limit` would be
 * free too, but a number that arrives on its own is better than one that has to be asked for: it
 * cannot be forgotten, and it is never stale in a way nobody notices.)
 *
 * Two resources, because FB-083 moved the ticket and pull-request reads onto GraphQL precisely
 * because it draws on a **separate** 5,000-point allowance. An operator needs to see both, or the
 * headroom that move bought is invisible.
 */
export interface GitHubBudget {
  remaining: number;
  limit: number;
  /** When this allowance refills. */
  resetsAt: string;
  /** When the studio last heard about it — a stale figure is not a reassuring one. */
  seenAt: string;
}

const budget: { rest: GitHubBudget | null; graphql: GitHubBudget | null } = { rest: null, graphql: null };

/** What the studio last heard about each allowance. Null means it has not used that resource yet. */
export function githubBudget(): { rest: GitHubBudget | null; graphql: GitHubBudget | null } {
  return { rest: budget.rest, graphql: budget.graphql };
}

export function clearGithubBudget(): void {
  budget.rest = null;
  budget.graphql = null;
}

/**
 * Record the allowance a response reported.
 *
 * A 304 carries the headers too, which is the point: the warm path FB-077 built is exactly where an
 * operator most needs the figure, and a reading that only updated on paid requests would go stale
 * precisely when things are going well.
 */
export function recordBudget(resource: 'rest' | 'graphql', headers: Headers, now = Date.now()): void {
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const limit = Number(headers.get('x-ratelimit-limit'));
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return;
  budget[resource] = {
    remaining,
    limit,
    resetsAt: new Date(Number.isFinite(reset) && reset > 0 ? reset * 1000 : now).toISOString(),
    seenAt: new Date(now).toISOString(),
  };
}

/**
 * Is an allowance low enough that someone should know before a founder finds out?
 *
 * A fifth left. Not a tuned number — it is the point at which "plenty" stops being true, and the
 * cost of saying so early is a line on an admin page nobody has to act on.
 */
export const budgetIsLow = (b: GitHubBudget | null): boolean => !!b && b.remaining / b.limit < 0.2;

export function clearGithubBlock(): void {
  blockedUntilMs = 0;
}

let active = 0;
const waiting: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) { active += 1; githubPeakConcurrency.peak = Math.max(githubPeakConcurrency.peak, active); return; }
  await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  githubPeakConcurrency.peak = Math.max(githubPeakConcurrency.peak, active);
}

function release(): void {
  active -= 1;
  waiting.shift()?.();
}

/** Drop everything cached — used by the studio's own refresh path and by tests. */
export function clearGithubCache(): void {
  etagCache.clear();
  requestsInFlight.clear();
}


export class GitHubClient {
  /** Static PAT, if configured. Takes precedence over App auth. */
  private readonly staticToken?: string;
  private readonly app: GitHubAppConfig | null;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly now: () => number;
  /** Cached installation token (App auth only). */
  private appToken: { value: string; expiresAtMs: number } | null = null;

  constructor(opts: GitHubClientOptions = {}) {
    this.staticToken = opts.token ?? process.env.GITHUB_TOKEN;
    this.app = this.staticToken ? null : resolveAppConfig(opts);
    this.baseUrl = (opts.baseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleepImpl = opts.sleepImpl ?? realSleep;
    this.maxRetries = opts.maxRetries ?? 3;
    this.now = opts.now ?? Date.now;
  }

  /**
   * Whether any auth is configured (a PAT or a GitHub App). When false, every request to a private
   * repo comes back 404 — so callers can tell "the studio isn't connected to GitHub" apart from
   * "this specific repo is missing/inaccessible" (both are otherwise a bare 404). See FB-021.
   */
  hasCredentials(): boolean {
    return Boolean(this.staticToken) || this.app !== null;
  }

  /** Resolve the bearer token for a request: PAT if set, else a (cached) App installation token. */
  private async resolveToken(): Promise<string | undefined> {
    if (this.staticToken) return this.staticToken;
    if (!this.app) return undefined;
    // Re-use the cached installation token until ~5 min before it expires.
    if (this.appToken && this.now() < this.appToken.expiresAtMs - 5 * 60_000) {
      return this.appToken.value;
    }
    return this.mintInstallationToken(this.app);
  }

  /** Sign an App JWT and exchange it for an installation token; cache it. */
  private async mintInstallationToken(app: GitHubAppConfig): Promise<string> {
    const nowSec = Math.floor(this.now() / 1000);
    // iat backdated 60s for clock skew; App JWTs may live at most 10 min — use 9.
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({ iat: nowSec - 60, exp: nowSec + 540, iss: app.appId }));
    const signingInput = `${header}.${payload}`;
    const signature = b64url(cryptoSign('RSA-SHA256', Buffer.from(signingInput), app.privateKey));
    const jwt = `${signingInput}.${signature}`;

    const res = await this.fetchImpl(`${this.baseUrl}/app/installations/${app.installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${jwt}`,
      },
    });
    if (!res.ok) {
      throw new GitHubError(`GitHub App token exchange failed (${res.status})`, res.status);
    }
    const data = (await res.json()) as { token: string; expires_at: string };
    const expiresAtMs = Date.parse(data.expires_at);
    this.appToken = {
      value: data.token,
      // If expires_at is unparseable, treat as a conservative ~55 min lifetime.
      expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : this.now() + 55 * 60_000,
    };
    return data.token;
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

  /**
   * One GraphQL query, on GitHub's SEPARATE budget (FB-083).
   *
   * REST charges one request per file. A venture board read 87 of them, most one-per-ticket, which
   * capped the studio at roughly 58 cold board views an hour — a number a founder and a colleague
   * can reach between them on the morning after a deploy.
   *
   * One GraphQL query returns a whole directory's filenames AND their contents AND the default
   * branch. Measured against the live ARCA repository: **49 ticket files, one request, one point.**
   * And the points come from a 5,000-an-hour allowance the studio does not otherwise touch, so this
   * does not compete with the REST reads that still handle pull requests and checks.
   *
   * Errors are deliberately normalised to `GitHubError` so callers keep one error vocabulary. A
   * second API surface is the real cost of this change; a second way of failing would be worse.
   */
  async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const token = await this.resolveToken();
    githubStats.requests += 1;
    const res = await this.fetchImpl('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    recordBudget('graphql', res.headers);
    const rateLimited = res.status === 429
      || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');
    if (rateLimited) githubStats.rateLimited += 1;
    if (!res.ok) throw new GitHubError(`GitHub GraphQL ${res.status}`, res.status, rateLimited);

    const body = (await res.json()) as { data?: T; errors?: Array<{ type?: string; message?: string }> };
    if (body.errors?.length) {
      // GraphQL answers 200 with an errors array, so a failure here would otherwise read as success
      // and return undefined — a repository the studio cannot see would look like an empty backlog.
      const first = body.errors[0];
      const status = first?.type === 'NOT_FOUND' ? 404 : first?.type === 'FORBIDDEN' ? 403 : 502;
      throw new GitHubError(`GitHub GraphQL: ${first?.message ?? 'unknown error'}`, status, false);
    }
    if (!body.data) throw new GitHubError('GitHub GraphQL returned no data', 502, false);
    return body.data;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const method = (init?.method ?? 'GET').toUpperCase();

    // Only GETs are cacheable and coalescable. A PUT that got folded into another PUT would be a
    // write that silently did not happen.
    if (method !== 'GET') return this.send<T>(url, path, init);

    // Coalesce: the same URL asked for twice while the first is still in flight is one request.
    // A venture page reads the same repository from several read models — tickets, health,
    // approvals — and FB-064 asks for `/commits/:sha/status` twice on its own, once for the checks
    // and once for the preview.
    const inFlight = requestsInFlight.get(url);
    if (inFlight) { githubStats.coalesced += 1; return inFlight as Promise<T>; }

    const promise = this.send<T>(url, path, init).finally(() => requestsInFlight.delete(url));
    requestsInFlight.set(url, promise);
    return promise;
  }

  private async send<T>(url: string, path: string, init?: RequestInit): Promise<T> {
    await acquire();
    try {
      return await this.sendNow<T>(url, path, init);
    } finally {
      release();
    }
  }

  private async sendNow<T>(url: string, path: string, init?: RequestInit): Promise<T> {
    if (blockedUntilMs > this.now()) {
      throw new GitHubError(
        `GitHub rate limit — not asking again until ${new Date(blockedUntilMs).toISOString()}`,
        429,
        true,
      );
    }
    const token = await this.resolveToken();
    const method = (init?.method ?? 'GET').toUpperCase();
    let attempt = 0;
    for (;;) {
      const cached = method === 'GET' ? etagCache.get(url) : undefined;
      githubStats.requests += 1;
      recordPath(url);
      const res = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // A 304 does NOT count against the rate limit. Most of what the studio reads changes
          // rarely, so this is the difference between paying for every page view and paying only
          // when something actually moved.
          ...(cached ? { 'If-None-Match': cached.etag } : {}),
          ...(init?.headers ?? {}),
        },
      });

      // Before the 304 short-circuit: a not-modified response carries the budget headers too, and
      // the warm path is exactly where an operator most needs the figure to stay current.
      recordBudget('rest', res.headers);

      if (res.status === 304 && cached) {
        githubStats.notModified += 1;
        return cached.body as T;
      }

      const rateLimited =
        res.status === 429 ||
        (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0');

      if (rateLimited) {
        githubStats.rateLimited += 1;
        // Only a primary limit carries a reset. Without one this is a burst problem, and closing the
        // door for an unknown period would turn a two-second hiccup into a blank page.
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        if (Number.isFinite(reset) && reset > 0) blockedUntilMs = Math.max(blockedUntilMs, reset * 1000);
      }

      if ((rateLimited || res.status >= 500) && attempt < this.maxRetries) {
        await this.sleepImpl(this.waitMs(res.headers, attempt));
        attempt += 1;
        continue;
      }

      if (!res.ok) {
        throw new GitHubError(`GitHub ${res.status} for ${path}`, res.status, rateLimited);
      }

      const body = (await res.json()) as T;
      const etag = res.headers.get('etag');
      if (method === 'GET' && etag) {
        // Bounded, so a long-running server cannot grow this without limit. Oldest out first.
        if (etagCache.size >= ETAG_CACHE_MAX) {
          const oldest = etagCache.keys().next().value;
          if (oldest !== undefined) etagCache.delete(oldest);
        }
        etagCache.delete(url);           // re-insert so recency is insertion order
        etagCache.set(url, { etag, body });
      }
      return body;
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

  /** Fetch a file's decoded text AND its blob sha (or null if 404). The sha pins the exact content
   *  an approval grant attested (FB-046) and is the `sha` an update PUT must supply. */
  async getFileWithSha(repo: string, path: string, ref = 'main'): Promise<{ text: string; sha: string } | null> {
    try {
      const data = await this.request<{ content?: string; encoding?: string; sha?: string }>(
        `/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
      );
      if (!data.content || !data.sha) return null;
      return { text: Buffer.from(data.content, (data.encoding as BufferEncoding) ?? 'base64').toString('utf8'), sha: data.sha };
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  /** Create/update a file (contents PUT). Needs a write-scoped credential. Returns the new blob sha. */
  async putFile(repo: string, path: string, params: { content: string; message: string; branch: string; sha?: string }): Promise<string> {
    const body: Record<string, unknown> = {
      message: params.message,
      branch: params.branch,
      content: Buffer.from(params.content, 'utf8').toString('base64'),
    };
    if (params.sha) body.sha = params.sha;
    const resp = await this.request<{ content?: { sha?: string } }>(
      `/repos/${repo}/contents/${encodeURI(path)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    );
    return resp.content?.sha ?? '';
  }

  /** List a directory's entries (name + type), or [] if it doesn't exist. */
  /**
   * Every entry in a directory on a ref.
   *
   * ## Why this is not the contents API
   *
   * **The contents API returns at most 1,000 entries, and it returns the alphabetically FIRST ones**
   * — with no flag, no error and no hint that anything was left out. Measured on ARCA's
   * `foundry-state` ref on 2026-09-01: 1,551 run reports on the ref, 1,000 returned. The lane names
   * them `<slug>-<UTC timestamp>.json`, so alphabetically first is chronologically **oldest**.
   *
   * The studio therefore read a window that had stopped advancing a month earlier, and every surface
   * built on it — the engine line, the run reports, the activity feed, the office — described a
   * venture whose machine wakes every five minutes as one that had not checked in for a day. It got
   * one report worse every five minutes and would never have recovered on its own.
   *
   * The trees API has a far higher ceiling and, when it does hit it, **says so**: `truncated: true`.
   * A cap that announces itself can be handled; a cap that lies cannot.
   *
   * @param truncated set to true when the ref is too large even for the trees API, so a caller can
   *   say what it could not see rather than quietly showing a subset.
   */
  async listDir(repo: string, path: string, ref = 'main'): Promise<Array<{ name: string; type: string }>> {
    const clean = path.replace(/^\/+|\/+$/g, '');
    try {
      const tree = await this.request<{
        tree?: Array<{ path: string; type: string }>;
        truncated?: boolean;
      }>(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);

      if (tree.truncated) {
        // Loud rather than silently partial. Nothing in the studio can act on this, and the whole
        // point of the change is that a caller is told when it is looking at a subset.
        console.warn(`[github] tree for ${repo}@${ref} is truncated — ${path} may be incomplete`);
      }
      const prefix = clean ? `${clean}/` : '';
      return (tree.tree ?? [])
        .filter((e) => e.path.startsWith(prefix) && !e.path.slice(prefix.length).includes('/'))
        .map((e) => ({ name: e.path.slice(prefix.length), type: e.type === 'blob' ? 'file' : 'dir' }))
        .filter((e) => e.name.length > 0);
    } catch (e) {
      // A ref or a repository that is not there is an empty directory, which is what every caller
      // already handles. Anything else propagates, so a rate limit is not read as "no reports".
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
  }

  // --- FB-064: reading and accepting a piece of work without leaving the studio ------------------

  /** One pull request, including `mergeable` — which GitHub computes lazily and may return null for. */
  async getPullRequest(repo: string, number: number): Promise<RawPullRequest | null> {
    try {
      return await this.request<RawPullRequest>(`/repos/${repo}/pulls/${number}`);
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  /**
   * The files a pull request changed, with their patches.
   *
   * Capped at one page on purpose: the founder-facing view shows a bounded list and says how many
   * more there are (`summariseChanges`), which is honest. Paging through a 300-file change to render
   * all of it would be slow and would not help anyone judge it.
   */
  async listPullFiles(repo: string, number: number, perPage = 50): Promise<RawPullFile[]> {
    try {
      return await this.request<RawPullFile[]>(`/repos/${repo}/pulls/${number}/files?per_page=${perPage}`);
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
  }

  /**
   * Accept a piece of work.
   *
   * `sha` pins the commit the founder was actually looking at — GitHub refuses the merge with 409 if
   * the branch has moved since, which is the server-side half of the binding `acceptability()` does
   * client-side. Both, deliberately: one gives a good message, the other makes it impossible.
   */
  /**
   * Say something back about a piece of work (FB-107).
   *
   * The issues endpoint, not the review endpoint, and deliberately: a founder sending work back is
   * leaving a note in the thread the lane already reads on its next wake, not filing a line-by-line
   * code review of a change they were never asked to read.
   */
  async commentOnPullRequest(repo: string, number: number, body: string): Promise<{ html_url: string }> {
    return this.request<{ html_url: string }>(`/repos/${repo}/issues/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async mergePullRequest(
    repo: string,
    number: number,
    params: { sha: string; method?: 'merge' | 'squash' | 'rebase'; title?: string },
  ): Promise<{ merged: boolean; message: string }> {
    return this.request<{ merged: boolean; message: string }>(`/repos/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({
        sha: params.sha,
        merge_method: params.method ?? 'squash',
        ...(params.title ? { commit_title: params.title } : {}),
      }),
    });
  }
}

/** The subset of GitHub's pull-request payload this app reads. */
export interface RawPullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  merged: boolean;
  mergeable: boolean | null;
  user: { login: string } | null;
  created_at: string;
  head: { sha: string; ref: string };
  /** GitHub's own count. The files endpoint is paginated, so this is the only honest total. */
  changed_files: number;
}

export interface RawPullFile {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
  patch?: string;
}
