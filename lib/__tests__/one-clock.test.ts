import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { studioNow } from '../when';
import { defaultNow } from '../health';
import { ageRuns, engineState, engineStateAt, type RunReport } from '../runreports';
import { agoMs, howLongMs } from '../when';
import { buildOffice } from '../office';
import type { PrApproval } from '../attention';
import { prWaitingItem } from '../../components/WaitingQueue';

/**
 * The studio tells the time one way (FB-240).
 *
 * ## The fault this is written against
 *
 * The rail and the desk read the **same heartbeat** and said two different things about it:
 *
 *     the rail:  "Your team has not checked in for 70 days."
 *     the body:  "Your team checked in 10 minutes ago."
 *
 * Neither number was computed wrongly. `app/venture/[id]/layout.tsx` passed `Date.now()` and the desk
 * passed `defaultNow()`, which honours the pinned test clock — so the two sentences were answers to
 * different questions that looked like answers to the same one.
 *
 * `lib/rail.ts` already carried the comment *"The rail and the desk must not disagree about whether
 * the machine is alive, so they read the same thing the same way."* They did read the same thing. The
 * clock differed one level up, at the call site, where that comment was not. **A sentence in the
 * place that was already right cannot protect the place that is wrong** — which is why this is a
 * file and not a comment.
 *
 * ## The rule, and why it is not "never call Date.now()"
 *
 * There are two kinds of clock in this studio and only one of them is shared:
 *
 *   - **A clock the founder READS** — "checked in 3 minutes ago", staleness, how long something has
 *     waited. Every one of these must be the studio's single clock, or two surfaces disagree in
 *     front of a founder.
 *   - **A clock WRITTEN into a record** — `granted_at` on an approval, a thread's timestamp. These
 *     must be the real clock. Stamping a pinned test time into a signed grant would be a far worse
 *     bug than the one this ticket is about.
 *
 * So the source check below allows `new Date().toISOString()` (a write) and refuses every other raw
 * clock under `app/` (a read).
 */

const ROOT = join(import.meta.dirname, '..', '..');
const rel = (p: string) => relative(ROOT, p).split('\\').join('/');

function filesUnder(top: string): string[] {
  const out: string[] = [];
  const skip = new Set(['node_modules', '.next', '__tests__']);
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry) || entry.startsWith('.')) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
    }
  };
  walk(join(ROOT, top));
  return out;
}

const APP_FILES = filesUnder('app');

