#!/usr/bin/env node
// Foundry brain bridge (FB-050) — the composer's read-only door to the venture brain.
//
// WHY A BRIDGE. gbrain lives on the HOST (its PGLite brain is a single-writer local database — D1:
// the venture's knowledge never leaves its own box). LibreChat runs in Docker, so its stdio MCP
// server cannot run the gbrain CLI, and mounting a single-writer database into a second container
// while the host syncs it invites corruption. This tiny service is the single process that owns
// brain access on the host; the container asks it over the docker bridge.
//
// SAFETY
//   - READ-ONLY: it exposes exactly one operation, and that operation runs brain-query.mjs's fixed
//     `gbrain call query` argv. No tool name, flag, or slug from the caller reaches gbrain.
//   - Bearer token required on /query (FOUNDRY_BRAIN_TOKEN, generated per box by install-gbrain.sh).
//     The service refuses to start without one rather than listen unauthenticated.
//   - Never binds 0.0.0.0: the docker bridge address by default (reachable from the venture's own
//     containers, not the internet), 127.0.0.1 with a loud warning if that address isn't present.
//   - One query at a time — a 2 GB box also runs the founder's live composer, so queries queue
//     rather than fan out into N gbrain processes.

import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { timingSafeEqual } from 'node:crypto';
import { askBrain } from './brain-query.mjs';

const PORT = Number(process.env.FOUNDRY_BRAIN_PORT || 3131);
const TOKEN = (process.env.FOUNDRY_BRAIN_TOKEN || '').trim();
const MAX_BODY = 16 * 1024;
const log = (...a) => console.error('[brain-bridge]', ...a);

if (!TOKEN) {
  log('ERROR: FOUNDRY_BRAIN_TOKEN is not set. Refusing to start an unauthenticated brain service.');
  log('       Generate one with `openssl rand -hex 32` and set it in /opt/foundry/lane/brain.env.');
  process.exit(1);
}

// The address the venture's containers reach the host on. `host.docker.internal:host-gateway` in the
// compose file resolves to the host's docker0 address, so that is what we listen on.
function resolveBind() {
  const explicit = (process.env.FOUNDRY_BRAIN_BIND || '').trim();
  if (explicit) return explicit;
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (!/^docker/.test(name)) continue;
    const v4 = (addrs || []).find((a) => a.family === 'IPv4' && !a.internal);
    if (v4) return v4.address;
  }
  log('WARN: no docker bridge interface found — binding 127.0.0.1. The composer will NOT reach the');
  log('      brain until Docker is up (or FOUNDRY_BRAIN_BIND names the right address).');
  return '127.0.0.1';
}

function authorized(req) {
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Serialise: each query waits for the previous one. Keeps memory bounded on a shared box and keeps
// reads from piling up against a running refresh.
let queue = Promise.resolve();
function serialise(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://bridge.local');

  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, { ok: true, service: 'foundry-brain-bridge' });
    return;
  }
  if (url.pathname !== '/query') { send(res, 404, { error: 'not found' }); return; }
  if (req.method !== 'POST') { send(res, 405, { error: 'use POST' }); return; }
  if (!authorized(req)) { send(res, 401, { error: 'unauthorized' }); return; }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch (e) {
    send(res, 400, { error: `could not read the request: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }

  const question = String(body.question || '').trim();
  if (!question) { send(res, 400, { error: 'question is required' }); return; }

  try {
    const { results, digest } = await serialise(() =>
      askBrain({
        question,
        // The founder owns every department, so the composer queries unpartitioned unless it asks
        // for one surface explicitly.
        department: typeof body.department === 'string' ? body.department : null,
        limit: Number(body.limit) || 12,
        maxChars: Number(body.max_chars) || 4000,
      }),
    );
    send(res, 200, {
      digest,
      pages: results.map((r) => ({ slug: r.slug, title: r.title, score: r.score })),
      found: results.length,
    });
  } catch (e) {
    log('query failed:', String(e));
    send(res, 502, { error: 'the venture brain could not be queried right now' });
  }
});

const BIND = resolveBind();
server.listen(PORT, BIND, () => log(`listening on ${BIND}:${PORT} (read-only, token required)`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
