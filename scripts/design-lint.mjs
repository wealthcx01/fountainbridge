#!/usr/bin/env node
// design-lint (FB-057) — enforces the studio design contract (docs/studio-design-contract.md).
//
//   node scripts/design-lint.mjs            → lint app/ + components/; exit 1 on any violation
//   node scripts/design-lint.mjs --list     → print the rules and exit 0
//
// A design rubric nobody runs is a document, not a contract. These four rules are the ones that
// actually decay in review — each one is something a reviewer would have to spot by eye, every
// time, forever. So they run in CI instead.
//
// The rules are deliberately narrow. This is not a style engine: it catches the specific ways this
// studio drifts into a patchwork, and stays quiet otherwise.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The token source of truth is allowed to contain raw values — it is where they are defined. */
const TOKEN_SOURCE = join('app', 'globals.css');

export const RULES = {
  'raw-colour': 'a raw hex colour — use a --color-* / --tone-* token from app/globals.css',
  'raw-px': 'a raw px value — use a --fs-* token, or rem for layout',
  'raw-status-colour':
    'a status colour named directly — map the status to a tone in lib/status.ts and use toneColor()',
  'dead-control': 'a <button> that dispatches nothing — give it an onClick, a type="submit", or a form',
};

// --- rule implementations -------------------------------------------------------------------
// Each takes the file's text and returns [{ line, rule, snippet }]. Kept as pure functions over a
// string so they are testable without a filesystem.

const HEX = /#[0-9a-fA-F]{3,8}\b/;
// Every px value except `1px`. The hairline rule is an atom of this design system — the whole
// paper/ink aesthetic is built from 1px borders — so tokenising it would buy a `var()` and no
// clarity. Any OTHER px in a component is someone inventing a value off the scale, which is the
// drift this rule catches.
const PX = /\b(?!1px\b)\d+(?:\.\d+)?px\b/;
// The three status colours. Any other --color-* (paper, ink, border) is ordinary chrome and fine.
const STATUS_COLOUR = /var\(\s*--color-(ok|warn|error)\b/;

/** Strip the things that legitimately contain hex/px so they do not produce false positives. */
function stripNoise(line) {
  return line
    .replace(/\/\/.*$/, '') // line comment
    .replace(/\/\*.*?\*\//g, '') // inline block comment
    .replace(/https?:\/\/\S*/g, ''); // a URL fragment can carry a #anchor
}

function isBlockComment(state, line) {
  // Crude but sufficient: track /* ... */ spanning lines so doc comments never trip a rule.
  let inside = state.inside;
  if (!inside && /\/\*/.test(line) && !/\*\//.test(line)) state.inside = true;
  else if (inside && /\*\//.test(line)) state.inside = false;
  return inside;
}

/**
 * `<button` with nothing behind it. Scans from each `<button` to the end of its opening tag so a
 * multi-line JSX button is judged whole, not line by line.
 */
function deadControls(text) {
  const out = [];
  const lineAt = (index) => text.slice(0, index).split('\n').length;
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(text))) {
    const close = text.indexOf('>', m.index);
    if (close === -1) continue;
    const tag = text.slice(m.index, close);
    const dispatches =
      /\bonClick\b/.test(tag) ||
      /\btype\s*=\s*["'{]?submit/.test(tag) ||
      /\bform\s*=/.test(tag) ||
      /\bdisabled\b/.test(tag) || // an honestly-disabled control is not dead UI
      /\{\.\.\./.test(tag); // props spread in — cannot see it from here, trust it
    if (!dispatches) out.push({ line: lineAt(m.index), rule: 'dead-control', snippet: tag.trim().slice(0, 80) });
  }
  return out;
}

/**
 * Lint one file's contents.
 * @param {string} text
 * @param {string} relPath repo-relative, so the token-source exemption can be applied
 */
export function lintText(text, relPath) {
  const violations = [];
  const isTokenSource = relPath === TOKEN_SOURCE || relPath === TOKEN_SOURCE.split(sep).join('/');
  const isStyleSheet = relPath.endsWith('.css');
  const state = { inside: false };

  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    if (isBlockComment(state, raw)) return;
    const s = stripNoise(raw);
    if (!s.trim()) return;

    // The token source defines the raw values; everything else must reference them.
    if (!isTokenSource) {
      if (HEX.test(s)) violations.push({ line, rule: 'raw-colour', snippet: s.trim().slice(0, 80) });
      if (PX.test(s)) violations.push({ line, rule: 'raw-px', snippet: s.trim().slice(0, 80) });
    }
    // Status colours must go through a tone. The stylesheet is where --tone-* is wired TO --color-*,
    // so it is exempt; a component naming --color-warn is the drift this rule exists to catch.
    if (!isStyleSheet && STATUS_COLOUR.test(s)) {
      violations.push({ line, rule: 'raw-status-colour', snippet: s.trim().slice(0, 80) });
    }
  });

  if (relPath.endsWith('.tsx')) violations.push(...deadControls(text));
  return violations.sort((a, b) => a.line - b.line);
}

// --- driver ---------------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(tsx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  if (process.argv.includes('--list')) {
    for (const [rule, why] of Object.entries(RULES)) console.log(`${rule.padEnd(20)} ${why}`);
    return 0;
  }

  const root = process.cwd();
  const files = ['app', 'components'].flatMap((d) => {
    try {
      return walk(join(root, d));
    } catch {
      return []; // the surface does not exist yet — nothing to enforce
    }
  });

  let total = 0;
  for (const file of files.sort()) {
    const rel = relative(root, file).split(sep).join('/');
    const found = lintText(readFileSync(file, 'utf8'), rel);
    for (const v of found) {
      console.error(`${rel}:${v.line}  ${v.rule}  ${v.snippet}`);
      total++;
    }
  }

  if (total) {
    console.error(`\n${total} design-contract violation${total === 1 ? '' : 's'}.`);
    console.error('Rules: node scripts/design-lint.mjs --list · Contract: docs/studio-design-contract.md');
    return 1;
  }
  console.log(`design-lint: ${files.length} files clean.`);
  return 0;
}

// Only run when invoked directly — importing this for tests must not lint the repo.
if (process.argv[1] && process.argv[1].endsWith('design-lint.mjs')) process.exit(main());
