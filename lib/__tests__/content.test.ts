import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentSections } from '../content';

/**
 * FB-022 guard: a scaffolding placeholder marker like
 *   > **DRAFT copy — placeholder to show the layout. Replace in the UI/UX review.**
 * must never ship in rendered content. Deliberately narrow — it requires the word "draft" AND a
 * placeholder verb ("placeholder"/"replace") on the SAME line, and both are word-boundaried, so
 * ordinary prose ("agents draft content", "drafting the emails", "the irreplaceable work",
 * "no test fully replaces") never trips it. Case-insensitive so a lowercase reintroduction is caught.
 */
const DRAFT_MARKER = /\bdraft\b[^\n]*\b(placeholder|replace)\b/i;

function markdownFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownFilesUnder(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

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

describe('DRAFT-marker guard (FB-022)', () => {
  it('no content/**/*.md ships a DRAFT placeholder marker', () => {
    const offenders: string[] = [];
    for (const file of markdownFilesUnder(join(process.cwd(), 'content'))) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (DRAFT_MARKER.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        });
    }
    expect(offenders, `DRAFT placeholder markers must not ship in rendered content:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('catches a marker line but never ordinary "draft" prose', () => {
    // marker forms → rejected
    expect(DRAFT_MARKER.test('> **DRAFT copy — placeholder to show the layout. Replace in the UI/UX review.**')).toBe(true);
    expect(DRAFT_MARKER.test('> **DRAFT — replace before launch**')).toBe(true);
    // legit prose from the real content → must NOT trip
    expect(DRAFT_MARKER.test('the agents can draft, build, and propose all day')).toBe(false);
    expect(DRAFT_MARKER.test('reading the repository, writing code, drafting content')).toBe(false);
    expect(DRAFT_MARKER.test('You do the irreplaceable work: deciding what to build')).toBe(false);
    expect(DRAFT_MARKER.test('a backstop no test fully replaces')).toBe(false);
  });
});
