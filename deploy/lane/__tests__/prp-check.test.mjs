// prp-check.mjs is the bash↔JS contract the whole validation loop rests on, and it speaks in EXIT
// CODES. `report` exiting 4 when a gate failed is the single signal that stops the loop breaking
// early: lose it and the supervisor opens a PR whose body lists ❌ gates under a "PRP gates ✅"
// header. So the codes get pinned, not just the pure functions behind them.

import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../prp-check.mjs', import.meta.url).pathname;
let dir;
let GOOD;
let NO_GATES;
let ALL_PASS;
let PARTIAL;
let JUNK;

// spawnSync, not execFileSync: stdout AND stderr are needed on the success path too — keeping the
// advisory off stdout is part of the contract prp_gate_count depends on.
function cli(...args) {
  const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
  return { rc: r.status, out: r.stdout || '', err: r.stderr || '' };
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'prp-check-'));
  GOOD = join(dir, 'good.md');
  writeFileSync(GOOD, [
    '# PRP — x', '', '## Intent', 'x', '', '## Context', 'x', '', '## Approach', 'x', '',
    '## Tasks', '- [ ] x', '', '## Validation gates',
    '- [ ] happy path: it renders', '- [ ] edge cases: empty is fine',
    '- [ ] errors: failure shows a message', '- [ ] coverage: tests cover both', '',
  ].join('\n'));

  NO_GATES = join(dir, 'nogates.md');
  writeFileSync(NO_GATES, '# PRP\n\n## Intent\nx\n\n## Context\nx\n\n## Approach\nx\n\n## Tasks\n- [ ] x\n');

  ALL_PASS = join(dir, 'allpass.json');
  writeFileSync(ALL_PASS, JSON.stringify(['g1', 'g2', 'g3', 'g4'].map((id) => ({ id, pass: true, why: 'ok' }))));

  PARTIAL = join(dir, 'partial.json');
  writeFileSync(PARTIAL, JSON.stringify([{ id: 'g1', pass: true, why: 'ok' }]));

  JUNK = join(dir, 'junk.json');
  writeFileSync(JUNK, 'not json at all');
});

describe('prp-check exit codes — the loop signal', () => {
  it('exits 4 when any gate failed', () => {
    expect(cli('report', GOOD, PARTIAL).rc).toBe(4);
    expect(cli('summary', GOOD, PARTIAL).rc).toBe(4);
  });

  it('exits 0 only when every gate passed', () => {
    expect(cli('report', GOOD, ALL_PASS).rc).toBe(0);
    expect(cli('summary', GOOD, ALL_PASS).rc).toBe(0);
  });

  it('fails closed on a missing, unparseable or absent verdict file', () => {
    // The cheapest way for a checking step to "pass" must never be to produce nothing.
    expect(cli('report', GOOD, join(dir, 'nope.json')).rc).toBe(4);
    expect(cli('report', GOOD, JUNK).rc).toBe(4);
    expect(cli('report', GOOD).rc).toBe(4);
  });
});

describe('prp-check validate — what prp_gate_count and prp_ok read', () => {
  it('puts ONLY the gate count on stdout, and exits 0', () => {
    const r = cli('validate', GOOD);
    expect(r.rc).toBe(0);
    expect(r.out.trim()).toBe('4');   // prp_gate_count parses exactly this
  });

  it('exits 1 with the reason on stderr for a plan that is not a PRP', () => {
    const r = cli('validate', NO_GATES);
    expect(r.rc).toBe(1);
    expect(r.out.trim()).toBe('');            // nothing on stdout to be mistaken for a count
    expect(r.err).toContain('validation gates');
  });

  it('keeps the coverage advisory off stdout', () => {
    const partial = join(dir, 'onegate.md');
    writeFileSync(partial, `${'# PRP\n\n## Intent\nx\n\n## Context\nx\n\n## Approach\nx\n\n## Tasks\n- [ ] x\n\n## Validation gates\n'}- [ ] happy path: works\n`);
    const r = cli('validate', partial);
    expect(r.rc).toBe(0);
    expect(r.out.trim()).toBe('1');
    expect(r.err).toContain('edge cases');    // advisory, on stderr
  });
});

describe('prp-check gates — the format interpolated into the checking prompt', () => {
  it('emits id<TAB>text, one per line', () => {
    const r = cli('gates', GOOD);
    expect(r.rc).toBe(0);
    const lines = r.out.trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^g1\thappy path: it renders$/);
    expect(lines[3]).toMatch(/^g4\t/);
  });
});

describe('prp-check misuse — exits 2, never a success that hides a mistake', () => {
  it('rejects a missing argument, an unknown command and an unreadable file', () => {
    expect(cli('validate').rc).toBe(2);
    expect(cli().rc).toBe(2);
    expect(cli('bogus', GOOD).rc).toBe(2);
    expect(cli('validate', join(dir, 'does-not-exist.md')).rc).toBe(2);
  });
});
