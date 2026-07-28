import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadHandbook, getHandbookChapter } from '../handbook';

const DIR = join(process.cwd(), 'content', 'handbook');

describe('loadHandbook (real content/handbook)', () => {
  it('loads chapters ordered by `order`, with parsed frontmatter', () => {
    const chapters = loadHandbook(DIR);
    expect(chapters.length).toBeGreaterThanOrEqual(4); // renders whatever is present, no fixed count
    expect(chapters.map((c) => c.order)).toEqual([...chapters.map((c) => c.order)].sort((a, b) => a - b));
    expect(chapters[0].slug).toBe('how-to-start');
    for (const c of chapters) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.summary.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.body.startsWith('---')).toBe(false); // frontmatter stripped
    }
  });

  it('exposes chapters by slug', () => {
    expect(getHandbookChapter('how-to-sell', DIR)?.slug).toBe('how-to-sell');
    expect(getHandbookChapter('nope', DIR)).toBeNull();
  });

  it('returns [] for a missing directory (never throws)', () => {
    expect(loadHandbook('/no/such/dir')).toEqual([]);
  });
});
