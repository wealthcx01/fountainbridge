import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { studioNow } from '../when';
import { defaultNow } from '../health';
import { ageRuns, engineState, engineStateAt, type RunReport } from '../runreports';
import { agoMs, howLongMs } from '../when';
import { buildOffice } from '../office';

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
 * "Runs in the browser" means a file marked `'use client'`, or one such a file imports — those
 * render in the browser too, which is exactly how `EngineActivity` got there without saying so.
 */
const CLIENT_CLOCK_HELPERS = ['ago', 'howLong', 'relativeDay', 'studioNow', 'defaultNow', 'ageMs', 'stampAgeMs'];

function clientModules(): string[] {
  const all = [...filesUnder('app'), ...filesUnder('components')];
  const byPath = new Map(all.map((f) => [f, readFileSync(f, 'utf8')]));
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2))
      : spec.startsWith('.') ? join(from, '..', spec)
        : null;
    if (!base) return null;
    for (const p of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
      if (byPath.has(p)) return p;
    }
    return null;
  };
  const queue = all.filter((f) => /^\s*['"]use client['"]/.test(byPath.get(f) ?? ''));
  const seen = new Set(queue);
  while (queue.length) {
    const file = queue.pop()!;
    for (const m of (byPath.get(file) ?? '').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const dep = resolve(file, m[1]);
      if (dep && !seen.has(dep)) { seen.add(dep); queue.push(dep); }
    }
  }
  return [...seen];
}

/** What a browser-side file does with the clock that it must not. */
function clientClockOffences(file: string, source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(/import\s*{([^}]*)}\s*from\s*['"]@\/lib\/(?:when|health)['"]/g)) {
    const names = m[1].split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean);
    for (const n of names.filter((x) => CLIENT_CLOCK_HELPERS.includes(x))) {
      out.push(`${file}  imports ${n}() — reads "now" in the browser; pass an age from the server instead`);
    }
  }
  source.split('\n').forEach((line, i) => {
    const t = line.trimStart();
    if (t.startsWith('//') || t.startsWith('*') || line.includes('one-clock: written')) return;
    for (const m of line.matchAll(/Date\.now\(\)|new Date\(\)/g)) {
      const after = line.slice((m.index ?? 0) + m[0].length);
      if (m[0] === 'new Date()' && after.startsWith('.toISOString()')) continue;
      out.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  });
  return out;
}

describe('a screen in the browser is handed an age, never a timestamp (FB-241)', () => {
  const CLIENT = clientModules();

  it('finds the browser-side files, including the ones that never say so', () => {
    // A guard on the guard. EngineActivity has no 'use client' of its own; it renders in the browser
    // because VentureBoard imports it. If the walk missed it, this file would miss the bug it is for.
    const names = CLIENT.map(rel);
    expect(names).toContain('components/VentureBoard.tsx');
    expect(names).toContain('components/EngineActivity.tsx');
    expect(names).toContain('components/OfficeLedger.tsx');
    expect(names).toContain('components/WaitingQueue.tsx');
    expect(names).not.toContain('app/venture/[id]/page.tsx');
  });

  it('catches the shapes it is looking for', () => {
    // So a green result below means "none found", not "could not see one".
    expect(clientClockOffences('x.tsx', "import { ago } from '@/lib/when';")).toHaveLength(1);
    expect(clientClockOffences('x.tsx', "import { howLongMs, type Foo, howLong as h } from '@/lib/when';")).toHaveLength(1);
    expect(clientClockOffences('x.tsx', "import { agoMs, howLongMs, onDate } from '@/lib/when';")).toEqual([]);
    expect(clientClockOffences('x.tsx', '  const now = new Date();')).toHaveLength(1);
    expect(clientClockOffences('x.tsx', '  const now = new Date(nowMs);')).toEqual([]);
    expect(clientClockOffences('x.tsx', '  recordedAt: new Date().toISOString(),')).toEqual([]);
  });

  it('no browser-side file works out an age for itself', () => {
    const offences = CLIENT.flatMap((f) => clientClockOffences(rel(f), readFileSync(f, 'utf8')));
    expect(
      offences,
      'a component that renders in the browser is reading "now" for itself. Work the age out on the '
      + 'server (`ageMs` in lib/when.ts) and pass the number down; render it with `howLongMs` or '
      + '`agoMs`. See FB-241 and the note on `howLongMs`.',
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
