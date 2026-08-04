import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { VOCABULARY, TEAM_TITLE, TEAM_INTRO, inFounderWords } from '../glossary';

/**
 * The vocabulary contract has two halves that must agree: the words the UI is allowed to use
 * (lib/glossary.ts, enforced on the screens by scripts/copy-lint.mjs) and the chapter that teaches
 * them (content/handbook/09-using-your-studio.md, FB-101).
 *
 * They were written a day apart by the same hand and already differed — which is exactly how a
 * founder ends up reading a word in the product that the Handbook never mentions. So the agreement
 * is a test rather than an intention.
 */
const chapter = readFileSync(
  join(process.cwd(), 'content', 'handbook', '09-using-your-studio.md'),
  'utf8',
);

/** Typographic and straight apostrophes are the same word to a reader. */
const normalise = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');

describe('the glossary and the Handbook teach the same words', () => {
  it.each(VOCABULARY.map((v) => v.term))('the Handbook chapter teaches "%s"', (term) => {
    expect(normalise(chapter)).toContain(normalise(term));
  });

  it('gives every term a plain meaning, not a definition in its own words', () => {
    for (const { term, means } of VOCABULARY) {
      expect(means.length).toBeGreaterThan(20);
      expect(means).toMatch(/[.!]$/);
      // A meaning that repeats the term is a circular definition ("a surface is a surface where…").
      expect(normalise(means).startsWith(normalise(term))).toBe(false);
    }
  });

  it('names the working machinery once, and the same way the Handbook does', () => {
    expect(TEAM_TITLE).toBe('Your team');
    expect(VOCABULARY.map((v) => v.term)).toContain('your team');
    expect(normalise(chapter)).toContain(normalise('your team'));
    // The introduction is the Handbook's own sentence about who the team is.
    expect(normalise(chapter)).toContain(normalise('running on your venture’s own machine'));
    expect(normalise(TEAM_INTRO)).toContain(normalise('venture’s own machine'));
  });
});

describe('quoting the machine without quoting its vocabulary', () => {
  // The board introduces "your team" at the top and then quotes a stopped run's own account of
  // itself four lines below. Before FB-103 that account said "The lane tried this 3 times" — the
  // one thing the linter can never catch, because the words arrive at runtime.
  it('says "your team" for the machinery, whatever the machine called itself', () => {
    expect(inFounderWords('The lane tried this 3 times and gave up.')).toBe(
      'Your team tried this 3 times and gave up.',
    );
    expect(inFounderWords('the agent lane could not push')).toBe('your team could not push');
    expect(inFounderWords('Blocked: the engine ran out of context.')).toBe(
      'Blocked: your team ran out of context.',
    );
    expect(inFounderWords('lane arca-build stopped')).toBe('your team arca-build stopped');
  });

  it('keeps the sentence otherwise intact — it is the machine’s account, not ours', () => {
    const said = 'Ran the tests 3 times; typecheck failed on lib/work.ts:81. Parked for a human.';
    expect(inFounderWords(said)).toBe(said);
  });

  it('leaves a sentence with no machinery in it exactly as written', () => {
    expect(inFounderWords('Nothing to do.')).toBe('Nothing to do.');
  });
});
