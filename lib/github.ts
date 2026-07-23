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

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const token = await this.resolveToken();
    let attempt = 0;
    for (;;) {
      const res = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
