import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadContentSections } from '../content';

describe('loadContentSections (real content/foundry)', () => {
  it('loads the Foundry story sections, ordered, frontmatter parsed', () => {
    const sections = loadContentSections(join(process.cwd(), 'content', 'foundry'));
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections.map((s) => s.order)).toEqual([...sections.map((s) => s.order)].sort((a, b) => a - b));
    expect(sections[0].slug).toBe('hero');
    for (const s of sections) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      expect(s.body.startsWith('---')).toBe(false); // frontmatter stripped
    }
  });

  it('returns [] for a missing directory (never throws)', () => {
    expect(loadContentSections('/no/such/dir')).toEqual([]);
  });
});
