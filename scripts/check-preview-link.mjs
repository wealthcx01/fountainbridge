#!/usr/bin/env node
/**
 * Does a preview link actually open the preview? The I/O half (FB-243).
 *
 *     node scripts/check-preview-link.mjs https://foundry-studio-fountainbridge-pr-316.up.railway.app
 *
 * Exits 0 when the link opens the preview and it is serving; 1 otherwise. The judgement is in
 * `preview-link-lib.mjs`, which is pure and tested — this only fetches and prints.
 *
 * It does NOT check whether the preview is serving the right commit. That is a different question,
 * answered by the deployment's ref, and worth asking separately rather than folded in here.
 */
import { verdictFor } from './preview-link-lib.mjs';

const url = process.argv[2];
if (!url) {
  process.stderr.write('usage: check-preview-link.mjs <url>\n');
  process.exit(2);
}

/** Follow redirects by hand so every hop can be printed, not only the destination. */
async function follow(from, max = 10) {
  const hops = [];
  let current = from;
  for (let i = 0; i < max; i++) {
    const res = await fetch(current, { redirect: 'manual' });
    const location = res.headers.get('location');
    hops.push({ url: current, status: res.status, location: location ?? null });
    if (!location) return hops;
    current = new URL(location, current).toString();
  }
  return hops;
}

let expectedHost;
try {
  expectedHost = new URL(url).host;
} catch {
  process.stderr.write(`FAIL: ${url} is not an address.\n`);
  process.exit(2);
}

let hops = [];
try {
  hops = await follow(url);
} catch (err) {
  // A link that cannot be reached is a different failure from one that goes to the wrong place, and
  // saying which is the whole point of a check a person reads.
  process.stderr.write(`FAIL: could not reach ${url} — ${err.message}\n`);
  process.exit(1);
}

for (const h of hops) {
  process.stdout.write(`  ${h.status} ${h.url}${h.location ? ` → ${h.location}` : ''}\n`);
}

const verdict = verdictFor(hops, expectedHost);
if (!verdict.ok) {
  process.stderr.write(`\nFAIL: ${verdict.reason}\n`);
  process.exit(1);
}
process.stdout.write(`\nOK: ${verdict.reason}\n`);
