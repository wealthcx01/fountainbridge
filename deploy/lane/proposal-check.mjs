#!/usr/bin/env node
/**
 * Bash's CLI onto proposal-lib.mjs (FB-045). The supervisor is a shell script; the rules about what a
 * lane may propose live in tested JS, and this is the seam between them.
 *
 *   proposal-check.mjs validate <file> --department <d> --ticket <slug>
 *       exit 0  → valid; the NORMALISED proposal is written to stdout, ready to commit
 *       exit 1  → could not be read at all
 *       exit 4  → read fine, but refused; the problems are written to stderr, one per line
 *
 *   proposal-check.mjs id <slug>       → the approval id for a ticket
 *
 * The normalised object on stdout is what gets written to the approvals ref — never the lane's file
 * as it wrote it.
 */
import { readFileSync } from 'node:fs';
import { validateProposal, proposalId } from './proposal-lib.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : undefined;
};

if (cmd === 'id') {
  const slug = rest[0];
  if (!slug) { console.error('usage: proposal-check.mjs id <slug>'); process.exit(1); }
  process.stdout.write(proposalId(slug));
  process.exit(0);
}

if (cmd !== 'validate') {
  console.error('usage: proposal-check.mjs validate <file> [--department d] [--ticket slug] | id <slug>');
  process.exit(1);
}

const file = rest[0];
if (!file) { console.error('validate needs a file'); process.exit(1); }

let parsed;
try {
  parsed = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  // Exit 1, not 4: "the lane never wrote one" and "the lane wrote a bad one" are different failures
  // and the supervisor says different things to the founder about each.
  console.error(`could not read a proposal from ${file}: ${err.message}`);
  process.exit(1);
}

const { ok, problems, proposal } = validateProposal(parsed, {
  department: flag('department'),
  ticket: flag('ticket'),
});

if (!ok) {
  for (const p of problems) console.error(p);
  process.exit(4);
}
process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
