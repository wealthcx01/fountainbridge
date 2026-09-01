import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRET_PATTERNS } from '../secrets';

/**
 * The two doors must refuse the same things (FB-140).
 *
 * A document reaches a venture's records two ways: the composer's deposit tool
 * (`deploy/librechat/deposit-mcp/stdio.mjs`, running on the venture box) and the studio's own Add
 * control. The box scanned from the day it was written; the studio did not scan at all, so a founder
 * could hand over a private key through the studio and it would land in permanent git history.
 *
 * They cannot be one module: one is TypeScript in this app, the other is a `.mjs` copied onto a box
 * with no build step. So they are two copies and this is the thing that stops them drifting — the
 * same treatment `lib/readiness.ts` gets for the env name it duplicates.
 *
 * If this fails, it is not the test that is wrong. One of the doors has stopped refusing something
 * the other refuses.
 */
describe('the studio and the composer refuse the same credentials', () => {
  const boxSource = readFileSync(
    join(process.cwd(), 'deploy', 'librechat', 'deposit-mcp', 'stdio.mjs'),
    'utf8',
  );

  it('the box still has a scanner at all', () => {
    expect(boxSource, 'the composer stopped scanning deposits').toContain('scanForSecrets');
  });

  /**
   * The labels inside the box's `SECRET_PATTERNS` array, and only those.
   *
   * Scoped to the array rather than swept from the whole file — the first version matched every
   * quoted string in `stdio.mjs` and reported that the studio "does not refuse content", which is a
   * sentence about a variable name.
   */
  const boxLabels = (() => {
    const start = boxSource.indexOf('const SECRET_PATTERNS = [');
    expect(start, 'the composer has no SECRET_PATTERNS array').toBeGreaterThan(-1);
    const block = boxSource.slice(start, boxSource.indexOf('\n];', start));
    return [...block.matchAll(/,\s*'([^']+)'\]/g)].map((m) => m[1]);
  })();

  it('every pattern the studio refuses, the box refuses too', () => {
    // Compared by the WORDS each pattern is labelled with rather than by regex source: the two are
    // written in different dialects, and a label is what a founder is actually told.
    for (const [, label] of SECRET_PATTERNS) {
      expect(boxLabels, `the composer no longer refuses ${label}`).toContain(label);
    }
  });

  it('the box refuses nothing the studio lets through', () => {
    // The other direction, which is the one that actually bit: a rule added on one side only.
    const studioLabels = SECRET_PATTERNS.map(([, label]) => label);
    for (const label of boxLabels) {
      expect(studioLabels, `the studio does not refuse ${label}, and the composer does`).toContain(label);
    }
  });
});
