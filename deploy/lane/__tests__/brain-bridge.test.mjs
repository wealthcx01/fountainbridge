// The brain bridge is the composer's door to the venture's whole knowledge index, guarded by one
// bearer token. Its enforcement branches are exactly the code that must not regress quietly, so they
// get driven for real: spawn the service against a STUB gbrain (no brain required) and speak HTTP to
// it. Everything here is local to 127.0.0.1 and needs no box.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 34137;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'a'.repeat(64);
const BRIDGE = new URL('../brain-bridge.mjs', import.meta.url).pathname;

let proc;
let stubDir;

// A stub standing in for gbrain: prints one hit, so a 200 proves the whole path without a brain.
function writeStub(body) {
  const p = join(stubDir, 'gbrain-stub.sh');
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

async function startBridge(env = {}) {
  const child = spawn(process.execPath, [BRIDGE], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      FOUNDRY_BRAIN_TOKEN: TOKEN,
      FOUNDRY_BRAIN_BIND: '127.0.0.1',
      FOUNDRY_BRAIN_PORT: String(PORT),
      GBRAIN_BIN: writeStub('echo \'[{"slug":"context-build-a","title":"A","score":0.9,"chunk_text":"the answer"}]\''),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error('bridge did not come up');
}

const query = (init = {}, body = '{"question":"who is this for"}') =>
  fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    body,
    ...init,
  });
const authed = (body) => query({ headers: { authorization: `Bearer ${TOKEN}` } }, body);

beforeAll(async () => {
  stubDir = mkdtempSync(join(tmpdir(), 'brain-bridge-test-'));
  proc = await startBridge();
}, 30000);

afterAll(() => { if (proc) proc.kill(); });

describe('brain bridge — authentication', () => {
  it('refuses every token that is not exactly right', async () => {
    expect((await query()).status).toBe(401);                                             // absent
    expect((await query({ headers: { authorization: 'Bearer wrong' } })).status).toBe(401); // short
    expect((await query({ headers: { authorization: `Bearer ${'b'.repeat(64)}` } })).status).toBe(401); // same length
    expect((await query({ headers: { authorization: TOKEN } })).status).toBe(401);        // no Bearer prefix
    expect((await query({ headers: { authorization: `Bearer ${TOKEN} ` } })).status).toBe(200); // trimmed
  });

  it('accepts the right token', async () => {
    expect((await authed()).status).toBe(200);
  });

  it('refuses to start at all without a token rather than listening unauthenticated', async () => {
    const child = spawn(process.execPath, [BRIDGE], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, FOUNDRY_BRAIN_PORT: String(PORT + 1) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const code = await new Promise((r) => child.on('exit', r));
    expect(code).toBe(1);
  }, 15000);
});

describe('brain bridge — routing and validation', () => {
  it('serves health unauthenticated but nothing else', async () => {
    expect((await fetch(`${BASE}/health`)).status).toBe(200);
    expect((await fetch(`${BASE}/nope`)).status).toBe(404);
    expect((await fetch(`${BASE}/query`)).status).toBe(405);
  });

  it('rejects an unreadable body and a missing question', async () => {
    expect((await authed('not json')).status).toBe(400);
    expect((await authed('{}')).status).toBe(400);
  });

  it('rejects an unknown department instead of silently searching everything', async () => {
    const res = await authed('{"question":"q","department":"markteing"}');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unknown department/);
  });

  it('accepts a known department and an omitted one', async () => {
    expect((await authed('{"question":"q","department":"build"}')).status).toBe(200);
    expect((await authed('{"question":"q"}')).status).toBe(200);
  });
});

describe('brain bridge — answers and failures', () => {
  it('returns the digest and the pages it came from', async () => {
    const body = await (await authed()).json();
    expect(body.found).toBe(1);
    expect(body.digest).toContain('the answer');
    expect(body.pages[0]).toMatchObject({ slug: 'context-build-a', title: 'A' });
  });

  it('does not leak brain internals to the composer when the query fails', async () => {
    const failing = await startBridgeOnSpare('echo "gbrain: PGLite lock held by pid 123" >&2; exit 1');
    try {
      const res = await fetch(`http://127.0.0.1:${PORT + 2}/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
        body: '{"question":"q"}',
      });
      expect(res.status).toBe(502);
      expect(JSON.stringify(await res.json())).not.toMatch(/PGLite|pid 123/);
    } finally {
      failing.kill();
    }
  }, 30000);
});

// A second instance on a spare port, for the failure case.
async function startBridgeOnSpare(stubBody) {
  const port = PORT + 2;
  const child = spawn(process.execPath, [BRIDGE], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      FOUNDRY_BRAIN_TOKEN: TOKEN,
      FOUNDRY_BRAIN_BIND: '127.0.0.1',
      FOUNDRY_BRAIN_PORT: String(port),
      GBRAIN_BIN: writeStub(stubBody),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 100; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return child;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error('spare bridge did not come up');
}