describe('the studio has one clock', () => {
  it('reads a real tree, so the check below means something', () => {
    // A guard on the guard: if the walk returned nothing, every assertion here would pass by finding
    // no violations anywhere.
    expect(APP_FILES.length).toBeGreaterThan(20);
    expect(APP_FILES.map(rel)).toContain('app/venture/[id]/layout.tsx');
  });

  it('`defaultNow` and `studioNow` are the same instant', () => {
    // Two functions that each parsed E2E_NOW were two clocks with one name between them. One now
    // delegates to the other; this fails if somebody re-implements it.
    process.env.E2E_NOW = '2026-07-22T00:00:00Z';
    try {
      expect(defaultNow()).toBe(studioNow());
      expect(defaultNow()).toBe(Date.parse('2026-07-22T00:00:00Z'));
    } finally {
      delete process.env.E2E_NOW;
    }
  });

  it('no screen reads a raw clock — only records written to disk may', () => {
    const offences: string[] = [];
    for (const file of APP_FILES) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
        for (const m of line.matchAll(/(?:Date\.now\(\)|new Date\(\))/g)) {
          const after = line.slice((m.index ?? 0) + m[0].length);
          // `new Date().toISOString()` is a timestamp being WRITTEN into a record. That must be the
          // real clock, and is allowed.
          if (m[0] === 'new Date()' && after.startsWith('.toISOString()')) continue;
          offences.push(`${rel(file)}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(
      offences,
      'a screen is reading a raw clock. Use studioNow() (or omit the argument and let the default '
      + 'apply) so every surface agrees — see the header of this file.',
    ).toEqual([]);
  });
});

/**
 * A screen that runs in the browser is handed an age, never a timestamp (FB-241).
 *
 * The check above guards the server. This guards the other half. `E2E_NOW` is not a `NEXT_PUBLIC_`
 * variable, so in the browser `studioNow()` silently falls back to the real clock — and the gate's
 * desk printed "Your team checked in 10 minutes ago" four lines above "Working on ARCA-6 now · 70
 * days ago", about the same machine. The sentence was worked out on the server; the row underneath
 * it in the browser.
 *
 * "Runs in the browser" means everything in a file marked `'use client'`, and every function that
 * code goes on to use, in any file — components and `lib/` alike. That is how `EngineActivity` got
 * there without saying so, and how the Sell line's "Last send went out 3 days ago" was still worked
 * out in the browser, three calls deep in `lib/`, after the first version of this check passed.
 * A server action (`'use server'`) is the exception: the browser can call it, but it runs on the
 * server.
 */
const CLIENT_CLOCK_HELPERS = ['ago', 'howLong', 'relativeDay', 'studioNow', 'defaultNow', 'ageMs', 'stampAgeMs'];

/** The modules that hold the studio's clock. Reaching one of the helpers above in them reads it. */
const CLOCK_MODULES = new Set(['lib/when.ts', 'lib/health.ts']);

/**
 * Every source file the browser could load: `app/`, `components/` and `lib/`.
 *
 * `lib/` matters as much as the other two. The Sell line on the desk was worked out in the browser
 * through two lib files — VentureBoard → `surfaceOutcome` (lib/desk) → `sellOutcome` (lib/sends) →
 * `howLong` — and the first version of this check stopped at `components/` and never saw it.
 */
const SOURCES = new Map(
  [...filesUnder('app'), ...filesUnder('components'), ...filesUnder('lib')].map((f) => [f, readFileSync(f, 'utf8')]),
);

/** The file an import names, or null for a package or anything outside the tree. */
function resolveImport(sources: Map<string, string>, from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2))
    : spec.startsWith('.') ? join(from, '..', spec)
      : null;
  if (!base) return null;
  for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (sources.has(p)) return p;
  }
  return null;
}

interface ModuleInfo {
  /** A local name → the file and the name it was imported as. `import type` is left out: it brings no code. */
  imports: Map<string, { file: string; name: string }>;
  /** `export { a as b } from './x'` → b → (x, a). */
  reexports: Map<string, { file: string; name: string }>;
  /** `export * from './x'`. */
  starExports: string[];
  /** Each top-level declaration by name — what can be reached on its own. */
  decls: Map<string, ts.Node[]>;
  /** Top-level statements that run when the file loads, whatever is imported from it. */
  init: ts.Node[];
  source: ts.SourceFile;
}

function analyse(sources: Map<string, string>, file: string): ModuleInfo {
  const text = sources.get(file) ?? '';
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const info: ModuleInfo = { imports: new Map(), reexports: new Map(), starExports: [], decls: new Map(), init: [], source };
  const addDecl = (name: string, node: ts.Node) => info.decls.set(name, [...(info.decls.get(name) ?? []), node]);
  const exported = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const isDefault = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

  for (const st of source.statements) {
    if (ts.isImportDeclaration(st)) {
      const target = resolveImport(sources, file, (st.moduleSpecifier as ts.StringLiteral).text);
      const clause = st.importClause;
      if (!target || !clause || clause.isTypeOnly) continue;
      if (clause.name) info.imports.set(clause.name.text, { file: target, name: 'default' });
      const nb = clause.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) info.imports.set(nb.name.text, { file: target, name: '*' });
      if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) {
          if (el.isTypeOnly) continue;
          info.imports.set(el.name.text, { file: target, name: (el.propertyName ?? el.name).text });
        }
      }
    } else if (ts.isExportDeclaration(st)) {
      if (st.isTypeOnly) continue;
      const target = st.moduleSpecifier ? resolveImport(sources, file, (st.moduleSpecifier as ts.StringLiteral).text) : null;
      if (st.moduleSpecifier && !target) continue;
      if (!st.exportClause) { if (target) info.starExports.push(target); continue; }
      if (ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          if (el.isTypeOnly) continue;
          const from = (el.propertyName ?? el.name).text;
          if (target) info.reexports.set(el.name.text, { file: target, name: from });
          else if (from !== el.name.text) addDecl(el.name.text, el);
        }
      }
    } else if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) {
      if (st.name) addDecl(st.name.text, st);
      if (exported(st) && isDefault(st)) addDecl('default', st);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) addDecl(d.name.text, d);
        else info.init.push(d);
      }
    } else if (ts.isExportAssignment(st)) {
      addDecl('default', st);
    } else if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) {
      // Types are erased; nothing to reach.
    } else {
      info.init.push(st);
    }
  }
  return info;
}

/** Names a piece of code refers to — not property names, which belong to some other object. */
function referencedNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isPropertyName = p && (
        (ts.isPropertyAccessExpression(p) && p.name === n)
        || (ts.isPropertyAssignment(p) && p.name === n)
        || (ts.isPropertyDeclaration(p) && p.name === n)
        || (ts.isMethodDeclaration(p) && p.name === n)
        || (ts.isPropertySignature(p) && p.name === n)
        || (ts.isJsxAttribute(p) && p.name === n));
      if (!isPropertyName) names.add(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return names;
}

/**
 * A raw clock in this piece of code, line by line.
 *
 * Two uses are allowed, each marked on its line so a reader sees why: a timestamp WRITTEN into a
 * record (`one-clock: written`), and a stopwatch (`one-clock: stopwatch`) — both ends read from the
 * same browser's clock, like a recording's length, which no other clock can disagree with.
 */
function rawClockLines(source: ts.SourceFile, node: ts.Node, name: string): string[] {
  const out: string[] = [];
  // Whole lines, so a note at the end of a line (`// one-clock: stopwatch`) is seen with it.
  const first = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
  const last = source.getLineAndCharacterOfPosition(node.getEnd()).line;
  source.text.split('\n').slice(first, last + 1).forEach((line, i) => {
    const t = line.trimStart();
    if (t.startsWith('//') || t.startsWith('*') || /one-clock: (?:written|stopwatch)/.test(line)) return;
    for (const m of line.matchAll(/Date\.now\(\)|new Date\(\)/g)) {
      const after = line.slice((m.index ?? 0) + m[0].length);
      if (m[0] === 'new Date()' && after.startsWith('.toISOString()')) continue;
      out.push(`${name}:${first + i + 1}  ${line.trim().slice(0, 90)}`);
    }
  });
  return out;
}

/**
 * Everything the browser runs, starting from each `'use client'` file and following what it actually
 * uses — into `lib/` too, one function at a time.
 *
 * Function by function, not file by file. `lib/runreports.ts` is imported by a browser component for
 * one small helper, and it also holds `ageRuns`, which the SERVER calls with the clock. Counting the
 * whole file would flag the server's correct use; counting only what the browser reaches flags only
 * what the browser really does.
 *
 * Returns the code reached (`file#name`) and every clock reading found in it.
 */
function browserClockUse(sources: Map<string, string>): { reached: Set<string>; offences: string[] } {
  const infos = new Map<string, ModuleInfo>();
  const info = (f: string) => { if (!infos.has(f)) infos.set(f, analyse(sources, f)); return infos.get(f)!; };
  const reached = new Set<string>();
  const offences: string[] = [];
  const isServerAction = (f: string) => /^\s*['"]use server['"]/.test(sources.get(f) ?? '');
  const queue: [string, string][] = [];
  // How each piece of code was reached, so a failure can say which screen it runs under.
  const via = new Map<string, string>();
  let current = '';
  const pathTo = (key: string): string => {
    const steps: string[] = [];
    for (let k: string | undefined = key; k; k = via.get(k)) {
      const [f, n] = k.split('#');
      steps.unshift(n === '*' ? rel(f) : `${rel(f)} ${n}`);
    }
    return steps.join(' → ');
  };
  const reach = (file: string, name: string) => {
    const key = `${file}#${name}`;
    if (reached.has(key)) return;
    reached.add(key);
    if (current) via.set(key, current);
    queue.push([file, name]);
  };
  for (const f of sources.keys()) {
    if (/^\s*['"]use client['"]/.test(sources.get(f) ?? '')) reach(f, '*');
  }

  // What a piece of code uses, and whether any of it is the clock.
  const follow = (file: string, node: ts.Node, label: string) => {
    const m = info(file);
    const route = `   (in the browser through ${pathTo(current)})`;
    offences.push(...rawClockLines(m.source, node, label).map((o) => o + route));
    for (const n of referencedNames(node)) {
      if (m.decls.has(n)) reach(file, n);
      const imp = m.imports.get(n);
      if (!imp) continue;
      if (CLOCK_MODULES.has(rel(imp.file))) {
        if (CLIENT_CLOCK_HELPERS.includes(imp.name) || imp.name === '*') {
          offences.push(`${label}  uses ${imp.name === '*' ? 'the clock module' : `${imp.name}()`} — reads "now" in the browser; pass an age from the server instead${route}`);
        }
        continue;
      }
      // A server action ('use server') runs on the server. The browser holds only a way to call it.
      if (isServerAction(imp.file)) continue;
      reach(imp.file, imp.name);
    }
  };

  while (queue.length) {
    const [file, name] = queue.pop()!;
    current = `${file}#${name}`;
    const m = info(file);
    const where = rel(file);
    // Loading a file runs its top level, whatever was asked of it.
    if (!reached.has(`${file}#<init>`)) {
      reached.add(`${file}#<init>`);
      for (const node of m.init) follow(file, node, `${where} (top level)`);
    }
    if (name === '*') {
      for (const d of m.decls.keys()) reach(file, d);
      for (const [n] of m.reexports) reach(file, n);
      for (const s of m.starExports) reach(s, '*');
      continue;
    }
    const nodes = m.decls.get(name);
    if (nodes) { for (const node of nodes) follow(file, node, `${where} ${name}`); continue; }
    const re = m.reexports.get(name);
    if (re) {
      if (CLOCK_MODULES.has(rel(re.file)) && CLIENT_CLOCK_HELPERS.includes(re.name)) {
        offences.push(`${where} re-exports ${re.name}() — reads "now" in the browser`);
      } else reach(re.file, re.name);
      continue;
    }
    for (const s of m.starExports) reach(s, name);
  }
  return { reached, offences };
}

describe('a screen in the browser is handed an age, never a timestamp (FB-241)', () => {
  const { reached, offences } = browserClockUse(SOURCES);
  const at = (f: string, name: string) => `${join(ROOT, f)}#${name}`;

  it('follows the browser into the code it actually runs, including lib/', () => {
    // A guard on the guard. EngineActivity has no 'use client' of its own; it renders in the browser
    // because VentureBoard uses it. If the walk missed it, this file would miss the bug it is for.
    expect(reached).toContain(at('components/VentureBoard.tsx', '*'));
    expect(reached).toContain(at('components/EngineActivity.tsx', 'EngineActivity'));
    expect(reached).toContain(at('components/OfficeLedger.tsx', 'OfficeLedger'));
    expect(reached).toContain(at('components/WaitingQueue.tsx', 'WaitingQueue'));
    // And into lib/, two files deep: VentureBoard → lib/desk → lib/sends, where the Sell line's
    // "Last send went out 3 days ago" is written. The first version of this check stopped short of it.
    expect(reached).toContain(at('lib/desk.ts', 'surfaceOutcome'));
    expect(reached).toContain(at('lib/sends.ts', 'sellOutcome'));
    // The server's own work is not the browser's. ageRuns is called by the desk page, on the server.
    expect(reached).not.toContain(at('lib/runreports.ts', 'ageRuns'));
    expect([...reached].some((k) => k.startsWith(join(ROOT, 'app/venture/[id]/page.tsx')))).toBe(false);
  });

  // A small made-up tree, so each shape is proven to be caught — a green result on the real tree
  // then means "none found", not "could not see one".
  const tree = (files: Record<string, string>) => browserClockUse(new Map(
    Object.entries({ 'lib/when.ts': 'export function howLong() {}', ...files })
      .map(([f, src]) => [join(ROOT, f), src]),
  )).offences;
  const client = (body: string) => `'use client';\n${body}`;

  it('catches a browser component that reads the clock itself', () => {
    expect(tree({ 'components/A.tsx': client("import { ago } from '@/lib/when';\nexport const A = () => ago('x');") })).toHaveLength(1);
    expect(tree({ 'components/A.tsx': client("import {\n  agoMs,\n  howLong as h,\n} from '@/lib/when';\nexport const A = () => h('x');") })).toHaveLength(1);
    expect(tree({ 'components/A.tsx': client('export function A() { const now = new Date(); return now; }') })).toHaveLength(1);
  });

  it('catches the same thing moved one file away, into a lib helper', () => {
    // The reviewer's case: the original bug, moved into lib/ and reached through a relative import.
    const found = tree({
      'components/A.tsx': client("import { runAgo } from '@/lib/runs';\nexport const A = () => runAgo();"),
      'lib/runs.ts': "import { howLong } from './when';\nexport const runAgo = () => howLong('x');",
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('lib/runs.ts runAgo');
    // Two files away, through a barrel that re-exports it.
    expect(tree({
      'components/A.tsx': client("import { runAgo } from '@/lib/index';\nexport const A = () => runAgo();"),
      'lib/index.ts': "export { runAgo } from './runs';",
      'lib/runs.ts': "import { now } from './clocky';\nexport const runAgo = () => now();",
      'lib/clocky.ts': 'export const now = () => Date.now();',
    })).toHaveLength(1);
  });

  it('leaves alone what only the server runs, and what reads no clock', () => {
    // The same lib file, with one function for the browser and one for the server.
    expect(tree({
      'components/A.tsx': client("import { label } from '@/lib/runs';\nexport const A = () => label();"),
      'lib/runs.ts': "import { howLong } from './when';\nexport const label = () => 'Run';\nexport const ageOnServer = () => howLong('x');",
    })).toEqual([]);
    expect(tree({ 'components/A.tsx': client("import type { ago } from '@/lib/when';\nexport const A = () => 1;") })).toEqual([]);
    expect(tree({ 'components/A.tsx': client("import { agoMs, howLongMs } from '@/lib/when';\nexport const A = () => agoMs(1);") })).toEqual([]);
    expect(tree({ 'components/A.tsx': client('export const A = (ms: number) => new Date(ms);') })).toEqual([]);
    expect(tree({ 'components/A.tsx': client('export const A = () => ({ recordedAt: new Date().toISOString() });') })).toEqual([]);
    expect(tree({ 'components/A.tsx': client('export const A = (t0: number) => Date.now() - t0; // one-clock: stopwatch') })).toEqual([]);
    // A server action runs on the server, even when a browser component is the one that calls it.
    expect(tree({
      'components/A.tsx': client("import { save } from '@/app/actions/x';\nexport const A = () => save();"),
      'app/actions/x.ts': "'use server';\nimport { howLong } from '@/lib/when';\nexport async function save() { return howLong('x'); }",
    })).toEqual([]);
  });

  it('no code the browser runs works out an age for itself', () => {
    expect(
      offences,
      'code that runs in the browser is reading "now" for itself. Work the age out on the server '
      + '(`ageMs` in lib/when.ts) and pass the number down; render it with `howLongMs` or `agoMs`. '
      + 'See FB-241 and the note on `howLongMs`.',
    ).toEqual([]);
  });
});

describe('the rail and the desk agree about the same heartbeat', () => {
  const HEARTBEAT = '2026-07-21T23:50:00Z';

  const checkIn = (at: string): RunReport => ({
    laneId: 'arca', startedAt: at, endedAt: at, trigger: 'scheduled', outcome: 'no-useful-work',
    summaryMd: 'Lane awake.', ticketsTouched: [], errorDetail: null, skillsUsed: [], prUrl: null,
    repo: 'arca', isHeartbeat: true,
  });

  afterEach(() => { delete process.env.E2E_NOW; });

  it('say the same sentence when neither is given a clock', () => {
    // The desk goes through `engineState`, the rail through `engineStateAt`. Same heartbeat, no
    // clock argument on either: the two paths a founder actually sees.
    process.env.E2E_NOW = '2026-07-22T00:00:00Z';
    const desk = engineState([checkIn(HEARTBEAT)]);
    const rail = engineStateAt(HEARTBEAT);
    expect(rail.text).toBe(desk.text);
    expect(rail.state).toBe(desk.state);
    expect(desk.text).toContain('checked in 10 minutes ago');
  });

  it('disagree the moment one of them is handed its own clock — which is the bug', () => {
    // Pinned as the fault reproduction. If this ever stops disagreeing, the seam has gone and the
    // source check above is the only thing left guarding it.
    process.env.E2E_NOW = '2026-07-22T00:00:00Z';
    const desk = engineState([checkIn(HEARTBEAT)]);
    const railWithItsOwnClock = engineStateAt(HEARTBEAT, new Date('2026-09-30T00:00:00Z'));
    expect(railWithItsOwnClock.text).not.toBe(desk.text);
    expect(railWithItsOwnClock.state).toBe('stalled');
    expect(desk.state).toBe('running');
  });
});

describe('the desk’s sentence and the rows under it agree (FB-241)', () => {
  // The gate's fixture, in miniature: a heartbeat ten minutes before the pinned "now", and a run that
  // was in flight at the same moment. Before FB-241 the sentence said "10 minutes" and the row,
  // working its age out in the browser against the real clock, said "70 days".
  const AT = '2026-07-21T23:50:00Z';
  const report = (over: Partial<RunReport>): RunReport => ({
    laneId: 'arca', startedAt: AT, endedAt: AT, trigger: 'scheduled', outcome: 'no-useful-work',
    summaryMd: 'Working on ARCA-6.', ticketsTouched: ['ARCA-6'], errorDetail: null, skillsUsed: [],
    prUrl: null, repo: 'arca', isHeartbeat: false, ...over,
  });

  afterEach(() => { delete process.env.E2E_NOW; });

  it('a run row says the same age as the check-in sentence above it', () => {
    process.env.E2E_NOW = '2026-07-22T00:00:00Z';
    const sentence = engineState([report({ isHeartbeat: true })]).text;
    const [row] = ageRuns([report({})], studioNow());
    expect(sentence).toContain('checked in 10 minutes ago');
    expect(agoMs(row.ageMs)).toBe('10 minutes ago');
  });

  it('the office ledger says how long against the same instant', () => {
    process.env.E2E_NOW = '2026-07-22T00:00:00Z';
    const office = buildOffice({
      departments: [{ id: 'build', name: 'Build', repo: 'arca', provisioned: true }],
      runs: [report({ endedAt: null, outcome: null })],
      waiting: [],
      engine: { state: 'running', text: 'Your team checked in 10 minutes ago.' },
    });
    expect(howLongMs(office.desks[0].sinceMs ?? NaN)).toBe('10 minutes');
  });
});

describe('a waiting row that cannot read its own date says so (FB-241)', () => {
  // The attention queue gives a pull request whose opening date it cannot read an age of 0. Before
  // FB-241 the row read the date itself, found nothing, and said "waiting on you". Handed the 0
  // instead, it would say "waiting a few seconds" about something that may have waited for weeks.
  const pr = (over: Partial<PrApproval>) => ({
    repo: 'arca', number: 7, title: 'x', linkedTicketId: null, ticketTitle: null,
    createdAt: '2026-07-15T00:00:00Z', ageMs: 7 * 86_400_000, ...over,
  }) as PrApproval;

  it('carries the server’s age when the date can be read', () => {
    expect(prWaitingItem(pr({}), 'arca').waitingMs).toBe(7 * 86_400_000);
  });

  it('says it does not know when the date cannot be read', () => {
    expect(prWaitingItem(pr({ createdAt: 'not a date', ageMs: 0 }), 'arca').waitingMs).toBeNull();
  });
});
