// FB-113. `install.sh` stages the recipe onto a fresh venture box. It used to copy two files while
// `docker-compose.yml` bind-mounted six others — every MCP server plus the logo — which reached
// ARCA only by hand. A fresh box therefore came up with five healthy containers and a composer that
// could not file, deposit, search or report anything.
//
// The installer now derives the list from the compose file. That only holds if its shell extraction
// actually sees every mount, so this test runs the REAL function out of install.sh and compares it
// against a proper YAML parse. A mount written in a shape the sed misses fails here, not on a box.
//
// Companion to mcp-mounts.test.mjs: that one checks the container's view of the compose file, this
// one checks the box's.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEPLOY_DIR = resolve(HERE, '..');
const COMPOSE = join(DEPLOY_DIR, 'docker-compose.yml');
const INSTALL_SH = join(DEPLOY_DIR, 'install.sh');

const installSource = readFileSync(INSTALL_SH, 'utf8');

/** The `compose_mounts` definition lifted verbatim from install.sh, so we test the shipped one. */
function composeMountsFunction() {
  const line = installSource.match(/^compose_mounts\(\)\s*\{.*\}$/m);
  if (!line) throw new Error('install.sh no longer defines compose_mounts() on a single line');
  return line[0];
}

/** Run install.sh's own extraction against the real compose file. */
function extractedByInstaller() {
  const script = `${composeMountsFunction()}\ncompose_mounts "$1"`;
  const out = execFileSync('bash', ['-c', script, 'bash', COMPOSE], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

/** Bind-mount sources according to an actual YAML parse, across every service. */
function declaredInCompose() {
  const compose = yaml.load(readFileSync(COMPOSE, 'utf8'));
  return Object.values(compose.services ?? {})
    .flatMap((s) => s.volumes ?? [])
    .filter((v) => typeof v === 'string' && v.startsWith('./'))
    .map((v) => v.split(':')[0]);
}

describe('install.sh stages what the compose file mounts', () => {
  it('its own extraction agrees with a YAML parse', () => {
    // The failure this catches: a mount added in long form (`type: bind`) or with leading quotes,
    // which the sed silently skips — so the installer stops copying a file nobody notices is gone
    // until a founder has a composer with a missing tool.
    expect([...extractedByInstaller()].sort()).toEqual([...new Set(declaredInCompose())].sort());
  });

  it('finds a non-trivial number of mounts', () => {
    // Guards against the extraction returning nothing and every other assertion passing vacuously.
    expect(extractedByInstaller().length).toBeGreaterThan(3);
  });

  it.each(declaredInCompose())('%s exists in the repo to be staged', (rel) => {
    expect(existsSync(join(DEPLOY_DIR, rel.replace(/^\.\//, '')))).toBe(true);
  });

  it('also stages the seeder, which is not mounted', () => {
    // seed.sh runs on the host against the mongo container, so it appears in no volume list and has
    // to be named explicitly. Without it a fresh box cannot seed its own agents.
    for (const f of ['./seed.sh', './seed-agent.js']) {
      expect(installSource, `install.sh does not stage ${f}`).toContain(f);
      expect(existsSync(join(DEPLOY_DIR, f.replace(/^\.\//, '')))).toBe(true);
    }
  });

  it('refuses to continue when a source is missing', () => {
    // The whole point: loud at install time, rather than docker quietly creating an empty directory
    // at the mount target and the tool failing an hour later.
    expect(installSource).toMatch(/MISSING/);
    expect(installSource).toMatch(/refusing to continue/);
  });
});
