import { describe, expect, it } from 'vitest';
import {
  composeActivitySummary,
  readableTitle,
  sentenceList,
  type SummaryEvent,
} from '../activity-summary';

/**
 * Real ARCA shapes, taken from what actually landed on 2026-08-19 — the lane's own titles and the
 * paths each change touched. A fixture invented from the type would agree with the classifier by
 * construction and prove nothing; these are the strings the page really holds.
 */
const shipped = (at: string, title: string, paths: string[]): SummaryEvent => ({ at, title, paths });

const ARCA_WINDOW: SummaryEvent[] = [
  shipped('2026-08-19T13:05:00Z', 'build: ARCA-050-show-set-name-card-pages (Foundry lane)', [
    'client/src/pages/CardsPage.tsx',
    'client/src/pages/CardDetailPage.tsx',
    'docs/tickets/ARCA-050-show-set-name-card-pages.md',
  ]),
  shipped('2026-08-19T13:04:00Z', 'build: ARCA-044-seed-script-silent-failure (Foundry lane)', [
    'db/seed.ts',
    'docs/tickets/ARCA-044-seed-script-silent-failure.md',
  ]),
  // Tickets only — a request entering the queue, not work leaving it (FB-096's whole point).
  shipped('2026-08-19T13:03:00Z', 'build: ARCA-043-uiux-audit-of-the-terminal (Foundry lane)', [
    'docs/tickets/ARCA-043-uiux-audit-of-the-terminal.md',
    'docs/tickets/ARCA-051-cards-page-crashes-every-load.md',
  ]),
  shipped('2026-08-19T13:02:00Z', 'Add to venture knowledge: ARCA Brand Positioning', [
    'context/sell/arca-brand-positioning.md',
  ]),
];

describe('sentenceList', () => {
  it('joins the way a person would', () => {
    expect(sentenceList([])).toBe('');
    expect(sentenceList(['pricing'])).toBe('pricing');
    expect(sentenceList(['pricing', 'brand'])).toBe('pricing and brand');
    expect(sentenceList(['pricing', 'brand', 'mobile'])).toBe('pricing, brand and mobile');
  });
});

describe('readableTitle', () => {
  it('reads a lane title back as the request a founder would recognise', () => {
    expect(readableTitle('build: ARCA-050-show-set-name-card-pages (Foundry lane)')).toBe(
      'Show set name card pages',
    );
  });

  it('drops a leading id that is already shown beside the row', () => {
    expect(readableTitle('ARCA-51 — Cards page crashes on every load')).toBe(
      'Cards page crashes on every load',
    );
  });

  it('leaves a sentence a human wrote alone', () => {
    expect(readableTitle('Add to venture knowledge: ARCA Brand Positioning')).toBe(
      'Add to venture knowledge: ARCA Brand Positioning',
    );
  });
});

describe('composeActivitySummary', () => {
  it('counts each kind the way the rows below it do', () => {
    const { counts } = composeActivitySummary({ events: ARCA_WINDOW, windowDays: 14 });
    expect(counts).toEqual({ total: 4, shipped: 2, asked: 1, learned: 1 });
  });

  it('opens with how much, what recently, and where it is heading', () => {
    const { sentences } = composeActivitySummary({
      events: ARCA_WINDOW,
      windowDays: 14,
      openAreas: ['pricing', 'the interface'],
    });

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe(
      'In the last 14 days your team finished 2 pieces of work, alongside 1 new request from you and 1 addition to what your venture knows.',
    );
    expect(sentences[1]).toBe(
      'Most recently: Show set name card pages and Seed script silent failure.',
    );
    expect(sentences[2]).toBe('Most of the work still open is aimed at pricing and the interface.');
  });

  it('says nothing at all when nothing happened', () => {
    // The page has its own empty state. A summary that pads a quiet fortnight into three hedged
    // sentences is worse than no summary.
    expect(composeActivitySummary({ events: [], windowDays: 14 }).sentences).toEqual([]);
  });

  it('never writes the direction sentence it does not have the facts for', () => {
    const noAreas = composeActivitySummary({ events: ARCA_WINDOW, windowDays: 14 });
    expect(noAreas.sentences).toHaveLength(2);
    const emptyAreas = composeActivitySummary({
      events: ARCA_WINDOW,
      windowDays: 14,
      openAreas: ['', '   '],
    });
    expect(emptyAreas.sentences).toHaveLength(2);
  });

  it('says plainly when nothing was finished, rather than dressing up the other counts', () => {
    const requestsOnly = ARCA_WINDOW.filter((e) => e.paths?.every((p) => p.startsWith('docs/tickets/')));
    const { sentences } = composeActivitySummary({ events: requestsOnly, windowDays: 7 });
    expect(sentences[0]).toBe('In the last 7 days nothing was finished yet — 1 new request from you.');
    // No "most recently" line either: nothing shipped to name.
    expect(sentences).toHaveLength(1);
  });

  it('reads singular counts as English, not as "1 pieces"', () => {
    const one = [ARCA_WINDOW[0]];
    const { sentences } = composeActivitySummary({ events: one, windowDays: 1 });
    expect(sentences[0]).toBe('In the last 1 days your team finished 1 piece of work.');
  });

  it('ignores the studio housekeeping a founder never asked about', () => {
    const withPlumbing: SummaryEvent[] = [
      ...ARCA_WINDOW,
      shipped('2026-08-19T13:06:00Z', 'seed: arca-ops — the queue, the context', ['scripts/seed.mjs']),
      shipped('2026-08-19T13:07:00Z', 'cleanup: FB-043 test artifact', ['docs/tickets/x.md']),
    ];
    const { counts, sentences } = composeActivitySummary({ events: withPlumbing, windowDays: 14 });
    // Housekeeping raises `total` (it is in the list the caller passed) but is named in no sentence.
    expect(counts.shipped).toBe(2);
    expect(counts.asked).toBe(1);
    expect(sentences[0]).toContain('finished 2 pieces of work');
  });
});

describe('the summary beside its own list (FB-180)', () => {
  const ev = (title: string, at: string) => ({ title, at, paths: ['src/app.ts'] });

  it('drops "Most recently" when the caller prints the list underneath it', () => {
    const events = [ev('one', '2026-09-01T10:00:00.000Z'), ev('two', '2026-08-31T10:00:00.000Z')];
    const withList = composeActivitySummary({ events, windowDays: 14, withoutList: true });
    expect(withList.sentences.join(' ')).not.toContain('Most recently');
    expect(withList.sentences.length).toBeGreaterThan(0);
  });

  it('keeps it for a caller that summarises without the list, which is what it is for', () => {
    const events = [ev('one', '2026-09-01T10:00:00.000Z'), ev('two', '2026-08-31T10:00:00.000Z')];
    const alone = composeActivitySummary({ events, windowDays: 14 });
    expect(alone.sentences.join(' ')).toContain('Most recently');
  });
});
