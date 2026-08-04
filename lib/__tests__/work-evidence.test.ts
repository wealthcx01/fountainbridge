import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainWords, readEvidence } from '../work-evidence';

/**
 * Pinned to a REAL lane body — `wealthcx01/arca#23`, 4,273 characters, captured 2026-08-01. If the
 * lane changes what it writes, these fail, which is the point: this parses prose by convention and
 * the convention is the contract.
 */
const REAL = readFileSync(join(__dirname, 'fixtures/lane-pr-body.txt'), 'utf8');

describe('turning a real lane body into a decision', () => {
  const e = readEvidence(REAL);

  it('recognises the shape', () => {
    expect(e.summarised).toBe(true);
  });

  it('says whether it was checked, in one sentence', () => {
    expect(e.verdict).toBe('It passed all 4 checks the team set itself, and a reviewer signed it off.');
  });

  it('surfaces the retries, which were buried mid-paragraph', () => {
    // The single most useful signal on the page, and it was inside a sentence that also quoted the
    // failing criterion verbatim.
    expect(e.exceptions[0]).toContain('It took 2 attempts');
    expect(e.exceptions[0]).toContain('last allowed attempt');
  });

  it('says nobody tried it in a browser', () => {
    expect(e.exceptions.join(' ')).toContain('Nobody tried this in a browser');
  });

  it('says it was checked by hand rather than automatically', () => {
    expect(e.exceptions.join(' ')).toContain('checked by hand');
  });

  it('drops the boilerplate every lane body opens with', () => {
    // Identical on every piece of work, so it carries nothing — and substituting jargon into it
    // produced "the full its usual research, plan, build, check routine".
    expect(e.did).not.toContain('Worked by the Foundry lane');
    expect(e.did).not.toContain('its usual research, plan, build');
    expect(e.did!.startsWith('The `db/seed.ts` fix')).toBe(true);
  });

  it('is dramatically shorter than what it replaced', () => {
    const summary = [e.did, e.verdict, ...e.exceptions].join(' ');
    expect(REAL.length).toBeGreaterThan(4000);
    expect(summary.length).toBeLessThan(900);
  });
});

describe('what it refuses to do', () => {
  it('never claims to have understood a body it did not', () => {
    // A summary that quietly drops the paragraph explaining why something is risky is worse than the
    // wall of text it replaced. `summarised: false` tells the caller to show everything.
    const e = readEvidence('Some free-form note a human wrote about this change.');
    expect(e.summarised).toBe(false);
    expect(e.exceptions).toEqual([]);
  });

  it('says nothing at all about an empty body', () => {
    for (const body of [null, '', '   ']) {
      expect(readEvidence(body)).toEqual({ did: null, verdict: null, exceptions: [], summarised: false, record: '' });
    }
  });

  it('takes the tool’s signature off before a founder reads it (FB-107)', () => {
    // A founder reviewing their own product's work met "🤖 Generated with [Claude Code](…)" and a
    // Co-Authored-By trailer, rendered as raw markdown, inside "what the team says about it".
    const body = 'Renamed the sign-in copy.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>';
    const e = readEvidence(body);
    expect(e.did).toBe('Renamed the sign-in copy.');
    expect(e.record).toBe('Renamed the sign-in copy.');
    expect(e.record).not.toContain('Claude');
    expect(e.record).not.toContain('🤖');
  });

  it('leaves a body that has no signature exactly as it was', () => {
    const body = 'Did the thing.\n\nAnd then the other thing.';
    expect(readEvidence(body).record).toBe(body);
  });

  it('does not invent a retry when there was only one attempt', () => {
    // An inferred exception is worse than none: a founder who learns the warnings are guesses stops
    // reading the warnings.
    const e = readEvidence('- ✅ tests: they pass\n**Validation:** passed on round 1 of 2\n/review ✅ (review pass (0 critical))');
    expect(e.exceptions).toEqual([]);
    expect(e.verdict).toContain('passed all 1 check');
  });

  it('reports a failed gate as the exception it is', () => {
    const e = readEvidence('- ✅ tests: fine\n- ❌ coverage: not met\n**Validation:** passed on round 1 of 2');
    expect(e.exceptions[0]).toContain('did not pass');
    expect(e.exceptions[0]).toContain('coverage');
    expect(e.verdict).toContain('passed 1 of 2');
  });

  it('reports serious review findings', () => {
    const e = readEvidence('- ✅ a: x\n/review ❌ (review pass (3 critical))');
    expect(e.exceptions.join(' ')).toContain('raised 3 serious points');
  });
});

describe('speaking plainly', () => {
  it('translates the lane’s private vocabulary', () => {
    expect(plainWords('the PRP gates and /review and /qa and CI')).not.toMatch(/\bPRP\b|\/review|\/qa|\bCI\b/);
  });
});


describe('the nested-bracket trap', () => {
  it('finds the critical count inside nested brackets', () => {
    // `/review ✅ (review pass (0 critical))`. The obvious `\(([^)]*)\)` stops at the inner bracket
    // and captures "review pass (0 critical", so the count was never found — and the real body's
    // "0 critical" gave the right answer by luck. A parser that is accidentally right is one that
    // will be quietly wrong the first time it matters.
    expect(readEvidence('- ✅ a: x\n/review ❌ (review pass (3 critical))').exceptions.join(' '))
      .toContain('raised 3 serious points');
    expect(readEvidence('- ✅ a: x\n/review ✅ (review pass (0 critical))').exceptions).toEqual([]);
  });
});
