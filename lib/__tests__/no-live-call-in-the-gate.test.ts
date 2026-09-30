import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { historyIsReadable, historyForBounded, HISTORY_READ_TIMEOUT_MS } from '../activegraph-log';

/**
 * The UI gate makes no live call, and a read that stalls says so (FB-217).
 *
 * ## What this is guarding
 *
 * Every read in the studio has a fixture path selected by `E2E_TEST_LOGIN` plus a `*_FIXTURE_DIR`, so
 * the gate runs offline and deterministically. **One did not**: the approval page called GitHub for the
 * signed record.
 *
 * An unauthenticated client is not an error. It is sixty requests an hour and then a stall, so the page
 * did not fail — it never returned, and Playwright reported `net::ERR_ABORTED` after 35 seconds. That
 * message names neither the token, nor the network, nor GitHub.
 *
 * It cost an hour on FB-214, and it happened again on 2026-09-30 to a pull request containing four
 * markdown files and no code. **A required gate whose result depends on a third party's response time
 * teaches people to re-run it**, and a gate people re-run past is how FB-124 shipped a studio with two
 * navigations.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const RIG = { APPROVALS_FIXTURE_DIR: 'e2e/fixtures/approvals', E2E_TEST_LOGIN: '1', FOUNDRY_APPROVAL_SECRET: 's' };

describe('the gate reads no approval record over the network', () => {
  it('refuses to read in the rig, however well configured it is', () => {
    expect(historyIsReadable(RIG)).toBe(false);
  });

  it('reads in production, where there is a record and a secret', () => {
    expect(historyIsReadable({ FOUNDRY_APPROVAL_SECRET: 's' })).toBe(true);
  });

  it('does not read without a secret, because nothing could be verified', () => {
    // Showing events as unverified when the studio simply has no key would be an accusation rather
    // than a fact, which is the reasoning lib/trail-sources.ts already records for the trail.
    expect(historyIsReadable({})).toBe(false);
    expect(historyIsReadable({ FOUNDRY_APPROVAL_SECRET: '' })).toBe(false);
  });

  it('needs BOTH rig signals to stand down, so a stray variable cannot blind production', () => {
    // A fixture directory left set on a production machine must not silently stop the record being
    // read — that would hide a real history behind an environment variable nobody meant.
    expect(historyIsReadable({ APPROVALS_FIXTURE_DIR: 'x', FOUNDRY_APPROVAL_SECRET: 's' })).toBe(true);
    expect(historyIsReadable({ E2E_TEST_LOGIN: '1', FOUNDRY_APPROVAL_SECRET: 's' })).toBe(true);
  });
});

describe('a read that cannot finish says so, rather than hanging', () => {
  /** A client whose request never settles — an unauthenticated GitHub, in one object. */
  const stalls = { request: () => new Promise(() => {}), getFileContent: () => new Promise(() => {}) } as never;

  it('gives up and states the reason', async () => {
    const started = Date.now();
    const r = await historyForBounded(stalls, 'arca', 'arca', 'send-1', 'secret', 40);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/did not answer/i);
      // The number is in the message on purpose: "it timed out" sends someone hunting, "it did not
      // answer within 40ms" tells them which knob exists.
      expect(r.reason).toMatch(/40/);
    }
  });

  it('returns the history when the read succeeds, and does not wait out the timeout', async () => {
    const empty = { request: async () => { throw new Error('no dir'); }, getFileContent: async () => null } as never;
    const started = Date.now();
    const r = await historyForBounded(empty, 'arca', 'arca', 'send-1', 'secret', 5_000);
    // If the timer were not cleared, a fast success would still hold the process for the full bound.
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(r.ok).toBe(true);
  });

  it('bounds the real read at something a person would wait but a test would not', () => {
    expect(HISTORY_READ_TIMEOUT_MS).toBeGreaterThan(1_000);
    // Playwright's own failure came at 35 seconds. The bound has to be comfortably inside that or it
    // is not a bound, it is a slower way to reach the same timeout.
    expect(HISTORY_READ_TIMEOUT_MS).toBeLessThan(30_000);
  });
});

describe('nothing else in the studio reads over the network without a way out', () => {
  /** Every page and layout a request can land on. */
  function pageFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/^(page|layout|route)\.tsx?$/.test(entry)) out.push(path);
      }
    };
    walk(join(ROOT, 'app'));
    return out;
  }

  const FILES = pageFiles();
  const rel = (p: string) => relative(ROOT, p).split('\\').join('/');

  it('found the pages, so the check below means something', () => {
    // The guard on the guard. A renamed directory would otherwise make this pass by finding nothing —
    // the vacuous-test shape this project has now hit five times.
    expect(FILES.length).toBeGreaterThan(5);
    expect(FILES.map(rel)).toContain('app/venture/[id]/approvals/[repo]/[approvalId]/page.tsx');
  });

  it('every page that builds a GitHub client can be told not to', () => {
    // This is the criterion "something fails if a new page adds a live call to the gate". It does not
    // forbid the client — most pages legitimately read from GitHub — it requires that each one route
    // through a seam the rig can switch off. The names below are those seams.
    const WAYS_OUT = [
      'historyIsReadable',    // FB-217, this page
      'FIXTURE_DIR',          // the established pattern: a fixture source selected by env
      'E2E_TEST_LOGIN',       // the rig switch itself
      'trailSources',         // carries its own testRig check
      'loadVentureHealth',    // fixture-backed loader
      'ventureRuns', 'ventureApprovals', 'loadVentureAttention', 'loadRunReports',
    ];
    const offenders = FILES
      .filter((f) => /new GitHubClient\(/.test(readFileSync(f, 'utf8')))
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return !WAYS_OUT.some((w) => src.includes(w));
      })
      .map(rel);
    expect(offenders, 'a page builds a GitHub client with no way for the gate to avoid it').toEqual([]);
  });
});
