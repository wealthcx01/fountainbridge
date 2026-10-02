import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withVenture, studioDatabase } from './db';
import { failIfFaulted } from './read-faults';
import {
  PIPELINE_READ_CAP,
  type ActivityKind,
  type CrmContact,
  type CrmDeal,
  type PipelineRead,
  type Stage,
  type Temperature,
} from './crm';

/**
 * Reading one venture's pipeline (FB-234).
 *
 * Through `withVenture`, the one way into the studio's database, so the row-level policies in
 * `db/005_crm.sql` decide what comes back — not this file. Nothing here names a venture in a WHERE
 * clause; if it did, and got it wrong, the policy would still return only the scoped venture's rows.
 *
 * Read-only. Writing a contact, a deal or a note is a separate path and is not built here.
 */

/** The one thing the read needs from a connection, so the SQL can be tested against real Postgres. */
export interface Queryable {
  query<R>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

const iso = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** A `date` column, as `YYYY-MM-DD`. `pg` hands back a local-midnight Date; PGlite a string. */
const day = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
};

/**
 * The pipeline, read through a connection that has ALREADY been scoped to one venture.
 *
 * Exported so `lib/__tests__/crm-isolation.test.ts` can run these exact statements against real
 * Postgres as the studio's own role. A copy of the SQL in a test would prove the copy.
 */
export async function readPipeline(db: Queryable): Promise<PipelineRead & { state: 'ok' }> {
  const contacts = await db.query<{
    id: string; name: string; email: string | null; title: string | null; company: string | null;
    temperature: Temperature; snoozed_until: unknown;
    last_kind: ActivityKind | null; last_summary: string | null; last_at: unknown;
    awaiting: number; waiting_summary: string | null; waiting_at: unknown;
  }>(
    `select c.id, c.name, c.email, c.title, co.name as company, c.temperature, c.snoozed_until,
            la.kind as last_kind, la.summary as last_summary, la.occurred_at as last_at,
            (select count(*) from crm_activities w
              where w.venture_id = c.venture_id and w.contact_id = c.id and w.awaiting_reply)::int as awaiting,
            wa.summary as waiting_summary, wa.occurred_at as waiting_at
       from crm_contacts c
       left join crm_companies co on co.venture_id = c.venture_id and co.id = c.company_id
       left join lateral (
         select a.kind, a.summary, a.occurred_at from crm_activities a
          where a.venture_id = c.venture_id and a.contact_id = c.id
          order by a.occurred_at desc limit 1
       ) la on true
       -- Their newest unanswered message, apart from the newest activity of any kind: the founder may
       -- have logged a note since, and that note is not what they wrote.
       left join lateral (
         select a.summary, a.occurred_at from crm_activities a
          where a.venture_id = c.venture_id and a.contact_id = c.id and a.awaiting_reply
          order by a.occurred_at desc limit 1
       ) wa on true
      order by c.updated_at desc, c.id
      limit $1`,
    [PIPELINE_READ_CAP],
  );

  const deals = await db.query<{
    id: string; title: string; contact_id: string | null; company: string | null; stage: Stage;
    value_minor: string | number | null; currency: string | null; probability: number | null;
    next_step: string | null; next_step_due: unknown; stage_changed_at: unknown;
  }>(
    `select d.id, d.title, d.contact_id, co.name as company, d.stage, d.value_minor, d.currency,
            d.probability, d.next_step, d.next_step_due, d.stage_changed_at
       from crm_deals d
       left join crm_companies co on co.venture_id = d.venture_id and co.id = d.company_id
      order by d.stage_changed_at desc, d.id
      limit $1`,
    [PIPELINE_READ_CAP],
  );

  // The true totals, read separately. Without them a venture with 1,400 deals would show 1,000 and
  // look complete — the shape of the fault FB-213 found when a code host quietly capped a listing.
  const totals = await db.query<{ contacts: number; deals: number }>(
    `select (select count(*) from crm_contacts)::int as contacts, (select count(*) from crm_deals)::int as deals`,
  );

  return {
    state: 'ok',
    contacts: contacts.rows.map((r): CrmContact => ({
      id: r.id,
      name: r.name,
      email: r.email,
      title: r.title,
      company: r.company,
      temperature: r.temperature,
      snoozedUntil: iso(r.snoozed_until),
      last: r.last_kind && r.last_summary && iso(r.last_at)
        ? { kind: r.last_kind, summary: r.last_summary, at: iso(r.last_at) as string }
        : null,
      awaitingReply: Number(r.awaiting) || 0,
      waiting: r.waiting_summary && iso(r.waiting_at)
        ? { summary: r.waiting_summary, at: iso(r.waiting_at) as string }
        : null,
    })),
    deals: deals.rows.map((r): CrmDeal => ({
      id: r.id,
      title: r.title,
      contactId: r.contact_id,
      company: r.company,
      stage: r.stage,
      // `bigint` arrives as a string from `pg`. Pence fit a double exactly up to ninety trillion
      // pounds, which is not a deal any venture here will record.
      valueMinor: r.value_minor === null ? null : Number(r.value_minor),
      currency: r.currency,
      probability: r.probability,
      nextStep: r.next_step,
      nextStepDue: day(r.next_step_due),
      stageChangedAt: iso(r.stage_changed_at) ?? '',
    })),
    totals: {
      contacts: Number(totals.rows[0]?.contacts ?? 0),
      deals: Number(totals.rows[0]?.deals ?? 0),
    },
  };
}

