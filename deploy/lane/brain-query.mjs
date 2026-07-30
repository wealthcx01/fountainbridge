#!/usr/bin/env node
// Ask the venture brain (FB-050) — the one place anything on the box queries gbrain.
//
// Used two ways:
//   - as a CLI by the lane's RESEARCH step (supervisor.sh): prints a plain-text digest on stdout
//   - as a module by brain-bridge.mjs (the composer's read-only path): askBrain() returns both the
//     raw hits and the digest
//
// READ-ONLY BY CONSTRUCTION: this module spawns gbrain with a FIXED argv — `gbrain call query <json>`
// — and the JSON payload is assembled here from typed fields. There is no passthrough of a tool name
// or of arbitrary flags, so no caller (least of all the composer, which reaches this over the bridge)
// can turn it into a write. Keep it that way: any write capability belongs in a separate, explicitly
// authorised tool, exactly as the status connector's read-only contract is kept (FB-036).
//
// PGLite is single-writer: a query that lands mid-sync can contend. FOUNDRY_BRAIN_LOCK names a lock
// file both this and gbrain-refresh.sh take through flock, so reads and the refresh serialise.
//
// Usage: brain-query.mjs (--question "…" | --ticket <file>) [--department build] [--limit 12]
// Exit codes: 0 = digest printed · 3 = brain reachable but nothing relevant · 1 = brain unavailable.

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatDigest, partitionForDepartment, researchQuestion } from './brain-lib.mjs';

const GBRAIN_BIN = process.env.GBRAIN_BIN || 'gbrain';
const SOURCE_ID = process.env.FOUNDRY_BRAIN_SOURCE || process.env.GBRAIN_SOURCE || '';
const LOCK_FILE = process.env.FOUNDRY_BRAIN_LOCK || '';
const DEFAULT_TIMEOUT_MS = Number(process.env.FOUNDRY_BRAIN_TIMEOUT_MS || 90_000);

// gbrain prints the JSON payload, but a stray warning line on stdout must not break the parse.
function parseHits(stdout) {
  const s = String(stdout || '');
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  const parsed = JSON.parse(s.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

function runGbrain(payload, timeoutMs) {
  // Fixed argv (see the read-only note above). flock serialises against gbrain-refresh.sh.
  const args = ['call', 'query', JSON.stringify(payload)];
  const [cmd, argv] = LOCK_FILE
    ? ['flock', ['-w', '60', LOCK_FILE, GBRAIN_BIN, ...args]]
    : [GBRAIN_BIN, args];
  return new Promise((resolve, reject) => {
    execFile(cmd, argv, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const why = err.killed ? `timed out after ${timeoutMs}ms` : String(stderr || err.message).trim();
        reject(new Error(`gbrain query failed: ${why.slice(0, 400)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Query the venture brain and return the partitioned hits plus a prompt-ready digest.
 * @param {{question: string, department?: string|null, limit?: number, maxChars?: number,
 *          sourceId?: string, timeoutMs?: number}} opts
 */
export async function askBrain(opts) {
  const question = String(opts?.question || '').trim();
  if (!question) throw new Error('a question is required');
  const limit = Math.min(Math.max(Number(opts?.limit) || 12, 1), 50);
  const sourceId = opts?.sourceId ?? SOURCE_ID;

  const payload = { query: question, limit, expand: true };
  // Scope to the venture's own source. One box per venture (D1), but a box whose gbrain also holds a
  // second source must never blend them — so the source is pinned explicitly rather than left to the
  // brain's default.
  if (sourceId) payload.source_id = sourceId;

  const stdout = await runGbrain(payload, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const hits = parseHits(stdout);
  const results = partitionForDepartment(hits, opts?.department);
  return { results, digest: formatDigest(results, { maxChars: opts?.maxChars ?? 4000 }) };
}

/** Build a RESEARCH question from a ticket's markdown (re-exported for the lane's CLI path). */
export { researchQuestion };

// ---- CLI ------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; continue; }
    out[key] = next;
    i += 1;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let question = typeof args.question === 'string' ? args.question : '';
  // --ticket is the lane's path: the RESEARCH step hands over the ticket and the question is
  // derived from it, so the supervisor never has to build a query in bash.
  if (!question && typeof args.ticket === 'string') {
    try {
      question = researchQuestion(readFileSync(args.ticket, 'utf8'));
    } catch (e) {
      console.error(`[brain] could not read ticket ${args.ticket}: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(2);
    }
  }
  if (!question) {
    console.error('usage: brain-query.mjs (--question "…" | --ticket <file>) [--department build] [--limit 12]');
    process.exit(2);
  }
  try {
    const { digest } = await askBrain({
      question,
      department: typeof args.department === 'string' ? args.department : null,
      limit: args.limit ? Number(args.limit) : undefined,
      maxChars: args.maxChars ? Number(args.maxChars) : undefined,
    });
    if (!digest) {
      console.error('[brain] no relevant pages in the venture brain for this question');
      process.exit(3);
    }
    process.stdout.write(`${digest}\n`);
  } catch (e) {
    // Fail loud (#10): the caller degrades to reading files, but the reason is on the record.
    console.error(`[brain] ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
