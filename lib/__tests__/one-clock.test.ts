import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { studioNow } from '../when';
import { defaultNow } from '../health';
import { engineState, engineStateAt, type RunReport } from '../runreports';

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

describe('the rail and the desk agree about the same heartbeat', () => {
  const HEARTBEAT = '2026-07-21T23:50:00Z';

  const checkIn = (at: string): RunReport => ({
    laneId: 'arca', startedAt: at, endedAt: at, trigger: 'scheduled', outcome: 'no-useful-work',
    summaryMd: 'Lane awake.', ticketsTouched: [], errorDetail: null, prUrl: null,
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
