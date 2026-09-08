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
 * FB-176 made it three. The box's own credential scanner (`deploy/foundry/secret-scan.mjs`) needs
 * the same net, and for the same reason cannot import it: it is a standalone script root runs from a
 * systemd timer, on a box with no build step and no `node_modules`. A third copy that could quietly
 * fall behind is how a box ends up not looking for the one kind of credential the studio refuses.
 *
 * If this fails, it is not the test that is wrong. One of the three has stopped refusing something
 * the others refuse.
 */
describe('the studio and the composer refuse the same credentials', () => {
  const boxSource = readFileSync(
    join(process.cwd(), 'deploy', 'librechat', 'deposit-mcp', 'stdio.mjs'),
    'utf8',
  );
  const scannerSource = readFileSync(
    join(process.cwd(), 'deploy', 'foundry', 'secret-scan.mjs'),
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

  /** The same extraction, against the box's credential scanner (FB-176). */
  const scannerLabels = (() => {
    const start = scannerSource.indexOf('const SECRET_PATTERNS = [');
    expect(start, 'the box scanner has no SECRET_PATTERNS array').toBeGreaterThan(-1);
    const block = scannerSource.slice(start, scannerSource.indexOf('\n];', start));
    return [...block.matchAll(/,\s*'([^']+)'\]/g)].map((m) => m[1]);
  })();

  it('the box\u2019s credential scanner looks for everything the studio refuses', () => {
    // The scanner is the third copy. A rule added to the studio and not to it means a box stops
    // looking for the one kind of credential the studio has just decided matters.
    for (const [, label] of SECRET_PATTERNS) {
      expect(scannerLabels, `the box scanner no longer looks for ${label}`).toContain(label);
    }
  });

  it('and looks for nothing the studio does not refuse', () => {
    const studioLabels = SECRET_PATTERNS.map(([, label]) => label);
    for (const label of scannerLabels) {
      expect(studioLabels, `the box scanner looks for ${label} and the studio does not refuse it`).toContain(label);
    }
  });
});
