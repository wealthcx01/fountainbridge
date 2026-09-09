import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRoots } from '../secret-scan.mjs';

/**
 * FB-176 — the migration, run against a copy of a box rather than read.
 *
 * This script runs as root on a venture box and moves live credentials between files. "It parses"
 * is not evidence that it works, and the failure mode if it does not is a box whose lane cannot push
 * and whose composer cannot file a ticket, with no message saying why.
 *
 * The planted values are obviously fake and long enough to match the patterns; nothing here is a real
 * credential (CLAUDE.md #8).
 */
const FAKE_PAT = `github_pat_${'1'.repeat(22)}_${'A'.repeat(59)}`;
const SCRIPT = new URL('../install-credentials.sh', import.meta.url).pathname;

let box;
const at = (...p) => join(box, ...p);
const read = (rel) => readFileSync(at(rel), 'utf8');

const run = () => execFileSync('bash', [SCRIPT], {
  env: {
    ...process.env,
    FOUNDRY_CREDENTIALS: at('etc/foundry/credentials'),
    LANE_ENV: at('opt/foundry/lane/lane.env'),
    CHAT_ENV: at('opt/foundry/librechat/.env'),
  },
  encoding: 'utf8',
});

beforeEach(() => {
  box = mkdtempSync(join(tmpdir(), 'fb176-install-'));
  mkdirSync(at('opt/foundry/lane'), { recursive: true });
  mkdirSync(at('opt/foundry/librechat'), { recursive: true });
  writeFileSync(at('opt/foundry/lane/lane.env'),
    `FOUNDRY_DEPARTMENTS="build sell scale"\nDAILY_BUDGET_USD=8\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
  writeFileSync(at('opt/foundry/librechat/.env'),
    `HOST=0.0.0.0\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
});
afterEach(() => { rmSync(box, { recursive: true, force: true }); });

describe('moving a box to one credential home (FB-176)', () => {
  it('ends with the token in exactly one file, and the scanner agrees', () => {
    run();
    // The claim the whole ticket makes, checked the way the ticket says to check it.
    const { findings } = scanRoots([at('opt'), at('etc')], { allowed: new Set([at('etc/foundry/credentials')]) });
    expect(findings, findings.map((f) => `${f.path}:${f.line}`).join(', ')).toEqual([]);
    expect(read('etc/foundry/credentials')).toContain(`TICKET_GITHUB_TOKEN=${FAKE_PAT}`);
  });

  it('leaves a pointer where the value was, not a hole', () => {
    run();
    // Somebody opening lane.env looking for a token should be told where it went. A deleted line
    // teaches them nothing and a stale one still works, which is how this started.
    expect(read('opt/foundry/lane/lane.env')).toContain('now lives in');
    expect(read('opt/foundry/lane/lane.env')).not.toContain(FAKE_PAT);
    expect(read('opt/foundry/librechat/.env')).not.toContain(FAKE_PAT);
  });

  it('does not touch anything that is not a secret', () => {
    run();
    const lane = read('opt/foundry/lane/lane.env');
    expect(lane).toContain('FOUNDRY_DEPARTMENTS="build sell scale"');
    expect(lane).toContain('DAILY_BUDGET_USD=8');
  });

  it('takes a backup, and blanks the secret in the backup too', () => {
    run();
    const backup = read('opt/foundry/lane/lane.env.pre-fb176');
    // A backup holding the value would be this script creating a sixth copy while claiming to
    // reduce them to one — in a file the scanner would then, correctly, flag.
    expect(backup, 'the backup still holds the credential').not.toContain(FAKE_PAT);
    expect(backup, 'the backup lost the configuration it exists to preserve')
      .toContain('FOUNDRY_DEPARTMENTS="build sell scale"');
    expect(statSync(at('opt/foundry/lane/lane.env.pre-fb176')).mode & 0o777).toBe(0o600);
  });

  it('writes the home file readable only by its owner', () => {
    run();
    expect(statSync(at('etc/foundry/credentials')).mode & 0o777).toBe(0o600);
  });

  it('is safe to run twice', () => {
    run();
    const first = read('etc/foundry/credentials');
    run();
    expect(read('etc/foundry/credentials'), 'a second run changed the home file').toBe(first);
  });

  it('refuses to leave an empty home file behind when there is nothing to move', () => {
    // An empty file is worse than none: systemd loads it happily and the lane fails later with
    // "could not read Username for 'https://github.com'", which says nothing about why.
    writeFileSync(at('opt/foundry/lane/lane.env'), 'FOUNDRY_DEPARTMENTS="build"\n');
    writeFileSync(at('opt/foundry/librechat/.env'), 'HOST=0.0.0.0\n');
    expect(() => run()).toThrow();
    expect(existsSync(at('etc/foundry/credentials')), 'an empty home file was left behind').toBe(false);
  });
});

describe('a key list is always one short of the box it is run on (FB-176)', () => {
  it('moves a secret whose key nobody thought to write down', () => {
    // ARCA's composer held a TAVILY_API_KEY. It was not in SECRET_KEYS, so the first real migration
    // left it behind and the scan afterwards found it — the same partial rotation this ticket exists
    // to prevent, committed by the script written to prevent it.
    const FAKE_TAVILY = `tvly-${'C'.repeat(30)}`;
    writeFileSync(at('opt/foundry/librechat/.env'),
      `HOST=0.0.0.0\nSOMETHING_NOBODY_LISTED=${FAKE_TAVILY}\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    run();

    const home = readFileSync(at('etc/foundry/credentials'), 'utf8');
    expect(home, 'a credential the list did not name was left behind').toContain(FAKE_TAVILY);
    expect(read('opt/foundry/librechat/.env')).not.toContain(FAKE_TAVILY);

    // And the scanner agrees, which is the property that matters: anything it would fail on has
    // already been moved.
    const { findings } = scanRoots([at('opt'), at('etc')], { allowed: new Set([at('etc/foundry/credentials')]) });
    expect(findings, findings.map((f) => `${f.path}:${f.line}`).join(', ')).toEqual([]);
  });

  it('leaves a setting that merely looks like a name alone', () => {
    // The value is what decides, not the key. A key called SECRET_MODE holding "off" is a setting.
    writeFileSync(at('opt/foundry/lane/lane.env'),
      `SECRET_MODE=off\nAPI_KEY_HEADER=x-api-key\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    run();
    const lane = read('opt/foundry/lane/lane.env');
    expect(lane).toContain('SECRET_MODE=off');
    expect(lane).toContain('API_KEY_HEADER=x-api-key');
  });
});
