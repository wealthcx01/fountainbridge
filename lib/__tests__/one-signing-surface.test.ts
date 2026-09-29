import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { STUDIO_TOOLS } from '../mcp';

/**
 * There is exactly one surface where an external action is signed (FB-183).
 *
 * ## Why this is a test about source and not about behaviour
 *
 * The property is structural: it is not "the button works", it is **"there is only one button"**. A
 * runtime test can only ever prove that the surface it renders behaves correctly; it cannot prove that
 * a second surface was not added somewhere else. Only reading the whole tree can.
 *
 * D13's finding applies to architectural rules as much as to knowledge bases: *anything that must
 * happen every time needs a mechanism, not a sentence.* FB-183's rule was written down in three
 * separate comments and was still only a sentence until this file existed.
 *
 * ## What it is guarding
 *
 * Non-negotiable 4: nothing external ever executes without a recorded human approval. A second place to
 * sign is not a second convenience, it is a second chance to get the signing wrong — and the one that
 * gets it wrong is the one nobody is looking at. FB-140 is the precedent: two deposit paths, one
 * scanned and one not.
 *
 * It is also what keeps the eighth MCP tool honest. `propose_approval` is designed and deliberately
 * unbuilt; if a granting tool were ever added, this file fails as well as `mcp.test.ts`.
 */

const ROOT = join(import.meta.dirname, '..', '..');

/** Every source file a human wrote, ignoring builds, dependencies and tests. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const skip = new Set(['node_modules', '.next', '.git', 'coverage', '__tests__', 'e2e', 'visual-diff']);
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (skip.has(entry) || entry.startsWith('.')) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(path);
    }
  };
  for (const top of ['app', 'components', 'lib', 'scripts', 'deploy']) {
    try { walk(join(ROOT, top)); } catch { /* a tree that is not there cannot hold a second button */ }
  }
  return out;
}

const FILES = sourceFiles();
const read = (path: string) => readFileSync(path, 'utf8');
const rel = (path: string) => relative(ROOT, path).split('\\').join('/');

describe('one place to sign an external action (FB-183)', () => {
  it('reads a real tree, so the checks below mean something', () => {
    // A guard on the guard. If the walk ever returns nothing -- a renamed directory, a changed
    // extension -- every assertion in this file would pass by finding no violations anywhere, which is
    // exactly the vacuous-test failure the memory notes keep recording.
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.map(rel)).toContain('components/ApprovalCard.tsx');
    expect(FILES.map(rel)).toContain('app/actions/approvals.ts');
  });

  it('only one component may call the grant, and it is ApprovalCard', () => {
    const callers = FILES
      .filter((f) => rel(f) !== 'app/actions/approvals.ts')
      .filter((f) => /\b(approveExternalAction|refuseExternalAction)\b/.test(read(f)))
      .map(rel);
    // If this list grows, someone added a second way to decide. That is the change to justify.
    expect(callers).toEqual(['components/ApprovalCard.tsx']);
  });

  it('only one page may let that component decide', () => {
    // `decide` is the switch: `canDecide = decide && !done`, and without it every control renders
    // read-only. So this catches a second signing surface even if someone renders the card somewhere
    // new -- it only becomes a signing surface when `decide` is passed.
    const deciders = FILES
      .filter((f) => {
        const src = read(f);
        if (!src.includes('<ApprovalCard')) return false;
        // Each element, from its tag to the first '>' that closes it.
        return [...src.matchAll(/<ApprovalCard\b[^>]*>/g)].some((m) => /\bdecide\b/.test(m[0]));
      })
      .map(rel);
    expect(deciders).toEqual(['app/venture/[id]/approvals/[repo]/[approvalId]/page.tsx']);
  });

  it('the desk does not render the decision control at all', () => {
    // Named explicitly because this is the exact regression FB-183 was written to prevent: the desk is
    // the surface someone would most plausibly "improve" by putting the button back.
    //
    // The first version of this test looped over the desk's `<ApprovalCard>` elements asserting none
    // passed `decide` -- and there are NONE, so it looped over nothing and passed no matter what. Found
    // by trying to break it: the patch could not even be applied. The real property is stronger than
    // the one I first wrote, and an empty loop was hiding it.
    const board = read(join(ROOT, 'components', 'VentureBoard.tsx'));
    expect(board, 'the desk renders the approval control again').not.toMatch(/<ApprovalCard\b/);
  });

  it('no studio tool can grant, so a model cannot become the second surface', () => {
    // Cross-checked here as well as in mcp.test.ts on purpose. This file is the one a person reads when
    // asking "where can a grant happen?", and an answer that omitted the tool surface would be wrong.
    expect(STUDIO_TOOLS.filter((t) => t.kind === 'propose')).toEqual([]);
    for (const t of STUDIO_TOOLS) {
      expect(t.name, `${t.name} sounds like it decides`).not.toMatch(/approv|grant|sign/i);
    }
  });

  it('the lane cannot sign a grant either', () => {
    // The lane proposes. It holds no credential that can write a grant, and FB-071/FB-072 moved the
    // record onto ground it cannot author. This asserts the simpler half: nothing under deploy/ calls
    // the studio's grant actions.
    const laneCallers = FILES
      .filter((f) => rel(f).startsWith('deploy/'))
      .filter((f) => /\b(approveExternalAction|refuseExternalAction)\b/.test(read(f)))
      .map(rel);
    expect(laneCallers).toEqual([]);
  });
});