/**
 * The UI gate's pipeline, from a JSON file — only on the test rig.
 *
 * Gated on `E2E_TEST_LOGIN` as well as the directory, like every fixture source here: a stray
 * environment variable must never be able to swap a founder's real pipeline for a file on disk.
 */
function fixturePipeline(dir: string, ventureId: string): PipelineRead {
  let raw: string;
  try {
    raw = readFileSync(join(dir, `${ventureId}.json`), 'utf8');
  } catch {
    // No file for this venture is an empty pipeline on the rig — the honest fixture for "nobody yet".
    return { state: 'ok', contacts: [], deals: [], totals: { contacts: 0, deals: 0 } };
  }
  const j = JSON.parse(raw) as { contacts?: CrmContact[]; deals?: CrmDeal[] };
  const contacts = (j.contacts ?? []).map((c) => ({ ...c, waiting: c.waiting ?? null }));
  const deals = j.deals ?? [];
  return { state: 'ok', contacts, deals, totals: { contacts: contacts.length, deals: deals.length } };
}

/**
 * One venture's pipeline, or the reason there is not one. Never throws: the Sell screen must render
 * its own sentence about a failed read rather than take the page down with it (CLAUDE.md #10).
 */
export async function loadPipeline(
  ventureId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<PipelineRead> {
  try {
    failIfFaulted('pipeline', env as NodeJS.ProcessEnv);
  } catch (e) {
    return { state: 'unreadable', reason: (e as Error).message };
  }

  if (env.CRM_FIXTURE_DIR && env.E2E_TEST_LOGIN === '1') {
    return fixturePipeline(env.CRM_FIXTURE_DIR, ventureId);
  }
  if (!studioDatabase(env)) return { state: 'not-connected' };

  try {
    return await withVenture(ventureId, (client) => readPipeline(client as unknown as Queryable), env);
  } catch (e) {
    // Logged with the venture so whoever looks can tell which one; the founder gets a sentence.
    console.error('[crm] pipeline read failed', { venture: ventureId, message: (e as Error)?.message });
    // `42P01` is "no such table": the database is there and `db/005_crm.sql` has not been run on it.
    // That is a setup step somebody has to take, not an outage, and the sentence says which.
    if ((e as { code?: string })?.code === '42P01') {
      return { state: 'unreadable', reason: 'the pipeline has not been set up in the studio’s database yet' };
    }
    return { state: 'unreadable', reason: 'the studio’s database did not answer' };
  }
}
