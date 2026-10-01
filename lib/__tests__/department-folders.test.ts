import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeOf, DEPARTMENT_OF_FOLDER as STUDIO_MAP } from '../knowledge';
// @ts-expect-error — a plain .mjs module from the lane, no type declarations
import * as brain from '../../deploy/lane/brain-lib.mjs';

/**
 * Where each department's documents live, agreed in three places (FB-169).
 *
 * The brain (gbrain) skips every folder named `build`, treating it as compiled output. ARCA's Build
 * documents lived in context/build/, so the team's brain never found them: 2 of 7 documents were
 * searchable. The fix moves Build to `product/`. That only holds if the tool that SAVES documents,
 * the brain that READS them, and the studio that SHOWS them all use the same folder. Three copies
 * exist because they run in three places (a container on the box, the lane on the box, the studio),
 * so this test is what keeps them one decision.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const depositSrc = readFileSync(join(ROOT, 'deploy', 'librechat', 'deposit-mcp', 'stdio.mjs'), 'utf8');

/** The deposit tool's map, read from its source: it runs in a container and cannot be imported. */
function depositMap(): Record<string, string> {
  const m = /const FOLDER_OF_DEPARTMENT = (\{[^}]*\})/.exec(depositSrc);
  expect(m, 'the deposit tool no longer declares FOLDER_OF_DEPARTMENT').toBeTruthy();
  return Function(`return (${m![1]})`)();
}

describe('every department has a folder the brain can see', () => {
  it('no department is saved into a folder the brain skips', () => {
    for (const [dept, folder] of Object.entries(brain.FOLDER_OF_DEPARTMENT as Record<string, string>)) {
      expect(brain.GBRAIN_PRUNED_DIRS, `${dept} is saved in ${folder}/, which the brain never reads`).not.toContain(folder);
    }
  });

  it('covers every department the lane knows', () => {
    expect(Object.keys(brain.FOLDER_OF_DEPARTMENT).sort()).toEqual([...brain.DEPARTMENTS].sort());
  });
});

describe('the saver, the brain and the studio agree', () => {
  it('the deposit tool saves each department where the brain puts it', () => {
    expect(depositMap()).toEqual(brain.FOLDER_OF_DEPARTMENT);
  });

  it('the deposit tool builds its path from the map, not the department name', () => {
    expect(depositSrc).toMatch(/`\$\{area\}\/\$\{FOLDER_OF_DEPARTMENT\[dept\]\}\/\$\{slug\}\.md`/);
  });

  it('the studio reads folders the same way the brain does', () => {
    expect(STUDIO_MAP).toEqual(brain.DEPARTMENT_OF_FOLDER);
  });

  it('a document saved for each department comes back as that department, in the brain and the studio', () => {
    for (const [dept, folder] of Object.entries(depositMap())) {
      expect(placeOf(`context/${folder}/x.md`)?.department).toBe(dept);
      if (dept !== 'general') expect(brain.pageDepartment(`context/${folder}/x`)).toBe(dept);
    }
  });

  it('a Build document saved before the move still reads as Build', () => {
    expect(placeOf('context/build/old.md')?.department).toBe('build');
    expect(brain.pageDepartment('context/build/old')).toBe('build');
  });
});

describe('the brain says when it is missing documents', () => {
  // ARCA's real state on 2026-10-01: seven tracked files, two pages in the brain.
  const tracked = [
    'context/README.md',
    'context/build/auction-aggregator-v1-scope.md',
    'context/build/kraken-d-source-mismatch.md',
    'context/build/no-fake-demo-data-policy.md',
    'context/sell/arca-brand-positioning.md',
    'context/sell/market-note-terminal-wedge.md',
    'library/README.md',
  ];
  const listed = ['context/sell/arca-brand-positioning', 'context/sell/market-note-terminal-wedge', 'docs/tickets/arca-061'];

  it('names the three Build documents ARCA\'s brain could not find', () => {
    const gap = brain.corpusGap(tracked, listed);
    expect(gap.corpus).toBe(5);
    expect(gap.missing).toEqual([
      'context/build/auction-aggregator-v1-scope.md',
      'context/build/kraken-d-source-mismatch.md',
      'context/build/no-fake-demo-data-policy.md',
    ]);
  });

  it('finds nothing missing once the brain holds them all', () => {
    const all = [...listed, 'context/build/auction-aggregator-v1-scope', 'context/build/kraken-d-source-mismatch', 'context/build/no-fake-demo-data-policy'];
    expect(brain.corpusGap(tracked, all)).toEqual({ corpus: 5, missing: [] });
  });

  it('does not count a folder README, which the brain skips on purpose', () => {
    expect(brain.corpusGap(['context/README.md', 'library/README.md'], [])).toEqual({ corpus: 0, missing: [] });
  });
});

describe('page names follow gbrain\'s own rule', () => {
  // Cases taken from gbrain's slugifyPath (src/core/sync.ts) and its doc comment.
  it.each([
    ['context/sell/arca-brand-positioning.md', 'context/sell/arca-brand-positioning'],
    ['context/sell/Brand Notes.md', 'context/sell/brand-notes'],
    ['Apple Notes/2017-05-03 ohmygreen.md', 'apple-notes/2017-05-03-ohmygreen'],
    ['notes/v1.0.0.md', 'notes/v1.0.0'],
    ['context/product/Café — pricing (draft).md', 'context/product/cafe-pricing-draft'],
  ])('%s → %s', (path, name) => {
    expect(brain.pageNameOf(path)).toBe(name);
  });

  it('does not report a capitalised file missing when the brain holds it', () => {
    expect(brain.corpusGap(['context/sell/Brand Notes.md'], ['context/sell/brand-notes']).missing).toEqual([]);
  });
});
