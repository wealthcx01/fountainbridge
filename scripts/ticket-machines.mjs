#!/usr/bin/env node
/**
 * John's two commands for temporary ticket machines (FB-239). Run on a trusted machine with the
 * studio's own settings, for example through `railway run` on the studio service, so the secret
 * never touches a file:
 *
 *   node scripts/ticket-machines.mjs lane-key <venture>
 *       Prints the key that venture's lane uses to ask the studio for a machine. It goes on that
 *       venture's box only, as TICKET_MACHINE_LANE_KEY in /etc/foundry/credentials.
 *
 *   node scripts/ticket-machines.mjs reap-key
 *       Prints the key the clean-up timer presents to POST /api/machines/reap.
 *
 * There is no command to approve a monthly budget, on purpose. A budget is approved only on the
 * studio's budget page (/admin/machine-budgets), by the budget approver signed in with Google, and
 * recorded as approval.proposed then approval.granted in ActiveGraph. An earlier version of this
 * script signed a budget from the command line with whatever approver was typed; anyone who could
 * run it could approve a budget in John's name, so it was removed after review.
 *
 * The signing formulas here must match lib/ticket-machines.ts (`laneKeyFor`, `reapKeyFor`).
 * lib/__tests__/ticket-machines.test.ts checks that they do.
 */
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function laneKey(secret, ventureId) {
  return createHmac('sha256', secret).update(`machine-lane|${ventureId}`).digest('hex');
}

export function reapKey(secret) {
  return createHmac('sha256', secret).update('machine-reap').digest('hex');
}

const VENTURE = /^[a-z0-9][a-z0-9-]{0,62}$/;

async function main(argv, env) {
  const [cmd, ...rest] = argv;
  const machineSecret = env.TICKET_MACHINE_SECRET?.trim();
  if (cmd === 'lane-key' || cmd === 'reap-key') {
    if (!machineSecret || machineSecret.length < 32) {
      console.error('TICKET_MACHINE_SECRET is not set on this machine (it needs at least 32 characters).');
      return 1;
    }
    if (cmd === 'reap-key') { console.log(reapKey(machineSecret)); return 0; }
    if (!VENTURE.test(rest[0] ?? '')) { console.error('usage: lane-key <venture>'); return 2; }
    console.log(laneKey(machineSecret, rest[0]));
    return 0;
  }
  console.error('usage: ticket-machines.mjs lane-key <venture> | reap-key  (a monthly budget is approved on the studio\'s budget page, not here)');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2), process.env).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
}
