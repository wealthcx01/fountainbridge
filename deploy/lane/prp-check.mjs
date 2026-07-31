#!/usr/bin/env node
// The supervisor's CLI over prp-lib.mjs (FB-052). Bash asks; this answers.
//
//   prp-check.mjs validate <prp.md>              → exit 0 if it IS a PRP; else problems on stderr
//   prp-check.mjs gates    <prp.md>              → the gates, one "id<TAB>text" per line
//   prp-check.mjs report   <prp.md> <verdicts> [expected-gate-count]
//                                                → founder-facing gate report on stdout;
//                                                   exit 0 only if EVERY gate passed and the gate
//                                                   list still matches what was accepted; else 4
//   prp-check.mjs summary  <prp.md> <verdicts> [expected-gate-count]
//                                                → one-line failure summary for a RunReport
//
// <verdicts> is the JSON file the checking step writes: [{"id":"g1","pass":true,"why":"…"}]
// A gate nobody reported on counts as NOT passed (see applyVerdicts).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyVerdicts, failureSummary, formatGateReport, gates, missingDimensions, validate,
} from './prp-lib.mjs';

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    console.error(`[prp] cannot read ${path}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
}

function readVerdicts(path) {
  if (!path) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.gates) ? parsed.gates : []);
  } catch (e) {
    // A missing or unparseable verdict file must not read as "everything passed".
    console.error(`[prp] no usable verdicts in ${path}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

function main() {
  const [cmd, prpPath, verdictPath] = process.argv.slice(2);
  if (!cmd || !prpPath) {
    console.error('usage: prp-check.mjs <validate|gates|report|summary> <prp.md> [verdicts.json]');
    process.exit(2);
  }
  const text = read(prpPath);

  if (cmd === 'validate') {
    const { ok, problems, gateCount } = validate(text);
    if (!ok) { console.error(`[prp] not a usable PRP: ${problems.join('; ')}`); process.exit(1); }
    const missing = missingDimensions(text);
    // Advisory, on stderr so it lands in the lane log without polluting stdout.
    if (missing.length) console.error(`[prp] note: gates don't name ${missing.join(', ')}`);
    console.log(String(gateCount));
    return;
  }

  if (cmd === 'gates') {
    for (const g of gates(text)) console.log(`${g.id}\t${g.text}`);
    return;
  }

  if (cmd === 'report' || cmd === 'summary') {
    const checked = applyVerdicts(text, readVerdicts(verdictPath));
    // NO GATES CAN NEVER MEAN PASS. An empty list has no failures, so a naive "any failed?" check
    // returns success — turning the hard PRP gate into an unconditional pass exactly when the PRP
    // has been truncated or had its gates rewritten as prose. The file lives in the run directory
    // and is handed to model sessions that hold Write, so that is a reachable state, and the PR body
    // would still show the founder "PRP gates ✅".
    if (!checked.length) {
      console.log(formatGateReport(checked));
      console.error('[prp] no gates could be read from the PRP — refusing to report a pass');
      process.exit(4);
    }
    // The caller knows how many gates were there when the PRP was accepted. If the file has changed
    // underneath us since, its verdicts are not the ones we validated against.
    const expected = Number(process.argv[5]);
    if (Number.isFinite(expected) && expected > 0 && checked.length !== expected) {
      console.log(formatGateReport(checked));
      console.error(`[prp] the PRP changed since it was accepted (${expected} gates then, ${checked.length} now)`);
      process.exit(4);
    }
    const failed = checked.filter((g) => !g.pass);
    console.log(cmd === 'report' ? formatGateReport(checked) : failureSummary(checked));
    if (failed.length) process.exit(4);
    return;
  }

  console.error(`[prp] unknown command: ${cmd}`);
  process.exit(2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
