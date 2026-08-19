import { describe, expect, it } from 'vitest';
import {
  availableAtFounding,
  FOUNDING_QUESTIONS,
  isStrategicAsk,
  loadPowers,
  notYetAvailable,
  parsePowers,
  wantsStrategicLens,
} from '../founding-lens';

/**
 * FB-069. Two things are worth pinning here and they pull in opposite directions:
 *
 * 1. The lens reads the SHIPPED playbook, so the composer quotes the studio's own method rather
 *    than a copy of it that has drifted.
 * 2. It stays out of the way. A founder who wanted to move a button must not be interrogated —
 *    that failure is worse than being shallow, because it teaches them talking to the studio is
 *    expensive.
 */

describe('reading the powers out of the real playbook', () => {
  const powers = loadPowers();

  it('finds all seven', () => {
    // If the chapter is renamed or restructured this drops to zero, and the founding conversation
    // would quietly lose its strategic half. Better to fail here.
    expect(powers).toHaveLength(7);
  });

  it('knows which two a venture with no customers can actually build', () => {
    const names = availableAtFounding(powers).map((p) => p.name).sort();
    expect(names).toEqual(['Cornered Resource', 'Counter-Positioning']);
  });

  it('knows which ones a founder cannot honestly claim yet', () => {
    const names = notYetAvailable(powers).map((p) => p.name).sort();
    expect(names).toEqual([
      'Branding',
      'Network Economies',
      'Process Power',
      'Scale Economies',
      'Switching Costs',
    ]);
  });

  it('carries the chapter’s own sentence, so it can be quoted rather than paraphrased', () => {
    const cp = powers.find((p) => p.name === 'Counter-Positioning');
    expect(cp?.whenBuildable).toContain("newcomer's founding move");
  });
});

describe('parsePowers', () => {
  it('ignores a section it cannot read rather than guessing a phase', () => {
    const md = [
      '## 1. Made Up Power',
      '**Benefit.** Something.',
      '**When buildable.** *Whenever* — not a real phase.',
      '',
      '## 2. Counter-Positioning',
      '**When buildable.** *Origination* — the newcomer’s move.',
    ].join('\n');
    const parsed = parsePowers(md);
    expect(parsed.map((p) => p.name)).toEqual(['Counter-Positioning']);
  });

  it('returns nothing for a chapter with no powers in it, rather than throwing', () => {
    expect(parsePowers('# Some other chapter\n\nProse.')).toEqual([]);
  });
});

describe('the questions', () => {
  it('asks what would stop someone copying this, and refuses a feature list', () => {
    const moat = FOUNDING_QUESTIONS.find((q) => q.ask.includes('copying'));
    expect(moat).toBeDefined();
    expect(moat?.refuse).toContain('not a barrier');
  });

  it('refuses a category as an answer to who it is for', () => {
    const who = FOUNDING_QUESTIONS.find((q) => q.ask.startsWith('Who exactly'));
    expect(who?.refuse).toContain('not a segment');
  });

  it('ends on what would falsify it', () => {
    expect(FOUNDING_QUESTIONS[FOUNDING_QUESTIONS.length - 1].ask).toContain('false');
  });
});

describe('wantsStrategicLens — the boundary that decides whether this is a good product', () => {
  it('applies on day one, because that IS the founding conversation', () => {
    expect(wantsStrategicLens({ hasHistory: false })).toBe(true);
  });

  it('applies whenever the founder asks for it', () => {
    expect(wantsStrategicLens({ hasHistory: true, explicitlyAsked: true })).toBe(true);
  });

  it('stays out of the way of ordinary work', () => {
    // The failure this file exists to prevent. Every one of these is someone trying to get
    // something done, and a strategy interview here would be the product being exhausting.
    for (const message of [
      'Show the set name on the card pages',
      'The seed script fails silently, make it fail loudly',
      'Move the sign-in button to the top right',
      'Rewrite the whole billing page — it is a mess',
      'Add a placeholder image for cards with no artwork',
    ]) {
      expect(wantsStrategicLens({ hasHistory: true, message }), message).toBe(false);
    }
  });

  it('engages when the ask is genuinely about direction', () => {
    for (const message of [
      'Should we build the portfolio tracker or the price alerts first?',
      'Is this worth building at all?',
      'What would stop a competitor copying us?',
      'I think we need to pivot',
      'Who is this actually for?',
    ]) {
      expect(wantsStrategicLens({ hasHistory: true, message }), message).toBe(true);
    }
  });

  it('reads the question, not the size of the work', () => {
    // Large and not strategic; small and strategic. Size is the wrong signal and this pins it.
    expect(isStrategicAsk('Rewrite the entire analytics module from scratch')).toBe(false);
    expect(isStrategicAsk('Should we charge monthly or per seat?')).toBe(true);
  });

  it('says no to an empty message rather than treating silence as strategic', () => {
    expect(wantsStrategicLens({ hasHistory: true, message: '   ' })).toBe(false);
    expect(wantsStrategicLens({ hasHistory: true })).toBe(false);
  });
});
