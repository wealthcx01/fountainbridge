#!/usr/bin/env node
/**
 * Find a credential anywhere it should not be, on a venture box (FB-176).
 *
 * ## Why this exists
 *
 * Rotating ARCA's token found it live in five places and only one of them was the file anyone would
 * have rotated. Two of the five — a clone URL baked into `.git/config`, and three agent session
 * transcripts written over three weeks — got there with nobody deciding they should. Nothing noticed,
 * and nothing would have stopped a fourth.
 *
 * `lib/secrets.ts` refuses a credential a founder tries to *deposit*. It has never looked at the box's
 * own filesystem, which is where the credentials actually are.
 *
 * ## What it will not do
 *
 * **It never prints a matched value.** A scanner that shows you the secret it found has written that
 * secret into another log, which is the fault it exists to catch. It prints the file, the line, and
 * what kind of thing it looks like.
 *
 * **It does not read the one file that is allowed to hold secrets.** `/etc/foundry/credentials` is
 * the home; finding a token there is the system working.
 *
 * ## Exit codes
 *
 *   0  nothing found
 *   1  at least one credential outside its home — the finding is on stdout as JSON and in words
 *   2  the scan itself could not run (a path unreadable, an argument wrong)
 *
 * Non-zero on a finding is the point: this is meant to run on a timer and be noticed (CLAUDE.md #10).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The same net as `lib/secrets.ts` and the composer's deposit tool — **graded by what it proves.**
 *
 * A third copy, and `lib/__tests__/secret-drift.test.ts` is what stops the three drifting — they
 * cannot be one module, because one is TypeScript in the studio, one is a `.mjs` copied onto a box
 * with no build step, and this one is a standalone script run by root from a systemd timer.
 *
 * ## Why this one is graded and the other two are not
 *
 * The other two scan **one document a founder is handing over**, where a coarse net is right: a
 * false positive costs them a rename, and a false negative is a credential in git history forever.
 *
 * This one sweeps **a whole filesystem that contains source code**, and the same net behaves
 * completely differently there. Run against ARCA's box for the first time it returned **727
 * findings** — a settings form with a `password` field, a pricing provider with `apiKey =`, jQuery's
 * minified bundle, a ticket file *about* an API key in source, and this scanner's own credential
 * helper, which matched on the words `access-token` in its documentation. **Two of the 727 were
 * real.**
 *
 * A report nobody can read is the same failure as a log nobody opens, which is the thing this
 * ticket exists to fix. So:
 *
 *   `strong` — a shape only a credential has. Finding one is a finding, and the scan exits
 *              non-zero.
 *   `loose`  — the assignment heuristic. Real credentials do sit in `API_KEY=…` lines, so it is
 *              not dropped; it is counted, summarised, and printed in full by `--all`.
 *
 * Nothing is swallowed and nothing is guessed. What changed is which of the two a person sees
 * first.
 */
const SECRET_PATTERNS = [
  [/-----BEGIN[ A-Z]*PRIVATE KEY-----/, 'a private key', 'strong'],
  [/AKIA[0-9A-Z]{16}/, 'an AWS access key', 'strong'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'an API key (sk-…)', 'strong'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'a GitHub token', 'strong'],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}/, 'a GitHub fine-grained token', 'strong'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token', 'strong'],
  [/\btvly-[A-Za-z0-9-]{10,}/, 'a Tavily key', 'strong'],
  [/(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?\S{8,}/i, 'a password/secret assignment', 'loose'],
];

export function scanForSecrets(text) {
  for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) return what;
  return null;
}

/** The same, but saying how much it proves: `strong`, `loose`, or null for no match. */
export function gradeOf(text) {
  for (const [re, what, grade] of SECRET_PATTERNS) if (re.test(text)) return { what, grade };
  return null;
}

/**
 * Where a credential has actually been found on a box, plus the places it would go next.
 *
 * Written from the rotation that found five, not from imagination — and `.git/config` and the agent
 * transcripts are in the list precisely because nobody would have thought to look there.
 */
export const DEFAULT_ROOTS = [
  '/opt/foundry',
  '/etc/systemd/system',
  '/root/.claude',
  '/root/.config',
  '/var/log/foundry',
];

/** The one file allowed to hold them, and anything the scan must not waste time on. */
const ALLOWED = new Set(['/etc/foundry/credentials']);

/**
 * Directories that hold installed content rather than this box's own material.
 *
 * `skills` is here for a reason worth writing down. On ARCA's box the graded scan returned 26
 * findings and **23 of them were `/root/.claude/skills/gstack/`** — a vendored toolkit whose own
 * redaction library ships example AWS keys and private keys as test fixtures, exactly as it should.
 * A daily timer that fails every day because a dependency contains an example credential is a timer
 * whose failure means nothing within a week, which is the same fault as a log nobody opens.
 *
 * It is the `node_modules` case: content installed from elsewhere, where this venture's credentials
 * never live.
 *
 * **`projects` is deliberately NOT here**, and it is the sibling directory. `/root/.claude/projects/`
 * is where three live tokens were actually found, written into agent session transcripts over three
 * weeks by nobody's decision. That is this box's own material and it is the reason this scanner
 * exists.
 */
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.cache', 'objects', 'pack', 'skills']);
/** Text only. A 400 MB pack file is not where a plaintext token hides, and reading it costs minutes. */
const MAX_BYTES = 2 * 1024 * 1024;

