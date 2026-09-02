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
import { execFileSync } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { askBrain } from './brain-query.mjs';
import { DEPARTMENTS } from './brain-lib.mjs';

const PORT = Number(process.env.FOUNDRY_BRAIN_PORT || 3131);
const TOKEN = (process.env.FOUNDRY_BRAIN_TOKEN || '').trim();
const MAX_BODY = 16 * 1024;
const log = (...a) => console.error('[brain-bridge]', ...a);

if (!TOKEN) {
  log('ERROR: FOUNDRY_BRAIN_TOKEN is not set. Refusing to start an unauthenticated brain service.');
  log('       Generate one with `openssl rand -hex 32` and set it in /opt/foundry/lane/brain.env.');
  process.exit(1);
}

/**
 * The address the venture's containers reach the host on.
 *
 * `host.docker.internal:host-gateway` resolves to the **default bridge** (`docker0`) address —
 * 172.17.0.1 — not to the gateway of the container's own compose network. Verified on ARCA's box by
 * reading the container's /etc/hosts and testing both: only docker0's address answers.
 *
 * The trap: once every container sits on a compose-created network, `docker0` has nothing attached
 * and goes NO-CARRIER, and node's `networkInterfaces()` omits interfaces that are down. So the
 * address that IS the right one becomes invisible to the obvious API, the bridge falls back to
 * 127.0.0.1, and the composer silently cannot reach the brain. That is exactly what happened here:
 * it warned on every boot, correctly, into a log nobody was reading.
 *
 * So the lookup falls back to `ip`, which reports a down interface's address perfectly well. A
 * compose network is used only if there is no docker0 at all — a setup where `host-gateway` must
 * have been pointed elsewhere, in which case FOUNDRY_BRAIN_BIND is the honest answer.
 */
function dockerBridgeAddress() {
  const found = { legacy: null, compose: null };
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    const v4 = (addrs || []).find((a) => a.family === 'IPv4' && !a.internal);
    if (!v4) continue;
    if (/^docker/.test(name)) found.legacy ??= v4.address;
    else if (/^br-/.test(name)) found.compose ??= v4.address;
  }
  // `ip` sees what os.networkInterfaces() will not: an addressed interface with no carrier.
  if (!found.legacy) found.legacy = addressViaIpCommand('docker0');
  return found.legacy ?? found.compose;
}

