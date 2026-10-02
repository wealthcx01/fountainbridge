// The high-impact gate (FB-122, FB-162): plan first, then — once the founder has given the go —
// work it. Driven through the real foundry-lib.sh, the file run-once.sh sources.
//
// Before FB-162 a release cleared the hold and the gate sent the ticket straight back to planning,
// because the ticket still mentioned sign-in. ARCA re-planned it until its daily allowance ran out,
// every day for five weeks, and the founder's go on ARCA-061 never became work.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIB = new URL('../foundry-lib.sh', import.meta.url).pathname;
const RUN_ONCE = readFileSync(new URL('../run-once.sh', import.meta.url), 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'plan-gate-'));

function ticket(name, body) {
  const p = join(dir, `${name}.md`);
  writeFileSync(p, body);
  return p;
}

/** Exit status of `plan_before_work <ticket> <released-by>`: true means "stop and plan". */
function mustPlan(file, releasedBy = '') {
  try {
    execFileSync('bash', ['-c', `set -euo pipefail; export REPO=o/r TICKET_GITHUB_TOKEN=x; . "${LIB}"; plan_before_work "$1" "$2"`, '_', file, releasedBy]);
    return true;
  } catch {
    return false;
  }
}

// ARCA-061's own words, shortened: it is about saved lists, and it mentions sign-in.
const arca061 = ticket('ARCA-061', '# Saved card lists not persisting\n\nLists vanish after sign-in. Check the auth session and the user id.\n');
const ordinary = ticket('ARCA-070', '# Show the set name on card pages\n\nAdd the set name under the title.\n');

describe('the high-impact gate', () => {
  it('stops to plan a ticket that touches sign-in, when nobody has released it', () => {
    expect(mustPlan(arca061)).toBe(true);
  });

  it('works it once the founder has read the plan and given the go', () => {
    expect(mustPlan(arca061, 'john.gallagher@wealthcx.com')).toBe(false);
  });

  it('never stops to plan an ordinary ticket', () => {
    expect(mustPlan(ordinary)).toBe(false);
  });
});

describe('run-once.sh hands the release to the gate', () => {
  // The function is only half the fix: the lane must pass who released the ticket into it, and must
  // remember that per ticket rather than leaking one ticket's release onto the next.
  it('asks the gate with the picked ticket and who released it', () => {
    expect(RUN_ONCE).toMatch(/plan_before_work "\$PICK" "\$PICK_RELEASED_BY"/);
  });

  it('records who released the ticket it picks', () => {
    expect(RUN_ONCE).toMatch(/if released_by=\$\(release_of "\$slug"\); then/);
    expect(RUN_ONCE).toMatch(/PICK_RELEASED_BY="\$released_by"/);
  });

  it('forgets the release for every new ticket it looks at', () => {
    const loop = RUN_ONCE.slice(RUN_ONCE.indexOf('for f in docs/tickets/*.md'));
    expect(loop.indexOf('released_by=""')).toBeGreaterThan(-1);
    expect(loop.indexOf('released_by=""')).toBeLessThan(loop.indexOf('release_of "$slug"'));
  });

  it('does not log a released high-impact ticket as low-risk', () => {
    // Seen on ARCA the first time ARCA-061 was worked: the log called it "low blast-radius".
    expect(RUN_ONCE).toMatch(/if \[ -n "\$PICK_RELEASED_BY" \] && is_plan_first "\$PICK"; then\s+flog "working [^"]*high-impact, released by/);
  });
});
