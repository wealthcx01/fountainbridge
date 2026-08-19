import { describe, expect, it } from 'vitest';
import { handoffMarkdown, MAX_ITEM, MAX_ITEMS, readHandoff, summaryLine } from '../handoff-lib.mjs';

/**
 * FB-060. The case that motivated all of this is the first one: a ticket asks the lane to flag what
 * it could not establish, the lane does, and the answer has to reach the PR body.
 */

const SELL_001 = {
  summary: 'Drafted the ideal-customer note and left the founder-only facts open.',
  could_not_establish: [
    'Price tiers — nothing in the repos states them.',
    'Named competitors — no source in the venture records.',
    'Brand voice — no style guide deposited yet.',
  ],
  findings: ['The Sell queue had no prior positioning note to build on.'],
  caveats: ['Written from the product repo only; the marketing repo was empty.'],
};

describe('readHandoff', () => {
  it('reads the run that motivated this ticket', () => {
    const h = readHandoff(SELL_001);
    expect(h.could_not_establish).toHaveLength(3);
    expect(h.summary).toContain('ideal-customer note');
  });

  it('accepts a run with nothing to caveat — the normal case', () => {
    const h = readHandoff({ summary: 'Added the set name to the card pages.' });
    expect(h).not.toBeNull();
    expect(h.could_not_establish).toEqual([]);
    expect(h.findings).toEqual([]);
  });

  it('refuses only when there is no summary to use', () => {
    expect(readHandoff({ findings: ['a'] })).toBeNull();
    expect(readHandoff({ summary: '   ' })).toBeNull();
    expect(readHandoff(null)).toBeNull();
    expect(readHandoff('a string')).toBeNull();
  });

  it('drops entries that are not strings rather than rendering them', () => {
    const h = readHandoff({ summary: 'x', could_not_establish: ['real', null, 42, {}, '  '] });
    expect(h.could_not_establish).toEqual(['real']);
  });

  it('bounds a runaway list, so one verbose run cannot bury the PR body', () => {
    const many = Array.from({ length: 50 }, (_, i) => `item ${i}`);
    expect(readHandoff({ summary: 'x', findings: many }).findings).toHaveLength(MAX_ITEMS);
  });

  it('bounds a runaway item', () => {
    const long = 'a'.repeat(2000);
    expect(readHandoff({ summary: 'x', caveats: [long] }).caveats[0]).toHaveLength(MAX_ITEM);
  });
});

describe('handoffMarkdown', () => {
  it('puts what could not be established first', () => {
    // The whole point. A summary is most likely to swallow exactly this, and burying it under
    // "what it found" would repeat the original fault more politely.
    const body = handoffMarkdown(readHandoff(SELL_001));
    expect(body.indexOf('could not establish')).toBeLessThan(body.indexOf('What it found'));
  });

  it('carries every item a ticket asked the lane to flag', () => {
    const body = handoffMarkdown(readHandoff(SELL_001));
    for (const item of SELL_001.could_not_establish) expect(body).toContain(item);
  });

  it('writes no empty headings for a run with nothing to say', () => {
    const body = handoffMarkdown(readHandoff({ summary: 'Added the set name to the card pages.' }));
    expect(body).toBe('Added the set name to the card pages.');
    expect(body).not.toContain('##');
  });

  it('leaves no run of blank lines to render as a gap', () => {
    expect(handoffMarkdown(readHandoff(SELL_001))).not.toMatch(/\n{3,}/);
  });
});

describe('summaryLine', () => {
  it('is one line, for the RunReport where a sentence is right', () => {
    const line = summaryLine(readHandoff(SELL_001));
    expect(line).toBe(SELL_001.summary);
    expect(line).not.toContain('\n');
  });
});
