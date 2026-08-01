#!/usr/bin/env node
/**
 * Fail loudly when a ticket file disagrees with what shipped (FB-070).
 *
 * Run by CI. It reads every ticket's `**Status:**` line and every commit on the default branch, and
 * reports any ticket whose work is in the history while its file still says it is in progress.
 *
 * This exists because eight tickets said "In review" for work that was merged and deployed, and the
 * only reason anyone noticed was that someone happened to check. The board is the answer to "what is
 * happening in my company"; a founder who catches it lying once stops believing the rest of it.
 *
 * Offline and deterministic — it reads the git history that is already on the runner, so it needs no
 * token, no network, and gives the same answer on every machine.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { findDrift, idFromFilename, partShippedReason, statusFromMarkdown, ticketsShippedBy } from '../lib/ticket-drift.ts';

const TICKETS = process.env.TICKETS_DIR ?? 'docs/tickets';
const BRANCH = process.env.DRIFT_BRANCH ?? 'origin/main';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function tickets() {
  return readdirSync(TICKETS)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const id = idFromFilename(f);
      if (!id) return null;
      const markdown = readFileSync(join(TICKETS, f), 'utf8');
      const status = statusFromMarkdown(markdown);
      return status
        ? { id, status, file: join(TICKETS, f), partShipped: partShippedReason(markdown) }
        : null;
    })
    .filter(Boolean);
}

/**
 * Walk the history once, collecting which tickets have a commit that did real work.
 *
 * `--name-only` with a `\x00`-delimited record separator so a filename containing a newline cannot
 * split one commit into two — the parser has to be dull, because a false "shipped" reported at a
 * developer is how a check gets switched off.
 */
function evidence() {
  let log;
  try {
    log = git(['log', BRANCH, '--name-only', '--format=%x00%h%x1f%s%x1f%x1f']);
  } catch {
    // A shallow clone or a missing remote ref: say so rather than passing silently, because a check
    // that quietly does nothing is indistinguishable from a check that found nothing.
    console.error(`ticket-drift: could not read history for ${BRANCH}.`);
    console.error('Fetch it first (CI: actions/checkout with fetch-depth: 0), or set DRIFT_BRANCH.');
    process.exit(2);
  }

  const shipped = new Set();
  const commitFor = new Map();

  for (const record of log.split('\x00').slice(1)) {
    const [sha, subject, , files = ''] = record.split('\x1f');
    if (!sha) continue;
    const paths = files.split('\n').map((p) => p.trim()).filter(Boolean);

    for (const id of ticketsShippedBy({ subject, paths })) {
      if (shipped.has(id)) continue;   // keep the newest commit, which is the one being walked first
      shipped.add(id);
      commitFor.set(id, `${sha} ${subject.trim()}`);
    }
  }
  return { shipped, commitFor };
}

const found = findDrift(tickets(), evidence());

if (found.length === 0) {
  console.log('ticket-drift: every ticket agrees with the history.');
  process.exit(0);
}

console.error(`ticket-drift: ${found.length} ticket${found.length === 1 ? '' : 's'} disagree with what shipped.\n`);
for (const d of found) console.error(`  ${d.file}\n    ${d.message}\n`);
console.error('The board shows a founder what these files say. If one of them is wrong, so is the board.');
process.exit(1);
