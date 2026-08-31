import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadHandbook, getHandbookChapter, minutesToRead } from '../handbook';

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

describe('how long a chapter takes to read (FB-134)', () => {
  it('counts words, at 200 a minute', () => {
    expect(minutesToRead(Array(400).fill('word').join(' '))).toBe(2);
    expect(minutesToRead(Array(1000).fill('word').join(' '))).toBe(5);
  });

  it('never says zero minutes', () => {
    // A chapter that exists takes some reading, and "0 min read" reads as broken, not as short.
    expect(minutesToRead('short')).toBe(1);
    expect(minutesToRead('')).toBe(1);
  });

  it('does not count markdown punctuation as words', () => {
    // A chapter of bullet lists would otherwise read as longer than a chapter of paragraphs saying
    // the same thing.
    const bullets = Array(400).fill('- word').join('\n');
    const prose = Array(400).fill('word').join(' ');
    expect(minutesToRead(bullets)).toBe(minutesToRead(prose));
  });

  it('agrees with itself on the real chapters', () => {
    // Every shipped chapter gets a figure a person would believe: at least a minute, and none of
    // them is an hour.
    for (const c of loadHandbook()) {
      const m = minutesToRead(c.body);
      expect(m, c.slug).toBeGreaterThanOrEqual(1);
      expect(m, c.slug).toBeLessThan(60);
    }
  });
});
