import { describe, it, expect } from 'vitest';
import {
  DEPARTMENTS,
  formatDigest,
  pageDepartment,
  partitionForDepartment,
  researchQuestion,
} from '../brain-lib.mjs';

describe('pageDepartment — which surface owns a brain page', () => {
  it('reads the department off a deposited context/library page', () => {
    expect(pageDepartment('context-build-ideal-customer')).toBe('build');
    expect(pageDepartment('library-sell-outreach-sequence')).toBe('sell');
    expect(pageDepartment('context-scale-hiring-plan')).toBe('scale');
  });

  it('treats general as shared, not as a department', () => {
    expect(pageDepartment('context-general-brand-voice')).toBeNull();
  });

  it('leaves tickets, code and root docs unattributed (every lane may read them)', () => {
    expect(pageDepartment('docs-tickets-arca-price-history')).toBeNull();
    expect(pageDepartment('src-app-page-tsx')).toBeNull();
    expect(pageDepartment('readme-md')).toBeNull();
  });

  it('needs the department to be a whole slug segment', () => {
    // `context/buildings/…` is not the Build surface.
    expect(pageDepartment('context-buildings-note')).toBeNull();
  });

  it('is case-insensitive and safe on junk input', () => {
    expect(pageDepartment('CONTEXT-BUILD-X')).toBe('build');
    expect(pageDepartment(undefined)).toBeNull();
    expect(pageDepartment(42)).toBeNull();
  });

  it('exports the departments the deposit tool writes', () => {
    expect(DEPARTMENTS).toEqual(['build', 'sell', 'scale', 'general']);
  });
});

describe('partitionForDepartment — a lane sees its own surface plus what is shared', () => {
  const hits = [
    { slug: 'context-build-ideal-customer' },
    { slug: 'context-sell-outreach-tone' },
    { slug: 'library-scale-runbook' },
    { slug: 'docs-tickets-arca-price-history' },
    { slug: 'context-general-brand-voice' },
  ];

  it("drops another department's private context", () => {
    const kept = partitionForDepartment(hits, 'build').map((r) => r.slug);
    expect(kept).toEqual([
      'context-build-ideal-customer',
      'docs-tickets-arca-price-history',
      'context-general-brand-voice',
    ]);
  });

  it('partitions each department independently', () => {
    expect(partitionForDepartment(hits, 'sell').map((r) => r.slug)).toContain('context-sell-outreach-tone');
    expect(partitionForDepartment(hits, 'sell').map((r) => r.slug)).not.toContain('library-scale-runbook');
  });

  it('does not partition for the founder (no department, unknown, or general)', () => {
    expect(partitionForDepartment(hits, null)).toHaveLength(5);
    expect(partitionForDepartment(hits, 'marketing')).toHaveLength(5);
    expect(partitionForDepartment(hits, 'general')).toHaveLength(5);
  });

  it('never mutates the caller’s array and tolerates junk', () => {
    const original = [...hits];
    partitionForDepartment(hits, 'build');
    expect(hits).toEqual(original);
    expect(partitionForDepartment(null, 'build')).toEqual([]);
  });
});

describe('formatDigest — hits become a prompt a model can use', () => {
  it('keeps one entry per page, using the highest-scoring chunk', () => {
    const digest = formatDigest([
      { slug: 'context-build-a', title: 'Ideal customer', score: 0.4, chunk_text: 'weaker chunk' },
      { slug: 'context-build-a', title: 'Ideal customer', score: 0.9, chunk_text: 'stronger chunk' },
    ]);
    expect(digest).toContain('stronger chunk');
    expect(digest).not.toContain('weaker chunk');
    expect(digest.split('\n- ')).toHaveLength(1);
  });

  it('orders by score and labels with the title and slug', () => {
    const digest = formatDigest([
      { slug: 'b', title: 'Second', score: 0.2, chunk_text: 'two' },
      { slug: 'a', title: 'First', score: 0.8, chunk_text: 'one' },
    ]);
    expect(digest.indexOf('First')).toBeLessThan(digest.indexOf('Second'));
    expect(digest).toContain('First (a)');
  });

  it('flattens markdown and drops fenced code, which is noise in a plan prompt', () => {
    const digest = formatDigest([
      { slug: 'a', score: 1, chunk_text: '## Heading\n\nreal prose\n\n```js\nconst secret = 1;\n```' },
    ]);
    expect(digest).toContain('real prose');
    expect(digest).not.toContain('const secret');
    expect(digest).not.toContain('##');
  });

  it('caps each page and the digest as a whole', () => {
    const long = 'x'.repeat(5000);
    const digest = formatDigest([{ slug: 'a', score: 1, chunk_text: long }], { perPageChars: 100 });
    expect(digest.length).toBeLessThan(200);
    expect(digest).toContain('…');

    const many = (chunkChars) =>
      Array.from({ length: 40 }, (_, i) => ({ slug: `p${i}`, score: 1 - i / 100, chunk_text: 'y'.repeat(chunkChars) }));
    // The char budget binds first when the pages are fat…
    expect(formatDigest(many(500), { maxChars: 1000 }).length).toBeLessThanOrEqual(1000);
    // …and maxPages binds when they aren't, so a broad match can't bury the plan prompt.
    expect(formatDigest(many(50)).split('\n- ')).toHaveLength(8);   // maxPages default
  });

  it('is empty when there is nothing worth showing', () => {
    expect(formatDigest([])).toBe('');
    expect(formatDigest(null)).toBe('');
    expect(formatDigest([{ slug: 'a', score: 1, chunk_text: '   ' }])).toBe('');
    expect(formatDigest([{ score: 1, chunk_text: 'no slug' }])).toBe('');
  });
});

describe('researchQuestion — a ticket becomes a search question', () => {
  const ticket = `# ARCA-12 — price history on the card page

**Status:** Todo · **Area:** build

## Why this matters (for the founder)
Collectors decide using past prices.

## Context
The card page shows only today's price.

## Scope
- [ ] Add a 12-month price chart
- Reuse the existing pricing service

## Out of scope
- Alerts and notifications

## Acceptance criteria
- [ ] The chart renders on the card page
`;

  it('leads with the title and folds in the intent sections', () => {
    const q = researchQuestion(ticket);
    expect(q).toContain('ARCA-12 — price history on the card page');
    expect(q).toContain('Collectors decide using past prices.');
    expect(q).toContain('Add a 12-month price chart');
  });

  it('leaves out what the work is NOT and how it is checked', () => {
    const q = researchQuestion(ticket);
    expect(q).not.toContain('Alerts and notifications');
    expect(q).not.toContain('renders on the card page');
  });

  it('strips checkboxes, bullets and markdown emphasis', () => {
    const q = researchQuestion(ticket);
    expect(q).not.toContain('- [ ]');
    expect(q).not.toContain('*');
  });

  it('caps on a word boundary', () => {
    const q = researchQuestion(ticket, { maxChars: 40 });
    expect(q.length).toBeLessThanOrEqual(40);
    expect(q).not.toMatch(/\s$/);
  });

  it('survives a ticket with no sections, and empty input', () => {
    expect(researchQuestion('# Just a title')).toBe('Just a title');
    expect(researchQuestion('')).toBe('');
    expect(researchQuestion(null)).toBe('');
  });
});
