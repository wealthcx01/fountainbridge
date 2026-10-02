import { describe, it, expect } from 'vitest';
import { historyPaths } from '../export-history.mjs';

// The migration exports a venture's whole record from one recursive tree listing (FB-171).
describe('which files are a venture\'s approval history', () => {
  const tree = [
    { type: 'blob', path: 'activegraph/arca/arca-marketing/b/0002-approval.granted.json' },
    { type: 'blob', path: 'activegraph/arca/arca-marketing/b/0001-approval.proposed.json' },
    { type: 'blob', path: 'activegraph/arca/arca-marketing/a/0001-approval.proposed.json' },
    { type: 'tree', path: 'activegraph/arca/arca-marketing/a' },
    { type: 'blob', path: 'activegraph/.writable' },
    { type: 'blob', path: 'activegraph/arca-two/x/y/0001-approval.proposed.json' },
    { type: 'blob', path: 'activegraph/the-reset/r/z/0001-approval.proposed.json' },
    { type: 'blob', path: 'app/page.tsx' },
  ];

  it('takes only this venture\'s event files, in a stable order', () => {
    expect(historyPaths(tree, 'arca').map((t) => t.path)).toEqual([
      'activegraph/arca/arca-marketing/a/0001-approval.proposed.json',
      'activegraph/arca/arca-marketing/b/0001-approval.proposed.json',
      'activegraph/arca/arca-marketing/b/0002-approval.granted.json',
    ]);
  });

  it('never takes another venture whose name starts the same way', () => {
    // "arca" must not export "arca-two": venture isolation (CLAUDE.md #6) at the first step.
    expect(historyPaths(tree, 'arca').some((t) => t.path.includes('arca-two'))).toBe(false);
  });
});
