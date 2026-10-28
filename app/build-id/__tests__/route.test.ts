import { afterEach, describe, expect, it } from 'vitest';
import { GET } from '../route';

/**
 * `/build-id` (FB-272). The factory's runtime host checks that it answers with exactly the name the
 * host gave the copy it started; anywhere else it is the commit.
 */

const KEYS = ['FACTORY_RUNTIME_CANDIDATE', 'RAILWAY_GIT_COMMIT_SHA', 'BUILD_COMMIT_SHA'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function set(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
}

describe('/build-id', () => {
  it("answers with the factory's name for the copy, before anything else", async () => {
    set({ FACTORY_RUNTIME_CANDIDATE: 'factory-v1:abc', RAILWAY_GIT_COMMIT_SHA: 'r', BUILD_COMMIT_SHA: 'b' });
    expect(await GET().text()).toBe('factory-v1:abc');
  });

  it("answers with Railway's commit on Railway", async () => {
    set({ RAILWAY_GIT_COMMIT_SHA: '601ee31', BUILD_COMMIT_SHA: 'b' });
    expect(await GET().text()).toBe('601ee31');
  });

  it("answers with the test copy's commit", async () => {
    set({ BUILD_COMMIT_SHA: 'b0b' });
    expect(await GET().text()).toBe('b0b');
  });

  it('says "unknown" rather than nothing', async () => {
    set({});
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(await res.text()).toBe('unknown');
  });
});
