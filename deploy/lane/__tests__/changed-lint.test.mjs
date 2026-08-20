import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * FB-115 — the lane's VALIDATE must ask the question its venture's CI asks.
 *
 * `venture_regression` is shell, so this drives the real function out of `foundry-lib.sh` rather
 * than reimplementing its logic. The rule under test is narrow and easy to get backwards: the
 * changed-files lint is **not** a baseline comparison, because on a repo with pre-existing debt a
 * baseline comparison never fires — which is the entire bug.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(HERE, '../foundry-lib.sh');
const source = readFileSync(LIB, 'utf8');

/** The real `venture_regression`, lifted out and run against probe files we control. */
function regression(baseProbe, branchProbe) {
  const fn = source.match(/^venture_regression\(\) \{[\s\S]*?^\}/m);
  if (!fn) throw new Error('foundry-lib.sh no longer defines venture_regression()');

  const dir = mkdtempSync(join(tmpdir(), 'fb115-'));
  const base = join(dir, 'base.res');
  const branch = join(dir, 'branch.res');
  writeFileSync(base, baseProbe);
  writeFileSync(branch, branchProbe);

  try {
    const out = execFileSync('bash', ['-c', `${fn[0]}\nventure_regression "$1" "$2"`, 'bash', base, branch], {
      encoding: 'utf8',
    });
    return { failed: false, message: out.trim() };
  } catch (err) {
    return { failed: true, message: String(err.stdout ?? '').trim() };
  }
}

/** ARCA's real shape: whole-repo lint has never passed, tests pass, typecheck passes. */
const ARCA_BASE = 'typecheck 0\nlint 1\ntest 0\n';

describe('lint-changed counts what THIS change wrote, not what it inherited', () => {
  it('fails a change that introduced problems on its own lines', () => {
    const r = regression(ARCA_BASE, 'typecheck 0\nlint 1\nlint-changed 2\ntest 0\n');
    expect(r.failed).toBe(true);
    expect(r.message).toContain('introduced 2 lint problem');
  });

  it('passes a change that added none, on a repo that is already dirty', () => {
    // The case that forced this amendment. ARCA-53 touched ONE line of a file carrying six
    // pre-existing errors. Under the first version of this gate it failed, went to a repair round
    // it could not win, and would have tripped the circuit breaker and parked real work over
    // problems that were not in its change.
    const r = regression(ARCA_BASE, 'typecheck 0\nlint 1\nlint-changed 0\ntest 0\n');
    expect(r.failed).toBe(false);
  });

  it('does not blame the lane for the venture’s pre-existing debt', () => {
    // The old guard exists for a reason and must survive: whole-repo lint failing on both sides is
    // not this change's fault, and saying it is would make every ticket unworkable.
    const r = regression(ARCA_BASE, 'typecheck 0\nlint 1\nlint-changed 0\ntest 0\n');
    expect(r.message).not.toContain('lint');
  });

  it('passes when the toolchain has no changed-files linter, rather than guessing', () => {
    const r = regression(ARCA_BASE, 'typecheck 0\nlint 1\nlint-changed none\ntest 0\n');
    expect(r.failed).toBe(false);
  });

  it('still passes an older probe that predates this field', () => {
    // A box mid-upgrade writes probes with no `lint-changed` line. That must not read as failure.
    const r = regression(ARCA_BASE, 'typecheck 0\nlint 1\ntest 0\n');
    expect(r.failed).toBe(false);
  });
});

describe('the checks it must not have broken', () => {
  it('still catches a typecheck that this change broke', () => {
    const r = regression('typecheck 0\nlint 0\ntest 0\n', 'typecheck 2\nlint 0\nlint-changed 0\ntest 0\n');
    expect(r.failed).toBe(true);
    expect(r.message).toContain('typecheck');
  });

  it('still catches added failing tests', () => {
    const r = regression('typecheck 0\nlint 0\ntest 2\n', 'typecheck 0\nlint 0\nlint-changed 0\ntest 5\n');
    expect(r.failed).toBe(true);
    expect(r.message).toContain('failing tests');
  });

  it('still catches a whole-repo lint that WAS passing and now is not', () => {
    const r = regression('typecheck 0\nlint 0\ntest 0\n', 'typecheck 0\nlint 1\nlint-changed 0\ntest 0\n');
    expect(r.failed).toBe(true);
    expect(r.message).toContain('lint');
  });
});

describe('changed_lint, the probe side', () => {
  it('counts only findings on lines the change added', () => {
    // The amendment's whole point. biome lints the WHOLE of a changed file, so the probe has to
    // intersect its findings with the diff's added lines — otherwise inherited debt reads as this
    // change's fault, which is a gate no change to that file could pass.
    const fn = source.match(/^changed_lint\(\) \{[\s\S]*?^\}/m);
    expect(fn).toBeTruthy();
    expect(fn[0]).toContain('git diff --unified=0');
    expect(fn[0]).toContain('comm -12');
  });

  it('handles a ticket-only change without calling it a lint failure', () => {
    // biome exits 1 when it processes no files, and a ticket-only change touches nothing it lints.
    // Without --no-errors-on-unmatched every ticket the composer files reads as a failure — the
    // same trap ARCA-34's CI had to handle, and it must be handled here too.
    expect(source).toContain('--no-errors-on-unmatched');
  });

  it('says `none` for a toolchain it cannot lint, rather than passing quietly', () => {
    const fn = source.match(/^changed_lint\(\) \{[\s\S]*?^\}/m);
    expect(fn, 'foundry-lib.sh no longer defines changed_lint()').toBeTruthy();
    expect(fn[0]).toContain('echo none');
  });

  it('compares against the base branch, not against nothing', () => {
    expect(source).toContain('--since="origin/$base"');
  });
});
