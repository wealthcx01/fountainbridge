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

/**
 * FB-205 — the sentences the box has actually written, and what a founder reads.
 *
 * Every string below is copied from `deploy/lane/run-once.sh` or `deploy/executor/executor.mjs` as
 * they stood before FB-205, not invented for the test. That matters: the fault was found by reading
 * ARCA's live desk, where one of these had been rendered 3,461 times.
 */
describe('the sentences the box already wrote (FB-205)', () => {
  it('does not put a noun phrase where an adjective belongs', () => {
    // "Daily your team budget reached" — the most repeated line in ARCA's history.
    expect(inFounderWords('Daily lane budget reached — parked until tomorrow.')).toBe(
      'Your team’s daily budget is used up — parked until tomorrow.',
    );
  });

  it('does not leave an article stranded in front of a noun phrase', () => {
    // "a your team cannot forge it", in the executor's account of a grant that failed attestation.
    expect(inFounderWords('grant attestation is missing or invalid (not signed by the studio — a lane cannot forge it)'))
      .toBe('grant attestation is missing or invalid (not signed by the studio — your team cannot forge it)');
  });

  it('gives a telegraphic subject its verb back', () => {
    // "Your team awake" is not a sentence.
    expect(inFounderWords('Lane awake — nothing to work right now.')).toBe(
      'Your team is awake — nothing to work right now.',
    );
    expect(inFounderWords('Lane awake with nothing it may work: 2 ticket(s) are waiting for your go — A, B. Nothing else is queued.'))
      .toBe('Your team is awake with nothing it may work: 2 ticket(s) are waiting for your go — A, B. Nothing else is queued.');
  });

  it('still handles the two shapes that were already right', () => {
    expect(inFounderWords("The lane tried this 3 times and couldn't get it past its own review/tests. It needs a human — parked."))
      .toBe("Your team tried this 3 times and couldn't get it past its own review/tests. It needs a human — parked.");
    expect(inFounderWords('This looks high-impact (auth/payments/sends/migrations). The lane planned it but paused for your go before doing anything.'))
      .toBe('This looks high-impact (auth/payments/sends/migrations). Your team planned it but paused for your go before doing anything.');
  });

  it('leaves the sentences the box writes NOW exactly alone', () => {
    // The other half of FB-205: the box no longer writes "lane" in anything a founder reads, so a
    // new report needs no rewriting at all. If these ever stopped being identity, the source and the
    // rewriter would have started fighting each other over one sentence.
    for (const said of [
      'Your team’s daily budget is used up — parked until tomorrow.',
      'Your team is awake — nothing to work right now.',
      'Your team is awake with nothing it may work: 2 ticket(s) are waiting for your go — A, B. Nothing else is queued.',
      "Your team tried this 3 times and couldn't get it past its own review/tests. It needs a human — parked.",
      'This looks high-impact (auth/payments/sends/migrations). Your team planned it but paused for your go before doing anything.',
    ]) {
      expect(inFounderWords(said), said).toBe(said);
    }
  });

  it('does not touch a lane that acted, which is what the name rules are for', () => {
    // The distinction no regular expression can make, kept working: here "lane" labels something
    // that did something, and the plain swap is right.
    expect(inFounderWords('lane arca-build stopped')).toBe('your team arca-build stopped');
  });
});