/** Read one interface's IPv4 address via iproute2. Returns null on any failure — never throws. */
function addressViaIpCommand(iface) {
  try {
    const out = execFileSync('ip', ['-4', '-o', 'addr', 'show', iface], {
      encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.match(/\binet\s+(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// On a cold boot this service can win the race against dockerd, and no bridge exists yet. Binding
// 127.0.0.1 in that moment would leave the composer unable to reach the brain until someone noticed
// and restarted the unit by hand — so wait for the interface rather than settle for the wrong
// address. Still falls back (never crash-loops) so a box with no Docker at all runs the lane's brain
// happily; only the composer's door is unavailable, and it says so.
const BIND_WAIT_MS = Number(process.env.FOUNDRY_BRAIN_BIND_WAIT_MS || 60_000);
async function resolveBind() {
  const explicit = (process.env.FOUNDRY_BRAIN_BIND || '').trim();
  if (explicit) {
    // "Never binds 0.0.0.0" is an invariant this file documents, so enforce it in code rather than
    // leave it as prose an override can quietly break. This service has no business on a public
    // interface: the venture's whole knowledge index sits behind one bearer token.
    if (['0.0.0.0', '::', '*'].includes(explicit)) {
      log(`ERROR: refusing to bind ${explicit} — the brain must not listen on a public interface.`);
      log('       Set FOUNDRY_BRAIN_BIND to the docker bridge address, or unset it to auto-detect.');
      process.exit(1);
    }
    return explicit;
  }
  const deadline = Date.now() + BIND_WAIT_MS;
  let warned = false;
  for (;;) {
    const addr = dockerBridgeAddress();
    if (addr) return addr;
    if (Date.now() >= deadline) break;
    if (!warned) {
      log(`no docker bridge interface yet — waiting up to ${Math.round(BIND_WAIT_MS / 1000)}s for dockerd…`);
      warned = true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  log('WARN: no docker bridge interface found — binding 127.0.0.1. The composer will NOT reach the');
  log('      brain from its container. Start Docker and restart foundry-brain-bridge, or set');
  log('      FOUNDRY_BRAIN_BIND to the right address.');
  return '127.0.0.1';
}

// Compare digests, not the raw strings: fixed width means timingSafeEqual can never throw on a
// length mismatch, and the token's length stops being observable through response timing.
const sha = (s) => createHash('sha256').update(String(s)).digest();
const TOKEN_DIGEST = sha(TOKEN);
function authorized(req) {
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return timingSafeEqual(sha(given), TOKEN_DIGEST);
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
// reads from piling up against a running refresh. Depth-capped, because an unbounded chain would let
// a burst of questions queue work nobody is waiting for any more — the MCP client gives up long
// before a deep queue drains, and the box has no spare capacity to burn on answers with no reader.
const MAX_PENDING = Number(process.env.FOUNDRY_BRAIN_MAX_PENDING || 8);
let pending = 0;
let queue = Promise.resolve();
function serialise(fn) {
  pending += 1;
  const run = queue.then(fn, fn).finally(() => { pending -= 1; });
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
  if (!authorized(req)) {
    // Logged, not swallowed (#10). This port is reachable by every container on the box, so repeated
    // 401s are the signal that something on the box is probing the venture's knowledge index — that
    // belongs in `journalctl -u foundry-brain-bridge`, not in a silent return.
    log(`401 rejected query from ${req.socket?.remoteAddress || 'unknown'}`);
    send(res, 401, { error: 'unauthorized' });
    return;
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch (e) {
    send(res, 400, { error: `could not read the request: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }

  const question = String(body.question || '').trim();
  if (!question) { send(res, 400, { error: 'question is required' }); return; }

  // Reject an unrecognised department rather than guessing. The MCP tool's enum is client-side only,
  // so this is where a typo gets caught — and being explicit here means "unpartitioned" stays a
  // deliberate choice (omit the field) instead of something a bad value can fall into.
  const department = body.department == null ? null : String(body.department).trim().toLowerCase();
  if (department && !DEPARTMENTS.includes(department)) {
    send(res, 400, { error: `unknown department '${department}' — expected one of ${DEPARTMENTS.join(', ')}` });
    return;
  }

  if (pending >= MAX_PENDING) {
    log(`503 shed a query — ${pending} already queued (the index is likely mid-refresh)`);
    send(res, 503, { error: 'the venture brain is busy right now — try again in a moment' });
    return;
  }

  try {
    const { results, digest, slugs } = await serialise(() =>
      askBrain({
        // The founder owns every department, so the composer queries unpartitioned unless it asks
        // for one surface explicitly.
        question,
        department,
        limit: Number(body.limit) || 12,
        maxChars: Number(body.max_chars) || 4000,
      }),
    );
    send(res, 200, {
      digest,
      pages: results.map((r) => ({ slug: r.slug, title: r.title, score: r.score })),
      // What the caller was actually SHOWN, as distinct from what the index returned (FB-156). The
      // two differ: a page can be dropped on the way into the digest. The composer's own record of
      // use will be built from this — it is not recorded here, because this service is read-only by
      // construction and giving it a write credential is a decision, not a detail. See FB-165.
      shown: slugs,
      found: results.length,
    });
  } catch (e) {
    log('query failed:', String(e));
    send(res, 502, { error: 'the venture brain could not be queried right now' });
  }
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
const BIND = await resolveBind();
server.listen(PORT, BIND, () => log(`listening on ${BIND}:${PORT} (read-only, token required)`));
