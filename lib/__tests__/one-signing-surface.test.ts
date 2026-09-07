import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * FB-183: the ActiveGraph grant is signed on exactly one surface.
 *
 * ## Why this is a structural test and not a UI one
 *
 * A test that clicks Approve proves that surface works. It cannot prove no OTHER surface can sign,
 * and that is the property that matters: two places to approve is two places to get the signing
 * wrong, and the one this ticket exists to fix was invisible until somebody counted.
 *
 * So this counts. It reads the source and asserts that the server actions which write a decision are
 * reachable from exactly one component, and that the component defaults to read-only. A new screen
 * that renders an approval and does not think about `decide` gets a card with no controls — the
 * harmless mistake — and adding a second signing surface fails here rather than shipping quietly.
 */

const ROOT = join(__dirname, '..', '..');
const SKIP = new Set(['node_modules', '.next', '.git', 'test-results', 'playwright-report', 'e2e']);

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(entry) && !full.includes('__tests__')) out.push(full);
  }
  return out;
}

const files = sources(ROOT);
const importers = (symbol: string) =>
  files.filter((f) => {
    if (f.endsWith(join('app', 'actions', 'approvals.ts'))) return false;
    return new RegExp(`\\b${symbol}\\b`).test(readFileSync(f, 'utf8'));
  }).map((f) => f.slice(ROOT.length + 1));

describe('one place to decide (FB-183)', () => {
  it('only one component can sign a grant or a refusal', () => {
    expect(importers('approveExternalAction')).toEqual(['components/ApprovalCard.tsx']);
    expect(importers('refuseExternalAction')).toEqual(['components/ApprovalCard.tsx']);
  });

  it('that component is read-only unless a route deliberately says otherwise', () => {
    const card = readFileSync(join(ROOT, 'components', 'ApprovalCard.tsx'), 'utf8');
    // The default is the safety. `decide = true` would silently arm every surface that renders one.
    expect(card).toMatch(/decide\s*=\s*false/);
    expect(card).toMatch(/const canDecide = decide && !done/);
  });

  it('exactly one route arms it', () => {
    const armed = files
      .filter((f) => f.startsWith(join(ROOT, 'app')))
      .filter((f) => /<ApprovalCard[^>]*\sdecide\b/s.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1));
    expect(armed).toEqual([join('app', 'venture', '[id]', 'approvals', '[repo]', '[approvalId]', 'page.tsx')]);
  });

  it('the desk renders approvals, and cannot sign one', () => {
    const board = readFileSync(join(ROOT, 'components', 'VentureBoard.tsx'), 'utf8');
    expect(board).toContain('ApprovalCard');
    // No `decide` anywhere on the desk's cards — the prop it does not pass is the whole guarantee.
    expect(/<ApprovalCard[^>]*\sdecide\b/s.test(board)).toBe(false);
  });
});
