import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laneFilesToSend } from '../ticket-machine.mjs';

const LANE = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('which lane files a ticket machine receives', () => {
  it('sends what runs the work and keeps what belongs to the persistent machine', () => {
    const sent = laneFilesToSend(readdirSync(LANE));
    for (const needed of ['supervisor.sh', 'foundry-lib.sh', 'skills-used.mjs', 'skills-lib.mjs', 'runreport-record.mjs', 'install-gstack.sh']) {
      expect(sent).toContain(needed);
    }
    for (const kept of ['ticket-machine.mjs', 'machine-hetzner.mjs', 'machine-lib.mjs', 'machine-ssh.mjs', 'foundry-lane.service', 'worker-run.sh']) {
      expect(sent).not.toContain(kept);
    }
  });

  it('never sends an environment file, which is where a box keeps its secrets', () => {
    expect(laneFilesToSend(['lane.env', 'brain.env', 'credentials', 'supervisor.sh'])).toEqual(['supervisor.sh']);
  });
});

describe('the switch', () => {
  const run = (env, ...args) => {
    try {
      const out = execFileSync('node', [join(LANE, 'ticket-machine.mjs'), ...args], {
        env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status, out: e.stdout };
    }
  };

  it('makes nothing and says so while temporary machines are off', () => {
    expect(run({}, 'run', 'arca-61', 'docs/tickets/arca-61.md')).toEqual({
      code: 1, out: 'Temporary machines are switched off for this venture, so nothing was made.',
    });
  });

  it('makes nothing without a provider token even when switched on', () => {
    const r = run({ TICKET_MACHINES: 'on' }, 'run', 'arca-61', 'docs/tickets/arca-61.md');
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/no Hetzner token/);
  });
});
