import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadPlaybook, getPlaybookSection } from '../playbook';

const DIR = join(process.cwd(), 'content', 'playbook');

describe('loadPlaybook (real content/playbook)', () => {
  it('loads sections ordered by `order`, with parsed frontmatter', () => {
    const sections = loadPlaybook(DIR);
    expect(sections.length).toBeGreaterThanOrEqual(12);
    // ordered
    expect(sections.map((s) => s.order)).toEqual([...sections.map((s) => s.order)].sort((a, b) => a - b));
    // introduction is first
    expect(sections[0].slug).toBe('introduction');
    for (const s of sections) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.summary.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      // frontmatter must be stripped from the body
      expect(s.body.startsWith('---')).toBe(false);
    }
  });

  it('exposes the core sections by slug', () => {
    for (const slug of ['build-arc', 'moats', 'selling', 'operating-model']) {
      expect(getPlaybookSection(slug, DIR)?.slug).toBe(slug);
    }
    expect(getPlaybookSection('nope', DIR)).toBeNull();
  });

  it('exposes the FB-018 deep sections — the six DE questions and the seven powers', () => {
    for (const slug of ['de-customer', 'de-value', 'de-acquire', 'de-money', 'de-build', 'de-scale', 'seven-powers']) {
      expect(getPlaybookSection(slug, DIR)?.slug).toBe(slug);
    }
  });

  it('returns [] for a missing directory (never throws)', () => {
    expect(loadPlaybook('/no/such/dir')).toEqual([]);
  });
});
