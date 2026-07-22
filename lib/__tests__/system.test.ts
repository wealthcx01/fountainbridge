import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadSystem, getSystemSection } from '../system';

const DIR = join(process.cwd(), 'content', 'system');

describe('loadSystem (real content/system)', () => {
  it('loads sections ordered by `order`, with parsed frontmatter', () => {
    const sections = loadSystem(DIR);
    expect(sections.length).toBeGreaterThanOrEqual(6);
    // ordered
    expect(sections.map((s) => s.order)).toEqual([...sections.map((s) => s.order)].sort((a, b) => a - b));
    // overview is first
    expect(sections[0].slug).toBe('overview');
    for (const s of sections) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.summary.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      // frontmatter must be stripped from the body
      expect(s.body.startsWith('---')).toBe(false);
    }
  });

  it('exposes the system-component sections by slug', () => {
    for (const slug of ['lanes', 'tickets', 'gstack', 'gbrain', 'activegraph', 'approval-matrix']) {
      expect(getSystemSection(slug, DIR)?.slug).toBe(slug);
    }
    expect(getSystemSection('nope', DIR)).toBeNull();
  });

  it('returns [] for a missing directory (never throws)', () => {
    expect(loadSystem('/no/such/dir')).toEqual([]);
  });
});
