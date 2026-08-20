import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';

/**
 * FB-116. The point of `sync-box.sh` is that a box-side file cannot be forgotten, so the thing worth
 * testing is the **ship list** — and specifically that it is derived rather than hand-maintained.
 *
 * A hand-maintained list is how FB-112 happened: a new module was added, nobody added it to the
 * mount block, and the failure only appeared on a box. This runs the script's own list functions.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SYNC_SH = join(ROOT, 'scripts/sync-box.sh');

const source = readFileSync(SYNC_SH, 'utf8');

/**
 * The script with its comments stripped.
 *
 * Needed because this file's comments quote the very shell constructs the assertions below forbid —
 * a test that reads a comment as code is a test that fails for the wrong reason, which is how the
 * first version of the grep-pipeline assertion behaved.
 */
const code = source
  .split('\n')
  .filter((l) => !l.trim().startsWith('#'))
  .join('\n');

/** Run one of the script's list functions, exactly as shipped. */
function shipList(fn) {
  const body = source.match(new RegExp(`^${fn}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));
  if (!body) throw new Error(`sync-box.sh no longer defines ${fn}()`);
  const out = execFileSync('bash', ['-c', `${body[0]}\n${fn}`], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

describe('what sync-box.sh ships to the lane', () => {
  const shipped = shipList('lane_files');

  it('ships every file in deploy/lane, so a new helper cannot be forgotten', () => {
    const onDisk = readdirSync(join(ROOT, 'deploy/lane'), { withFileTypes: true })
      .filter((e) => e.isFile() && !e.name.endsWith('.test.mjs'))
      .map((e) => e.name)
      .sort();
    expect(shipped.sort()).toEqual(onDisk);
  });

  it('carries the files three merged tickets need on a box', () => {
    // Named explicitly because these are the ones that were merged and running nowhere, and a
    // regression here would silently recreate exactly that state.
    for (const f of [
      'routines-fire.mjs', //   FB-047
      'routines-lib.mjs', //    FB-047
      'handoff-check.mjs', //   FB-060
      'handoff-lib.mjs', //     FB-060
      'runreport-record.mjs', //FB-060
      'supervisor.sh',
      'foundry-lib.sh',
      'run-once.sh',
    ]) {
      expect(shipped, `${f} must reach the box`).toContain(f);
    }
  });

  it('does not ship the tests — a box has no vitest and no reason to run them', () => {
    expect(shipped.some((f) => f.endsWith('.test.mjs'))).toBe(false);
    expect(shipped).not.toContain('__tests__');
  });

  it('names nothing that does not exist', () => {
    for (const f of shipped) expect(existsSync(join(ROOT, 'deploy/lane', f)), f).toBe(true);
  });
});

describe('what sync-box.sh ships to librechat', () => {
  const shipped = shipList('librechat_files');

  it('ships every host path the compose file mounts', () => {
    const compose = yaml.load(readFileSync(join(ROOT, 'deploy/librechat/docker-compose.yml'), 'utf8'));
    const mounts = Object.values(compose.services ?? {})
      .flatMap((s) => s.volumes ?? [])
      .filter((v) => typeof v === 'string' && v.startsWith('./'))
      .map((v) => v.split(':')[0].replace(/^\.\//, ''));
    for (const m of new Set(mounts)) {
      expect(shipped, `${m} is mounted but not shipped`).toContain(m);
    }
  });

  it('ships the seeder, which is not mounted and so is easy to miss', () => {
    // seed.sh runs on the host against the mongo container, so it appears in no volume list.
    expect(shipped).toContain('seed.sh');
    expect(shipped).toContain('seed-agent.js');
  });

  it('names nothing that does not exist', () => {
    for (const f of shipped) expect(existsSync(join(ROOT, 'deploy/librechat', f)), f).toBe(true);
  });
});

describe('the files systemd has to exec ship executable', () => {
  // The failure this pins took ARCA's lane down on 2026-08-20 with 203/EXEC. `foundry-lane.service`
  // has ExecStart=run-once.sh, the repo shipped it 644, tar faithfully carried that mode, and the
  // box had only ever worked because someone chmod'd it by hand months earlier.
  const mode = (p) =>
    execFileSync('git', ['ls-files', '-s', p], { cwd: ROOT, encoding: 'utf8' }).trim().split(' ')[0];

  it.each(['deploy/lane/run-once.sh', 'deploy/lane/supervisor.sh'])(
    '%s is executable in git, because systemd execs it',
    (p) => {
      expect(mode(p)).toBe('100755');
    },
  );

  it('every unit that execs one of our files DIRECTLY ships it executable', () => {
    // The distinction matters and the first version of this test missed it:
    //   ExecStart=/opt/foundry/lane/run-once.sh          → executed directly, needs the bit
    //   ExecStart=/usr/bin/env node /opt/.../x.mjs       → the interpreter is executed, x.mjs is an
    //                                                      argument, and the bit is irrelevant
    // Requiring it everywhere would be cargo-culting a mode onto files nothing execs.
    const units = readdirSync(join(ROOT, 'deploy/lane')).filter((f) => f.endsWith('.service'));
    expect(units.length).toBeGreaterThan(0);

    let checked = 0;
    for (const unit of units) {
      const text = readFileSync(join(ROOT, 'deploy/lane', unit), 'utf8');
      for (const [, line] of text.matchAll(/^ExecStart=(.*)$/gm)) {
        const first = line.trim().split(/\s+/)[0];
        const rel = `deploy/lane/${first.split('/').pop()}`;
        if (!existsSync(join(ROOT, rel))) continue; // an interpreter or a system binary, not ours
        expect(mode(rel), `${unit} execs ${rel} directly, so it must be executable in git`).toBe('100755');
        checked += 1;
      }
    }
    // At least one unit really does exec our own file directly — otherwise this passes vacuously.
    expect(checked).toBeGreaterThan(0);
  });
});

describe('the safety argument', () => {
  it('never deletes on the far side', () => {
    // The whole safety case is "only writes files that exist here, never removes". An `rm` or a
    // `--delete` appearing in this script would silently make a box's own state destructible.
    expect(code).not.toMatch(/\brm\s+-[rf]/);
    expect(code).not.toMatch(/--delete\b/);
  });

  it('verifies after pushing rather than trusting the transfer', () => {
    expect(source).toContain('still differ after the sync');
  });

  it('refuses to sync when a named file is missing locally', () => {
    expect(source).toContain('refusing to sync');
  });

  it('repairs modes next to each push, not once after both', () => {
    // The single trailing chmod never ran when the second push aborted the script, which is how
    // run-once.sh ended up at 644 on a live box.
    expect(code).toMatch(/fix_modes "\/opt\/foundry\/lane/);
    expect(code).toMatch(/fix_modes "\/opt\/foundry\/librechat/);
  });

  it('does not pipe a possibly-empty list into grep, which would exit before verifying', () => {
    // The first real run against ARCA died here. `printf '%s\n' ""` sends one blank line into
    // `grep .`, which exits 1, and under `set -euo pipefail` that killed the script immediately
    // after the lane push — so the checksum verify, the systemd reload and the re-seed warnings all
    // silently never ran. Work done, verification skipped: the exact failure this script exists to
    // end, committed by the script itself.
    expect(code).not.toMatch(/\|\s*grep \.\s*\|\s*push/);
    expect(code).toMatch(/if \[ -n "\$LANE_CHANGED" \]/);
    expect(code).toMatch(/if \[ -n "\$LC_CHANGED" \]/);
  });
});
