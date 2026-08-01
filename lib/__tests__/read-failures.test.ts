import { describe, it, expect } from 'vitest';
import { causeOf, groupFailures, needsAction, repoOf } from '../read-failures';

// The exact five the attention queue showed a founder on 2026-08-01, in one sentence, above the work.
const REAL = [
  'arca-marketing: GitHub rate limit hit — try refresh shortly.',
  'arca-ops: GitHub rate limit hit — try refresh shortly.',
  'modernisation-engine: GitHub rate limit hit — try refresh shortly.',
  'Repository wealthcx01/thereset-platform not found.',
  'Repository wealthcx01/thereset-marketing not found.',
];

describe('telling the causes apart', () => {
  it('knows which of the five failures is which', () => {
    expect(REAL.map(causeOf)).toEqual(['busy', 'busy', 'busy', 'missing', 'missing']);
  });

  it('recognises a permissions failure as its own thing', () => {
    // FB-082: this used to arrive worded as a rate limit, which is how a founder got told to refresh
    // forever. It is a separate cause and must stay one.
    expect(causeOf('The studio does not have permission to read wealthcx01/arca-marketing.')).toBe('not-allowed');
  });

  it('does not silently swallow a failure it has never seen', () => {
    // The failure this whole model is built on was one nobody expected either.
    expect(causeOf('the moon exploded')).toBe('unknown');
  });

  it('names the workstream without its owner', () => {
    expect(repoOf('Repository wealthcx01/thereset-platform not found.')).toBe('thereset-platform');
    expect(repoOf('arca-ops: GitHub rate limit hit — try refresh shortly.')).toBe('arca-ops');
  });
});

describe('turning five failures into sentences a person can act on', () => {
  it('groups the real five into two, not five', () => {
    const groups = groupFailures(REAL);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.cause)).toEqual(['missing', 'busy']);
  });

  it('puts what needs a human before what fixes itself', () => {
    // A founder skimming should meet the thing that needs them before the thing that needs nobody.
    const groups = groupFailures(REAL);
    expect(groups[0].transient).toBe(false);
    expect(groups[groups.length - 1].transient).toBe(true);
  });

  it('says plainly when something will never clear on its own', () => {
    // "Try refresh shortly" for a repository that does not exist is advice that cannot work.
    const [missing] = groupFailures(REAL);
    expect(missing.nextStep).toContain('will not clear on its own');
    expect(missing.text).toContain('thereset-platform');
    expect(missing.text).toContain('thereset-marketing');
  });

  it('says the busy one clears by itself, because it does', () => {
    const busy = groupFailures(REAL).find((g) => g.cause === 'busy')!;
    expect(busy.nextStep).toContain('clears on its own');
    expect(busy.text).toContain('asking GitHub too often');
  });

  it('reads as a sentence for one workstream and for three', () => {
    expect(groupFailures(['a: GitHub rate limit hit'])[0].text).toContain('a could not be read');
    const three = groupFailures(REAL.slice(0, 3))[0].text;
    expect(three).toContain('arca-marketing, arca-ops and modernisation-engine');
  });

  it('never mentions a repository owner', () => {
    for (const g of groupFailures(REAL)) {
      expect(g.text).not.toContain('wealthcx01/');
      expect(g.nextStep).not.toContain('wealthcx01/');
    }
  });

  it('has nothing to say when nothing failed', () => {
    expect(groupFailures([])).toEqual([]);
    expect(needsAction([])).toBe(false);
  });

  it('knows when the founder is actually needed', () => {
    expect(needsAction(groupFailures(REAL))).toBe(true);
    expect(needsAction(groupFailures(['x: GitHub rate limit hit']))).toBe(false);
  });
});
