#!/usr/bin/env node
/**
 * Ask the studio to work one ticket on a temporary machine, and wait for it to finish (FB-239).
 *
 *     node ticket-machine.mjs run <slug> <docs/tickets/...md>     # called by run-once.sh
 *
 * John ruled on 2026-10-02 that **only the studio makes machines**. This box holds no provider token
 * and can make, list or remove nothing. It holds one key, `TICKET_MACHINE_LANE_KEY`, which lets it
 * ask the studio for a machine for one of this venture's own tickets, and ask how that machine is
 * getting on. The studio checks everything on its side: that the key is this venture's, that the
 * ticket is this venture's, that John approved a monthly budget, and that the month has room.
 *
 * Prints one sentence for the founder's run report and exits:
 *   0 — the lane ran to its end on the machine (the lane wrote its own run report);
 *   1 — a machine was made but the run did not reach its end (a run report is needed, and this
 *       counts as an attempt at the ticket);
 *   3 — no machine was made: switched off, refused (no budget, budget used, too many at once), or the
 *       studio could not be reached. Not an attempt and not a wake: the ticket never ran.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOT_MADE = 3;
const POLL_MS = 30_000;
const GRACE_MS = 15 * 60_000;

/** What the studio is asked for. Everything here is checked again by the studio; none of it is trusted. */
export function requestBody(env, slug, ticketPath) {
  const tunables = {};
  for (const k of ['MAX_VALIDATION_ROUNDS', 'PLAN_TIMEOUT', 'IMPL_TIMEOUT', 'REVIEW_TIMEOUT', 'QA_TIMEOUT']) {
    if (env[k]) tunables[k] = env[k];
  }
  return {
    venture: env.LANE_ID || 'arca',
    repo: env.REPO,
    baseBranch: env.BASE_BRANCH || 'main',
    ticketPath,
    slug,
    department: env.LANE_DEPARTMENT || 'build',
    gate: env.LANE_GATE || 'pr',
    requireProposal: env.LANE_REQUIRE_PROPOSAL === '1',
    stateRef: env.STATE_REF || null,
    tunables,
  };
}

/**
 * Ask, then wait. Never throws: every outcome is a code and a sentence.
 */
export async function workTicketOnMachine({
  env, slug, ticketPath, fetchImpl = globalThis.fetch, now = Date.now,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {},
}) {
  const studio = (env.FOUNDRY_STUDIO_URL || '').trim().replace(/\/+$/, '');
  const key = (env.TICKET_MACHINE_LANE_KEY || '').trim();
  if (!/^https:\/\//.test(studio) || !key) {
    return { code: NOT_MADE, summary: 'Temporary machines are switched on, but this venture has no studio address or key for them, so the ticket waits.' };
  }
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const body = requestBody(env, slug, ticketPath);

  let made;
  try {
    const res = await fetchImpl(`${studio}/api/machines`, { method: 'POST', headers, body: JSON.stringify(body) });
    made = await res.json().catch(() => ({}));
    if (res.status === 401) return { code: NOT_MADE, summary: 'The studio did not accept this venture\'s machine key, so no machine was made. Bruntsfield needs to check the key on this box.' };
    if (res.status !== 201 || !made?.created || typeof made.runId !== 'string') {
      return { code: NOT_MADE, summary: made?.reason || `The studio did not make a machine for this ticket (it answered ${res.status}).` };
    }
  } catch (e) {
    return { code: NOT_MADE, summary: `The studio could not be reached to ask for a machine, so the ticket waits. (${e?.message ?? e})` };
  }

  log(`the studio made ${made.machine} for ${slug}; waiting for it to finish`);
  const giveUpAt = Date.parse(made.expiresAt) + GRACE_MS;
  const statusUrl = `${studio}/api/machines/${made.runId}?venture=${encodeURIComponent(body.venture)}`;
  for (;;) {
    await sleep(POLL_MS);
    try {
      const res = await fetchImpl(statusUrl, { headers });
      const s = await res.json().catch(() => ({}));
      if (res.status === 200 && s.done) {
        return { code: s.ok ? 0 : 1, summary: s.summary || 'Your team\'s temporary machine finished without saying how.', sessions: s.sessions || '', skills: s.skills || [], machine: made.machine };
      }
    } catch (e) {
      log(`could not ask the studio about ${made.machine}: ${e?.message ?? e}`);
    }
    if (!(now() < giveUpAt)) {
      return { code: 1, summary: 'Your team\'s temporary machine did not report back before its deadline, and the studio could not be asked about it. The studio\'s clean-up removes the machine; the next wake will try again.', machine: made.machine };
    }
  }
}

async function main() {
  const [cmd, slug, ticketPath] = process.argv.slice(2);
  const env = process.env;
  if (cmd !== 'run' || !slug || !ticketPath) {
    process.stderr.write('usage: ticket-machine.mjs run <slug> <docs/tickets/...md>\n');
    return 2;
  }
  if (env.TICKET_MACHINES !== 'on') {
    process.stdout.write('Temporary machines are switched off for this venture, so nothing was made.');
    return NOT_MADE;
  }
  const out = await workTicketOnMachine({
    env, slug, ticketPath,
    log: (line) => process.stderr.write(`[ticket-machine ${new Date().toISOString()}] ${line}\n`),
  });
  // The worker's sessions join this box's index, marked with where they ran, so the record of which
  // sessions belonged to which ticket (FB-231) keeps the ones that ran elsewhere.
  if (out.sessions) {
    const lines = out.sessions.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => {
      try { return JSON.stringify({ ...JSON.parse(l), machine: out.machine }); } catch { return null; }
    }).filter(Boolean);
    if (lines.length) appendFileSync(env.SESSION_INDEX || join(env.STATE_DIR || '/opt/foundry/lane/state', 'sessions.jsonl'), `${lines.join('\n')}\n`);
  }
  process.stdout.write(out.summary);
  return out.code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => process.exit(code), (err) => {
    process.stdout.write(`Your team's temporary machine could not be asked for: ${err?.message ?? err}`);
    process.exit(NOT_MADE);
  });
}
