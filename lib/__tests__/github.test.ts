import { describe, it, expect, vi } from 'vitest';
import { GitHubClient, GitHubError } from '../github';

function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

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
