#!/usr/bin/env node
/**
 * John's three commands for temporary ticket machines (FB-239). Run on a trusted machine with the
 * studio's own settings, for example through `railway run` on the studio service, so the secrets
 * never touch a file:
 *
 *   node scripts/ticket-machines.mjs approve-budget <venture> <dollars-a-month> <your-email>
 *       Records one venture's monthly budget, signed with FOUNDRY_APPROVAL_SECRET, in the studio's
 *       database (DATABASE_URL). Approving again with a new amount replaces it; 0 withdraws it.
 *       Add --dry-run to see what would be recorded without recording it.
 *
 *   node scripts/ticket-machines.mjs lane-key <venture>
 *       Prints the key that venture's lane uses to ask the studio for a machine. It goes on that
 *       venture's box only, as TICKET_MACHINE_LANE_KEY in /etc/foundry/credentials.
 *
 *   node scripts/ticket-machines.mjs reap-key
 *       Prints the key the clean-up timer presents to POST /api/machines/reap.
 *
 * The signing formulas here must match lib/approval-attestation.ts (`machineBudgetAttestationFor`)
 * and lib/ticket-machines.ts (`laneKeyFor`, `reapKeyFor`). lib/__tests__/ticket-machines.test.ts
 * checks that they do.
 */
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function budgetAttestation(ventureId, monthlyCents, approver, approvedAt, secret) {
  return createHmac('sha256', secret)
    .update(`machine-budget|${JSON.stringify([ventureId, monthlyCents, approver.trim().toLowerCase(), approvedAt])}`)
    .digest('hex');
}

export function laneKey(secret, ventureId) {
  return createHmac('sha256', secret).update(`machine-lane|${ventureId}`).digest('hex');
}

export function reapKey(secret) {
  return createHmac('sha256', secret).update('machine-reap').digest('hex');
}

const VENTURE = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The budget row to record, or an error sentence. Pure, so it can be tested. */
export function budgetRow({ venture, dollars, approver, secret, now = Date.now() }) {
  if (!VENTURE.test(venture ?? '')) return { error: `"${venture}" is not a venture id.` };
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(String(dollars ?? ''))) return { error: 'Give the monthly amount in dollars, for example 40 or 37.50.' };
  if (!/^[^@\s]+@[^@\s]+$/.test(approver ?? '')) return { error: 'Give your own email address as the approver.' };
  if (!secret) return { error: 'FOUNDRY_APPROVAL_SECRET is not set, so the budget cannot be signed.' };
  const monthlyCents = Math.round(Number(dollars) * 100);
  const approvedAt = new Date(now).toISOString();
  return {
    row: {
      venture_id: venture, monthly_cents: monthlyCents, approver: approver.trim().toLowerCase(), approved_at: approvedAt,
      attestation: budgetAttestation(venture, monthlyCents, approver, approvedAt, secret),
    },
  };
}

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
  if (cmd === 'approve-budget') {
    const dry = rest.includes('--dry-run');
    const [venture, dollars, approver] = rest.filter((a) => a !== '--dry-run');
    const out = budgetRow({ venture, dollars, approver, secret: env.FOUNDRY_APPROVAL_SECRET?.trim() });
    if (out.error) { console.error(out.error); return 2; }
    const { row } = out;
    console.log(`${venture}: $${(row.monthly_cents / 100).toFixed(2)} a month for temporary machines, approved by ${row.approver} at ${row.approved_at}.`);
    if (dry) { console.log('(dry run: nothing recorded)'); return 0; }
    if (!env.DATABASE_URL) { console.error('DATABASE_URL is not set, so nothing was recorded.'); return 1; }
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      await client.query('begin');
      await client.query('select set_config($1, $2, true)', ['app.venture_id', venture]);
      await client.query(
        'insert into machinestore.budgets (venture_id, monthly_cents, approver, approved_at, attestation) values ($1, $2, $3, $4, $5)',
        [row.venture_id, row.monthly_cents, row.approver, row.approved_at, row.attestation],
      );
      await client.query('commit');
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      await client.end();
    }
    console.log('Recorded. The studio will make machines for this venture until this month\'s spend reaches it.');
    return 0;
  }
  console.error('usage: ticket-machines.mjs approve-budget <venture> <dollars> <email> [--dry-run] | lane-key <venture> | reap-key');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2), process.env).then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
}
