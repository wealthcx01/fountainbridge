/**
 * Read the implement phase's hand-off file into the PR body (FB-060).
 *
 *   node handoff-check.mjs body <file>      → the markdown for the PR body (falls back on stdin)
 *   node handoff-check.mjs summary <file>   → the one line for the RunReport
 *
 * Exit 0 with a usable answer, always. A missing or malformed hand-off must not stop a lane that has
 * already done the work and passed its gates — it degrades to the fallback and says so on stderr,
 * which is the difference between "we lost the caveats" and "we lost the PR".
 */

import { readFileSync } from 'node:fs';
import { handoffMarkdown, readHandoff, summaryLine } from './handoff-lib.mjs';

const [mode, file] = process.argv.slice(2);
const log = (...a) => console.error('[handoff]', ...a);

/** What the PR body says when there is no hand-off: the truth, not a plausible sentence. */
const FALLBACK_SUMMARY = 'Lane worked the ticket.';
const FALLBACK_BODY = `${FALLBACK_SUMMARY}\n\n_The lane did not leave a written hand-off for this run, so this description is the harness's own. Read the change itself._`;

function load() {
  if (!file) return null;
  try {
    return readHandoff(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    log(`could not read ${file}: ${err.message}`);
    return null;
  }
}

const handoff = load();
if (!handoff) log('no usable hand-off — falling back');

if (mode === 'summary') {
  process.stdout.write(handoff ? summaryLine(handoff) : FALLBACK_SUMMARY);
} else {
  process.stdout.write(handoff ? handoffMarkdown(handoff) : FALLBACK_BODY);
}
