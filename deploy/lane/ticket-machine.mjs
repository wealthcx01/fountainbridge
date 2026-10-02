#!/usr/bin/env node
/**
 * Work one ticket on its own temporary machine, or clear away machines past their deadline (FB-239).
 *
 *     node ticket-machine.mjs run <slug> <docs/tickets/...md>   # called by run-once.sh
 *     node ticket-machine.mjs reap                              # called by the reaper timer
 *
 * The thinking is in `machine-lib.mjs`; this is the I/O half — environment, files, the real provider
 * and the real SSH connection.
 *
 * **Off unless switched on.** It does nothing — no API call, nothing made — unless `TICKET_MACHINES=on`
 * and `HCLOUD_TOKEN` are both set in the lane's environment. Making a machine costs money, so the
 * switch belongs to a person (`docs/ticket-machines.md` says which).
 *
 * `run` prints one sentence for the founder's run report and exits:
 *   0 — the lane ran to its end on the machine (it wrote its own run report) and the machine is gone;
 *   1 — the machine never got that far, or could not be removed; run-once.sh records the sentence.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetCheck, reap, runTicketOnMachine, settingsFrom, worstCaseEur } from './machine-lib.mjs';
import { hetznerProvider } from './machine-hetzner.mjs';
import { makeRunKey, sshTransport } from './machine-ssh.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const STATE_DIR = env.STATE_DIR || '/opt/foundry/lane/state';
const log = (line) => process.stderr.write(`[ticket-machine ${new Date().toISOString()}] ${line}\n`);

/**
 * The lane files a worker needs: the scripts in the lane directory, which rules out every unit file
 * and every environment file, minus the ones that belong to the persistent machine — this launcher,
 * the provider and transport, and the worker script (sent separately, to its own place).
 */
export function laneFilesToSend(names) {
  const persistentOnly = /^(ticket-machine\.mjs|machine-.*\.mjs|worker-run\.sh)$/;
  return names.filter((n) => /\.(sh|mjs)$/.test(n) && !persistentOnly.test(n)).sort();
}

function provider() {
  return hetznerProvider({
    token: env.HCLOUD_TOKEN,
    serverType: env.TICKET_MACHINE_TYPE || 'cx33',
    location: env.TICKET_MACHINE_LOCATION || 'nbg1',
  });
}

/** Today's spend is the worst case of every machine made today, kept in one dated file. */
function spentToday(settings) {
  const file = join(STATE_DIR, `machines-${new Date().toISOString().slice(0, 10)}`);
  const count = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).length : 0;
  return { file, eur: count * worstCaseEur(settings) };
}

async function doReap() {
  const out = await reap({ provider: provider(), settings: settingsFrom(env), log });
  log(`clean-up: removed ${out.destroyed.length}, could not remove ${out.failed.length}, still within their time ${out.kept.length}`);
  return out.failed.length ? 1 : 0;
}

async function doRun(slug, ticketPath) {
  const settings = settingsFrom(env);
  const p = provider();

  // Clear anything overdue first, so the cap below counts only machines that are really working.
  await reap({ provider: p, settings, log }).catch((e) => log(`clean-up before the run failed: ${e.message}`));
  const running = (await p.list()).length;
  const spent = spentToday(settings);
  const check = budgetCheck({ running, spentTodayEur: spent.eur, settings });
  if (!check.ok) {
    process.stdout.write(check.reason);
    return 1;
  }
  // Counted before the machine is made: a run that dies after creating still cost money.
  appendFileSync(spent.file, `${slug} ${new Date().toISOString()}\n`);

  const runId = randomBytes(4).toString('hex');
  const key = makeRunKey(runId);
  try {
    const laneFiles = laneFilesToSend(readdirSync(HERE)).map((name) => ({ name, content: readFileSync(join(HERE, name), 'utf8') }));
    const out = await runTicketOnMachine({
      provider: p,
      transport: sshTransport({ keyPath: key.keyPath, dir: key.dir }),
      venture: env.LANE_ID || 'venture',
      ticket: slug.match(/^[a-z]{2,}-[0-9]+[a-z]?/i)?.[0]?.toUpperCase() || slug,
      slug,
      ticketPath,
      env, // filtered to WORKER_ENV inside machine-lib; nothing else reaches the machine
      laneFiles,
      workerScript: readFileSync(join(HERE, 'worker-run.sh'), 'utf8'),
      runId,
      publicKey: key.publicKey,
      settings,
      log,
    });
    // The worker's sessions join this machine's index, marked with where they ran, so the record of
    // which sessions belonged to which ticket (FB-231) does not lose the ones that ran elsewhere.
    if (out.sessions) {
      const lines = out.sessions.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => {
        try { return JSON.stringify({ ...JSON.parse(l), machine: out.machine }); } catch { return null; }
      }).filter(Boolean);
      if (lines.length) appendFileSync(env.SESSION_INDEX || join(STATE_DIR, 'sessions.jsonl'), `${lines.join('\n')}\n`);
    }
    if (out.skills.length) log(`${slug} followed: ${out.skills.join(', ')}`);
    process.stdout.write(out.summary);
    return out.ok && out.destroyed ? 0 : 1;
  } finally {
    key.remove();
  }
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (env.TICKET_MACHINES !== 'on') {
    process.stdout.write('Temporary machines are switched off for this venture, so nothing was made.');
    return cmd === 'reap' ? 0 : 1;
  }
  if (!env.HCLOUD_TOKEN) {
    process.stdout.write('Temporary machines are switched on but there is no Hetzner token, so nothing was made.');
    return 1;
  }
  if (cmd === 'reap') return doReap();
  if (cmd === 'run' && a && b) return doRun(a, b);
  process.stderr.write('usage: ticket-machine.mjs run <slug> <docs/tickets/...md> | reap\n');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code), (err) => {
    process.stdout.write(`Your team's temporary machine could not be run: ${err?.message ?? err}`);
    process.exit(1);
  });
}
