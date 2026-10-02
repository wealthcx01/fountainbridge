// What run-once.sh counts when the ticket goes to a temporary machine (FB-239).
//
// A machine the studio refused or could not make is neither a wake nor an attempt: the ticket never
// ran. Before this, it counted as both, so three provider failures in a row parked a ticket with the
// untrue reason "couldn't get it past its own review/tests" and used up the day's wakes.
//
// Runs the real block from run-once.sh, with `node` replaced by a stand-in that answers as
// ticket-machine.mjs would.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUN_ONCE = readFileSync(new URL('../run-once.sh', import.meta.url), 'utf8');
const COUNTER = RUN_ONCE.slice(RUN_ONCE.indexOf('count_wake_and_attempt() {'), RUN_ONCE.indexOf('if [ "$REQUIRE_PROPOSAL" = 1 ]; then'));
const MACHINE = RUN_ONCE.slice(RUN_ONCE.indexOf('# --- FB-239: the work on a machine'), RUN_ONCE.lastIndexOf('count_wake_and_attempt'));

function wake(machineExit, say, state = mkdtempSync(join(tmpdir(), 'wake-'))) {
  const bin = mkdtempSync(join(tmpdir(), 'bin-'));
  writeFileSync(join(bin, 'said'), say);
  writeFileSync(join(bin, 'node'), `#!/bin/sh\ncat "${join(bin, 'said')}"\nexit ${machineExit}\n`);
  chmodSync(join(bin, 'node'), 0o755);
  const script = `
    set -euo pipefail
    STATE_DIR="$1"; BUDGET_FILE="$STATE_DIR/wakes"; PICK_SLUG=ARCA-061; PICK="/repo/docs/tickets/ARCA-061.md"; REPO_DIR=/repo
    SCRIPT_DIR=/lane; REQUIRE_PROPOSAL=0; TICKET_MACHINES=on
    flog() { :; }
    attempts_of() { if [ -f "$STATE_DIR/attempts-$1" ]; then cat "$STATE_DIR/attempts-$1"; else echo 0; fi; }
    write_runreport() { echo "$1|$2|$3" >> "$STATE_DIR/reports"; }
    ${COUNTER}
    ${MACHINE}
    echo "fell through to the supervisor" >> "$STATE_DIR/reports"
  `;
  execFileSync('bash', ['-c', script, '_', state], { env: { PATH: `${bin}:${process.env.PATH}` } });
  const read = (f) => (existsSync(join(state, f)) ? readFileSync(join(state, f), 'utf8') : '');
  return { state, wakes: read('wakes').split('\n').filter(Boolean).length, attempts: read('attempts-ARCA-061').trim(), reports: read('reports') };
}

describe('a machine that was not made', () => {
  it('is not a wake and not an attempt, and the founder is told why — once a day, then on the heartbeat', () => {
    const first = wake(3, 'This month\'s budget for temporary machines ($40.00) is used, so no machine was made.');
    expect(first.wakes).toBe(0);
    expect(first.attempts).toBe('');
    expect(first.reports).toBe('ARCA-061|blocked|This month\'s budget for temporary machines ($40.00) is used, so no machine was made.\n');
    const second = wake(3, 'still used', first.state);
    expect(second.reports.split('\n')[1]).toMatch(/^heartbeat\|blocked\|Your team is awake, and waiting for a temporary machine: still used/);
    expect(second.wakes).toBe(0);
  });
});

describe('a machine that was made', () => {
  it('that reached its end counts one wake and one attempt, and writes nothing (the lane on the machine did)', () => {
    const r = wake(0, 'worked');
    expect(r).toMatchObject({ wakes: 1, attempts: '1', reports: '' });
  });

  it('that did not reach its end counts, and the founder reads the studio\'s sentence', () => {
    const r = wake(1, 'stopped while its machine was setting itself up');
    expect(r).toMatchObject({ wakes: 1, attempts: '1' });
    expect(r.reports).toBe('ARCA-061|blocked|stopped while its machine was setting itself up\n');
  });

  it('never falls through to working the ticket on this box as well', () => {
    for (const code of [0, 1, 3]) expect(wake(code, 'x').reports).not.toContain('fell through');
  });
});
