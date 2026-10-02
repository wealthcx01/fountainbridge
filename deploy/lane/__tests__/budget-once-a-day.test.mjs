// A spent daily budget is said once a day, then on the heartbeat (FB-162).
//
// The lane used to write a dated "budget used up" report on every wake once the day's allowance was
// spent: up to 288 identical files a day. On ARCA that was 9,308 of its 10,213 reports. Driven
// through the real foundry-lib.sh, the file run-once.sh sources.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIB = new URL('../foundry-lib.sh', import.meta.url).pathname;
const RUN_ONCE = readFileSync(new URL('../run-once.sh', import.meta.url), 'utf8');

function firstToday(stateDir, date) {
  // `date` is replaced so a test can move to the next day.
  const fake = date ? `date() { echo ${date}; }; ` : '';
  try {
    execFileSync('bash', ['-c', `set -euo pipefail; export REPO=o/r TICKET_GITHUB_TOKEN=x; . "${LIB}"; ${fake}budget_spent_first_today "$1"`, '_', stateDir]);
    return true;
  } catch {
    return false;
  }
}

describe('the spent budget is reported once a day', () => {
  it('says so on the first spent wake, and not on the next ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-'));
    expect(firstToday(dir, '2026-10-02')).toBe(true);
    expect(firstToday(dir, '2026-10-02')).toBe(false);
    expect(firstToday(dir, '2026-10-02')).toBe(false);
    expect(readdirSync(dir)).toEqual(['budget-spent-2026-10-02']);
  });

  it('says so again the next day', () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-'));
    expect(firstToday(dir, '2026-10-02')).toBe(true);
    expect(firstToday(dir, '2026-10-03')).toBe(true);
  });

  it('works with the real clock', () => {
    const dir = mkdtempSync(join(tmpdir(), 'budget-'));
    expect(firstToday(dir)).toBe(true);
    expect(firstToday(dir)).toBe(false);
  });
});

describe('run-once.sh uses it', () => {
  const gate = RUN_ONCE.slice(RUN_ONCE.indexOf('# --- budget gate'), RUN_ONCE.indexOf('# --- blast-radius routing'));

  it('writes the dated report only on the first spent wake', () => {
    expect(gate).toMatch(/if budget_spent_first_today "\$STATE_DIR"; then\s+write_runreport "\$PICK_SLUG" "blocked"/);
  });

  it('keeps later wakes visible on the heartbeat, so the team still reads as alive', () => {
    expect(gate).toMatch(/else\s+write_runreport "heartbeat" "blocked"/);
  });
});
