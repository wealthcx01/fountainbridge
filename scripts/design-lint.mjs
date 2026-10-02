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
/**
 * The one other file allowed to hold raw values (FB-141).
 *
 * The web app manifest and the `theme-color` meta tag are read by iOS and Android, not by CSS, so
 * they cannot reference a custom property — they need a literal. `lib/brand.ts` is where those
 * literals live, and a test asserts they still equal the tokens in `globals.css` they are copies of.
 * Exempted by name for the same reason the token source is: a declared source of values is not a
 * component inventing them.
 */
const OS_COLOUR_SOURCE = join('lib', 'brand.ts');

export const RULES = {
  'raw-colour': 'a raw hex colour — use a --color-* / --tone-* token from app/globals.css',
  'raw-px': 'a raw px value — use a --fs-* token, or rem for layout',
  'raw-status-colour':
    'a status colour named directly — map the status to a tone in lib/status.ts and use toneColor()',
  'dead-control': 'a <button> that dispatches nothing — give it an onClick, a type="submit", or a form',
  'testid-selector':
    'a stylesheet rule keyed on data-testid — style on the class; a test id must never be load-bearing layout',
  'state-glyph':
    'a ⚠ or ● marking a state — use <Mark tone> (components/Mark.tsx); an emoji is a different typeface at a size nobody chose and it does not take the tone colour',
  'undefined-token':
    'a var(--name) that nothing defines — the browser drops the whole line, so a border is not drawn and a background is see-through; use a token app/globals.css defines',
};

// --- rule implementations -------------------------------------------------------------------
// Each takes the file's text and returns [{ line, rule, snippet }]. Kept as pure functions over a
// string so they are testable without a filesystem.

/**
 * A glyph standing in for a state mark (FB-210).
 *
 * `⚠` and `●` survived on nine screens after FB-203 turned the desk's marks into squares, so the
 * studio marked state two ways depending on which screen you were on. An emoji is a different
 * typeface at a size nobody chose: it renders differently on every platform, and it does not take the
 * tone colour — a `⚠` beside amber text is whatever amber the vendor picked.
 *
 * `<Mark tone>` is the one mark. This rule is what stops the next screen inheriting the old habit,
 * which is the reason the glyphs came back at all: nothing checked.
 *
 * A line that STARTS as a comment is skipped, including the JSX brace-slash-star form, because a
 * comment explaining why the glyph is not used is prose about the rule rather than a rendered mark.
 * A glyph after code on the same line is still caught.
 *
 * `✓` and `✗` are NOT here. They are read as words by a screen reader in a way `●` is not, and the
 * places that use them are lists of checks rather than a state on a sentence. If they drift into
 * marking state, they earn their own line.
 */
const STATE_GLYPH = /[⚠●]/;

const HEX = /#[0-9a-fA-F]{3,8}\b/;
// Every px value except `1px`. The hairline rule is an atom of this design system — the whole
// paper/ink aesthetic is built from 1px borders — so tokenising it would buy a `var()` and no
// clarity. Any OTHER px in a component is someone inventing a value off the scale, which is the
// drift this rule catches.
const PX = /\b(?!1px\b)\d+(?:\.\d+)?px\b/;
// The three status colours. Any other --color-* (paper, ink, border) is ordinary chrome and fine.
const STATUS_COLOUR = /var\(\s*--color-(ok|warn|error)\b/;
/**
 * A CSS selector that keys on a test id.
 *
 * FB-158: the phone media query hid the rail with `[data-testid='rail']`. Renaming the waiting
 * shell's id — so a test could tell the shell apart from the real rail — took it straight out of
 * that rule, and a 250px rail appeared on a 393px screen again. That is FB-124's defect, the one
 * the CLAUDE.md #2 amendment was written about, returning through a test id.
 *
 * A test id names a thing for a test. If layout depends on it, renaming it is a visual change that
 * nothing but a browser at the right width can see.
 */
const TESTID_SELECTOR = /\[data-testid[~^$*|]?=/;

/**
 * A token used but never defined (FB-150).
 *
 * `var(--color-rule)` and `var(--color-surface)` sat in three components for months. Neither was
 * defined anywhere. A browser treats a `var()` that points at nothing as if the whole line were
 * missing: `border: 1px solid var(--color-rule)` drew no border, and every text box in the
 * composer was an unmarked strip on the page's own background. The raw-colour rule was satisfied,
 * because it saw a token, and nothing checked that the token existed.
 *
 * A name built while the page runs (`var(--tone-${tone})`) cannot be checked from the text, so a
 * name followed straight by `${` is left alone. `lib/status.ts` is the one place that does it, and
 * its own test pins every tone it can produce.
 */
const VAR_USE = /var\(\s*(--[A-Za-z0-9_-]+)(?![A-Za-z0-9_-]|\$\{)/g;
/** `--name:` in a stylesheet, or `'--name':` set inline on an element. */
const PROPERTY_DEFINITION = /(?:^|[\s{;'"])(--[A-Za-z0-9_-]+)['"]?\s*:/gm;
/** next/font hands a typeface over as a custom property: `variable: '--font-inter'`. */
const FONT_VARIABLE = /\bvariable\s*:\s*['"](--[A-Za-z0-9_-]+)['"]/g;

/**
 * Every custom property one file defines. Pure, so the driver can collect them across the whole
 * surface and a test can check a single file's text.
 * @param {string} text
 * @returns {Set<string>}
 */
export function definedProperties(text) {
  const out = new Set();
  for (const re of [PROPERTY_DEFINITION, FONT_VARIABLE]) {
    for (const m of text.matchAll(re)) out.add(m[1]);
  }
  return out;
}

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
 * @param {Set<string>} [defined] every custom property the studio defines. When given, a var() of
 *   anything else is a violation. Left out, that one rule does not run.
 */
export function lintText(text, relPath, defined) {
  const violations = [];
  const declaresValues = (p) => relPath === p || relPath === p.split(sep).join('/');
  const isTokenSource = declaresValues(TOKEN_SOURCE) || declaresValues(OS_COLOUR_SOURCE);
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
    // Founder-facing markup only. The glyph is fine in a comment explaining why it is not used, and
    // in this linter's own rule text — both of which are prose about the rule, not a rendered mark.
    if (relPath.endsWith('.tsx') && STATE_GLYPH.test(s) && !/^\s*(\*|\/\/|\/\*|\{\/\*)/.test(s)) {
      violations.push({ line, rule: 'state-glyph', snippet: s.trim().slice(0, 80) });
    }
    // Only in stylesheets: a `data-testid` in JSX is the test id itself, which is the point of it.
    if (isStyleSheet && TESTID_SELECTOR.test(s)) {
      violations.push({ line, rule: 'testid-selector', snippet: s.trim().slice(0, 80) });
    }
    if (defined) {
      for (const m of s.matchAll(VAR_USE)) {
        if (!defined.has(m[1])) {
          violations.push({ line, rule: 'undefined-token', snippet: `${m[1]} is used here but defined nowhere` });
        }
      }
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

  // Definitions are collected across every file first: a token is defined once, in
  // app/globals.css, and used everywhere else. next/font's typefaces are defined in app/layout.tsx.
  const texts = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
  const defined = new Set();
  for (const text of texts.values()) for (const name of definedProperties(text)) defined.add(name);

  let total = 0;
  for (const file of files.sort()) {
    const rel = relative(root, file).split(sep).join('/');
    const found = lintText(texts.get(file), rel, defined);
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
