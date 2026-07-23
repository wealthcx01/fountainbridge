import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { GitHubClient, GitHubError, type GitHubAppConfig } from '../github';

function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

// A throwaway RSA key so crypto can actually sign the App JWT in tests.
const { privateKey: TEST_PEM } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const APP: GitHubAppConfig = { appId: '42', privateKey: TEST_PEM as string, installationId: '123' };
const authOf = (call: unknown[]) =>
  ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

describe('GitHubClient — rate-limit awareness', () => {
  it('retries after a primary-rate-limit 403, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        res(403, { message: 'rate limited' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '0' }),
      )
      .mockResolvedValueOnce(res(200, { ok: true }));
    const sleeps: number[] = [];
    const client = new GitHubClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async (ms) => void sleeps.push(ms),
      now: () => 0,
    });
    const out = await client.request<{ ok: boolean }>('/x');
    expect(out.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleeps).toHaveLength(1);
  });

  it('retries a secondary 429 up to maxRetries, then throws GitHubError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(429, { message: 'too many' }, { 'retry-after': '0' }));
    const client = new GitHubClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
      maxRetries: 2,
    });
    await expect(client.request('/x')).rejects.toBeInstanceOf(GitHubError);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does NOT retry a 403 that is not a rate limit (real auth/permission error)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(403, { message: 'forbidden' }, { 'x-ratelimit-remaining': '55' }));
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch, sleepImpl: async () => {} });
    await expect(client.request('/x')).rejects.toMatchObject({ status: 403 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('GitHubClient — content helpers', () => {
  it('getFileContent decodes base64', async () => {
    const content = Buffer.from('hello world', 'utf8').toString('base64');
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { content, encoding: 'base64' }));
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await client.getFileContent('owner/repo', 'a.md')).toBe('hello world');
  });

  it('getFileContent returns null on 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404, { message: 'not found' }));
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await client.getFileContent('owner/repo', 'missing.md')).toBeNull();
  });

  it('listDir returns [] on 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404, { message: 'not found' }));
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(await client.listDir('owner/repo', 'docs/tickets')).toEqual([]);
  });

  it('sends the auth header when a token is set', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, []));
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch, token: 'secret' });
    await client.listDir('owner/repo', 'docs/tickets');
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
  });
});

describe('GitHubClient — GitHub App auth (FB-020)', () => {
  // Routes the token-exchange POST vs. data GETs; returns an installation token that expires in 1h.
  function appFetch(nowMs: () => number, dataBody: unknown = []) {
    return vi.fn().mockImplementation(async (url: string) => {
      if (String(url).endsWith('/access_tokens')) {
        return res(201, { token: 'inst-tok', expires_at: new Date(nowMs() + 3600_000).toISOString() });
      }
      return res(200, dataBody);
    });
  }

  it('mints an installation token from the App key and uses it as the bearer', async () => {
    const fetchImpl = appFetch(() => 0);
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch, app: APP, now: () => 0 });
    await client.listDir('owner/repo', 'docs/tickets');

    // Two calls: the JWT-authed token exchange, then the data request with the minted token.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const mintCall = fetchImpl.mock.calls[0];
    expect(String(mintCall[0])).toContain('/app/installations/123/access_tokens');
    expect((mintCall[1] as RequestInit).method).toBe('POST');
    // The exchange is authed with a 3-part JWT, not the installation token.
    expect(authOf(mintCall)).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    // The data request carries the minted installation token.
    expect(authOf(fetchImpl.mock.calls[1])).toBe('Bearer inst-tok');
  });

  it('caches the installation token across requests (mints once)', async () => {
    const fetchImpl = appFetch(() => 0);
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch, app: APP, now: () => 0 });
    await client.listDir('owner/repo', 'a');
    await client.listDir('owner/repo', 'b');
    const exchanges = fetchImpl.mock.calls.filter((c) => String(c[0]).endsWith('/access_tokens'));
    expect(exchanges).toHaveLength(1);
  });

  it('re-mints after the cached token nears expiry', async () => {
    let now = 0;
    const fetchImpl = appFetch(() => now);
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch, app: APP, now: () => now });
    await client.listDir('owner/repo', 'a'); // mints at t=0, expires t=3600s
    now = 3600_000 - 4 * 60_000; // within the 5-min refresh window → must re-mint
    await client.listDir('owner/repo', 'b');
    const exchanges = fetchImpl.mock.calls.filter((c) => String(c[0]).endsWith('/access_tokens'));
    expect(exchanges).toHaveLength(2);
  });

  it('a PAT takes precedence over App config', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, []));
    const client = new GitHubClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      token: 'pat-wins',
      app: APP,
      now: () => 0,
    });
    await client.listDir('owner/repo', 'docs/tickets');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no token exchange
    expect(authOf(fetchImpl.mock.calls[0])).toBe('Bearer pat-wins');
  });

  it('surfaces a failed token exchange as a GitHubError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(401, { message: 'bad key' }));
    const client = new GitHubClient({ fetchImpl: fetchImpl as unknown as typeof fetch, app: APP, now: () => 0 });
    await expect(client.listDir('owner/repo', 'docs/tickets')).rejects.toBeInstanceOf(GitHubError);
  });
});
