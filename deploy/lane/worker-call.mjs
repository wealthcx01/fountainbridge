#!/usr/bin/env node
/**
 * How a ticket machine talks to the studio (FB-239). Runs on the temporary machine only.
 *
 *     node worker-call.mjs start  <env-file>
 *     node worker-call.mjs finish <exit> <stage> <skills> <sessions-file> <log-file>
 *
 * `start` collects this run's work — the repository, the ticket and this venture's two credentials —
 * from the studio, once, using the run's own token, and writes it to a file only root can read.
 * `finish` tells the studio how the run ended, with the last lines of the set-up log so a founder
 * reads *why* a machine failed, not only that it did.
 *
 * This replaces the SSH connection the first version used. Nothing reaches into the machine; the
 * machine asks, over HTTPS, with a token that names one venture and one run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function need(env, key) {
  const v = env[key]?.trim();
  if (!v) throw new Error(`${key} is not set on this machine`);
  return v;
}

function endpoint(env, path) {
  const base = need(env, 'FOUNDRY_STUDIO_URL').replace(/\/+$/, '');
  // https, or this machine's own loopback — which is only ever a test, since nothing real listens there.
  if (!/^https:\/\//.test(base) && !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('FOUNDRY_STUDIO_URL must be an https address');
  const run = need(env, 'FOUNDRY_RUN_ID');
  if (!/^[a-f0-9]{16}$/.test(run)) throw new Error('FOUNDRY_RUN_ID is not a run id');
  return `${base}/api/machines/${run}/${path}`;
}

/** Single-quote a value for a shell env file. A line break is refused: it could write a second variable. */
export function shellLine(key, value) {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) throw new Error(`${key} is not a variable name`);
  if (/[\r\n]/.test(String(value))) throw new Error(`${key} has a line break in it`);
  return `${key}='${String(value).replace(/'/g, `'\\''`)}'`;
}

/** Collect the work. Returns the env file's text. Throws with a plain sentence on any refusal. */
export async function collectWork(env, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(endpoint(env, 'start'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${need(env, 'FOUNDRY_RUN_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ venture: need(env, 'FOUNDRY_VENTURE') }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200 || !body?.env || typeof body.env !== 'object') {
    throw new Error(`the studio would not hand over this run's work (${res.status}: ${body?.error ?? 'no reason given'})`);
  }
  return `${Object.entries(body.env).map(([k, v]) => shellLine(k, v)).join('\n')}\n`;
}

/** Remove every credential this machine holds from a piece of text before it leaves the machine. */
export function redact(text, env) {
  let out = String(text ?? '');
  for (const [k, v] of Object.entries(env)) {
    if (/TOKEN|KEY|SECRET|PASSWORD/i.test(k) && v && v.length >= 8) out = out.split(v).join('[hidden]');
  }
  return out.replace(/x-access-token:[^@\s]+@/g, 'x-access-token:[hidden]@');
}

const tail = (text, n) => String(text ?? '').split('\n').slice(-n).join('\n');
const readOr = (path, fallback = '') => { try { return readFileSync(path, 'utf8'); } catch { return fallback; } };

/** Say how the run ended. Tries three times; a studio that cannot be reached is caught by its deadline instead. */
export async function reportFinish(env, { exit, stage, skills, sessions, log }, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const payload = {
    venture: need(env, 'FOUNDRY_VENTURE'),
    exit: Number.parseInt(exit, 10),
    stage,
    skills: skills ?? '',
    sessions: redact(String(sessions ?? '').slice(-60 * 1024), env),
    log: redact(tail(log, 30), env).slice(-2000),
  };
  if (!Number.isInteger(payload.exit)) payload.exit = 1;
  let last = '';
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetchImpl(endpoint(env, 'finish'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${need(env, 'FOUNDRY_RUN_TOKEN')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 200 || res.status === 409) return true;
      last = `status ${res.status}`;
    } catch (e) {
      last = e?.message ?? String(e);
    }
    await sleep(5000 * (i + 1));
  }
  throw new Error(`could not tell the studio how the run ended (${last})`);
}

async function main(argv, env) {
  const [cmd, ...rest] = argv;
  if (cmd === 'start') {
    writeFileSync(rest[0], await collectWork(env), { mode: 0o600 });
    return 0;
  }
  if (cmd === 'finish') {
    const [exit, stage, skills, sessionsFile, logFile] = rest;
    await reportFinish(env, { exit, stage, skills, sessions: readOr(sessionsFile), log: readOr(logFile) });
    return 0;
  }
  process.stderr.write('usage: worker-call.mjs start <env-file> | finish <exit> <stage> <skills> <sessions-file> <log-file>\n');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2), process.env).then((c) => process.exit(c), (e) => {
    process.stderr.write(`[ticket-machine] ${e?.message ?? e}\n`);
    process.exit(1);
  });
}