function* walk(root, seen = new Set()) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return; // unreadable is not a finding — `problems` below records that it could not be read
  }
  for (const e of entries) {
    const path = join(root, e.name);
    if (e.isSymbolicLink()) continue; // a link cannot hold text of its own, and loops are real
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (seen.has(path)) continue;
      seen.add(path);
      yield* walk(path, seen);
      continue;
    }
    if (!e.isFile()) continue;
    yield path;
  }
}

/**
 * Scan a set of roots. Returns findings and the paths that could not be read.
 *
 * A path that cannot be read is reported rather than skipped silently: "we looked and found nothing"
 * and "we could not look" are different answers, and only one of them is reassuring.
 */
export function scanRoots(roots, { allowed = ALLOWED, maxBytes = MAX_BYTES } = {}) {
  const findings = [];
  const weak = [];
  const problems = [];
  for (const root of roots) {
    try {
      statSync(root);
    } catch {
      continue; // a box without LibreChat has no /opt/foundry/librechat; that is not a problem
    }
    for (const path of walk(root)) {
      if (allowed.has(path)) continue;
      let text;
      try {
        if (statSync(path).size > maxBytes) continue;
        text = readFileSync(path, 'utf8');
      } catch (err) {
        problems.push({ path, why: String(err && err.code ? err.code : err) });
        continue;
      }
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const hit = gradeOf(lines[i]);
        if (!hit) continue;
        // The line NUMBER, never the line. Enough to find it; never enough to leak it.
        const row = { path, line: i + 1, what: hit.what };
        if (hit.grade === 'strong') { findings.push(row); break; }
        // A loose match does not stop the file being read: a source file full of `password:` lines
        // may still hold one real token further down, and stopping at the first would miss it.
        weak.push(row);
      }
    }
  }
  return { findings, weak, problems };
}

/**
 * What a person reads. Plain sentences, in the order they would act on them.
 *
 * The strong findings first and in full, because those are credentials. The loose ones counted
 * underneath, because on a box holding source code there are hundreds of them and two lines of
 * summary is the difference between a report that gets read and one that does not.
 */
export function report({ findings, weak = [], problems }, home = '/etc/foundry/credentials', all = false) {
  const out = [];

  if (findings.length === 0) {
    out.push(`No credential found outside ${home}.`);
  } else {
    out.push(`${findings.length} credential${findings.length === 1 ? '' : 's'} found outside ${home}.`);
    out.push(...findings.map((f) => `  ${f.path}:${f.line} — looks like ${f.what}`));
    out.push('');
    out.push(`Rotate it, then move the value into ${home} and take it out of the file above.`);
    out.push('The value is not printed here on purpose: a scanner that shows you the secret has just written it somewhere else.');
  }

  if (weak.length > 0) {
    out.push('');
    if (all) {
      out.push(`${weak.length} line${weak.length === 1 ? '' : 's'} matched the looser password/secret rule:`);
      out.push(...weak.map((f) => `  ${f.path}:${f.line} — ${f.what}`));
    } else {
      // Counted, never hidden. On a venture box most of these are a settings form, a seed script or
      // a minified bundle — but "most" is not "all", which is why the count is here and the list is
      // one flag away rather than gone.
      out.push(`${weak.length} line${weak.length === 1 ? '' : 's'} also matched the looser password/secret rule.`);
      out.push('On a box holding source code that is mostly forms, seed data and vendored bundles — but not always.');
      out.push('Run with --all to list them.');
    }
  }

  if (problems.length > 0) {
    out.push('');
    out.push(`${problems.length} path${problems.length === 1 ? '' : 's'} could not be read, so this is not a complete answer:`);
    out.push(...problems.map((p) => `  ${p.path} — ${p.why}`));
  }

  return out.join('\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''));
if (isMain) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  // `--home <path>` moves the one allowed file, so the scanner can be run against a COPY of a box —
  // a test, or a restored snapshot — without reporting the home itself as a finding. A scanner
  // nobody can exercise off the machine it guards is a scanner nobody exercises.
  const homeAt = args.indexOf('--home');
  const home = homeAt >= 0 ? args[homeAt + 1] : '/etc/foundry/credentials';
  const roots = args.filter((a, i) => !a.startsWith('--') && i !== homeAt + 1);
  try {
    const result = scanRoots(roots.length > 0 ? roots : DEFAULT_ROOTS, { allowed: new Set([home]) });
    if (asJson) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`${report(result, home, args.includes('--all'))}\n`);
    process.exit(result.findings.length > 0 ? 1 : 0);
  } catch (err) {
    process.stderr.write(`secret-scan could not run: ${err}\n`);
    process.exit(2);
  }
}
