import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { readPipeline, type Queryable } from '../crm-load';

/**
 * One venture cannot reach another's pipeline, proved at the database (FB-234).
 *
 * PGlite is PostgreSQL in-process — the same planner and the same row-level security — so these are
 * the real policies in `db/005_crm.sql`, run as `foundry_studio`, the role the studio connects as.
 * The reads go through `readPipeline`, the function the Sell screen and the Sell lane's tool call,
 * not through a copy of its SQL.
 *
 * Every person here is invented. The repository is public.
 */
const SCHEMA = ['001_read_model.sql', '005_crm.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

const ARCA_CONTACT = '11111111-1111-4111-8111-111111111111';
const RESET_CONTACT = '22222222-2222-4222-8222-222222222222';
const RESET_DEAL = '33333333-3333-4333-8333-333333333333';
const ARCA_COMPANY = 'aaaaaaaa-0000-4000-8000-000000000001';
const RESET_COMPANY = 'bbbbbbbb-0000-4000-8000-000000000001';

async function seeded() {
  const db = await PGlite.create();
  await db.exec(SCHEMA);
  // Seeded as the owner, then dropped to the studio's role. PGlite connects as a superuser, and a
  // superuser reads straight through row-level security — FB-170 found that the hard way.
  await db.exec(`
    insert into ventures (id, name) values ('arca','ARCA'), ('the-reset','The Reset');
    insert into crm_companies (venture_id, id, name) values
      ('arca', '${ARCA_COMPANY}', 'Example Card Shop'),
      ('the-reset', '${RESET_COMPANY}', 'Sample Wellness Ltd');
    insert into crm_contacts (venture_id, id, name, email, company_id, temperature) values
      ('arca', '${ARCA_CONTACT}', 'Ada Example', 'ada@example.test', '${ARCA_COMPANY}', 'hot'),
      ('the-reset', '${RESET_CONTACT}', 'Ben Placeholder', 'ben@example.test', '${RESET_COMPANY}', 'warm');
    insert into crm_deals (venture_id, id, title, contact_id, stage, value_minor, currency) values
      ('arca', '44444444-4444-4444-8444-444444444444', 'Shop pilot', '${ARCA_CONTACT}', 'proposal', 250000, 'GBP'),
      ('the-reset', '${RESET_DEAL}', 'Clinic licence', '${RESET_CONTACT}', 'meeting', 900000, 'GBP');
    insert into crm_activities (venture_id, contact_id, kind, summary, occurred_at, awaiting_reply) values
      ('arca', '${ARCA_CONTACT}', 'email_in', 'Asked when the pilot could start', '2026-09-30T09:00:00Z', true),
      ('the-reset', '${RESET_CONTACT}', 'email_in', 'Asked for the price list', '2026-09-29T09:00:00Z', true);
  `);
  await db.exec('set role foundry_studio');
  return db;
}

/** Run `fn` inside a transaction scoped to `venture`, exactly as `withVenture` does. */
async function as<T>(db: PGlite, venture: string | null, fn: (q: Queryable) => Promise<T>): Promise<T> {
  await db.exec('begin');
  try {
    if (venture) await db.query(`select set_config('app.venture_id', $1, true)`, [venture]);
    return await fn(db as unknown as Queryable);
  } finally {
    await db.exec('rollback');
  }
}

describe('a venture reads only its own pipeline, at the database', () => {
  let db: PGlite;
  beforeEach(async () => { db = await seeded(); });

  it('reads its own people, deals and what is waiting', async () => {
    const read = await as(db, 'arca', readPipeline);
    expect(read.contacts.map((c) => c.name)).toEqual(['Ada Example']);
    expect(read.contacts[0].company).toBe('Example Card Shop');
    expect(read.contacts[0].awaitingReply).toBe(1);
    expect(read.contacts[0].last?.summary).toBe('Asked when the pilot could start');
    expect(read.deals.map((d) => d.title)).toEqual(['Shop pilot']);
    expect(read.deals[0].valueMinor).toBe(250000);
    expect(read.totals).toEqual({ contacts: 1, deals: 1 });
  });

  it('the other venture reads only ITS own', async () => {
    const read = await as(db, 'the-reset', readPipeline);
    expect(read.contacts.map((c) => c.name)).toEqual(['Ben Placeholder']);
    expect(read.deals.map((d) => d.title)).toEqual(['Clinic licence']);
  });

  it('naming the other venture by hand still returns nothing', async () => {
    // The attack rather than the accident: every table, asked for the-reset by name, as ARCA.
    for (const table of ['crm_companies', 'crm_contacts', 'crm_deals', 'crm_activities']) {
      const rows = await as(db, 'arca', (q) => q.query(`select * from ${table} where venture_id = 'the-reset'`));
      expect(rows.rows, `${table} leaked the-reset's rows to arca`).toEqual([]);
    }
  });

  it('a connection that names no venture sees nothing at all', async () => {
    const read = await as(db, null, readPipeline);
    expect(read.contacts).toEqual([]);
    expect(read.deals).toEqual([]);
    expect(read.totals).toEqual({ contacts: 0, deals: 0 });
  });
});

describe('a venture cannot write into another venture’s pipeline', () => {
  let db: PGlite;
  beforeEach(async () => { db = await seeded(); });

  // One insert per table, each naming the-reset while connected as ARCA. Every one must be refused by
  // that table's own write rule. A table missing from this list is a table whose rule nobody checks.
  const crossVentureInserts: Array<[string, string]> = [
    ['crm_companies', `insert into crm_companies (venture_id, name) values ('the-reset', 'Slipped In Ltd')`],
    ['crm_contacts', `insert into crm_contacts (venture_id, name) values ('the-reset', 'Slipped In')`],
    ['crm_deals', `insert into crm_deals (venture_id, title) values ('the-reset', 'Slipped In')`],
    ['crm_activities', `insert into crm_activities (venture_id, contact_id, kind, summary, occurred_at)
      values ('the-reset', '${RESET_CONTACT}', 'note', 'Slipped in', now())`],
  ];
  for (const [table, sql] of crossVentureInserts) {
    it(`cannot add a row to the other venture’s ${table}`, async () => {
      await expect(as(db, 'arca', (q) => q.query(sql))).rejects.toThrow(/row-level security/);
    });
  }

  // Moving its OWN row across is the same crossing by another door: the update is allowed to find
  // the row, so only the write rule can stop the new venture being written onto it.
  const crossVentureMoves: Array<[string, string]> = [
    ['crm_companies', `update crm_companies set venture_id = 'the-reset' where id = '${ARCA_COMPANY}'`],
    ['crm_contacts', `update crm_contacts set venture_id = 'the-reset' where id = '${ARCA_CONTACT}'`],
    ['crm_deals', `update crm_deals set venture_id = 'the-reset' where id = '44444444-4444-4444-8444-444444444444'`],
    ['crm_activities', `update crm_activities set venture_id = 'the-reset'`],
  ];
  for (const [table, sql] of crossVentureMoves) {
    it(`cannot move its own ${table} row into the other venture`, async () => {
      await expect(as(db, 'arca', (q) => q.query(sql))).rejects.toThrow(/row-level security/);
    });
  }

  // The right venture on the row, the wrong venture's row on the link. The write rule alone would
  // allow each of these — the row IS arca's — so it is the paired foreign key that has to refuse it.
  // One case per link in the schema.
  const crossVentureLinks: Array<[string, string]> = [
    ['a person to the other venture’s company',
      `insert into crm_contacts (venture_id, name, company_id) values ('arca', 'Poached', '${RESET_COMPANY}')`],
    ['a deal to the other venture’s person',
      `insert into crm_deals (venture_id, title, contact_id) values ('arca', 'Poached', '${RESET_CONTACT}')`],
    ['a deal to the other venture’s company',
      `insert into crm_deals (venture_id, title, company_id) values ('arca', 'Poached', '${RESET_COMPANY}')`],
    ['an activity to the other venture’s person',
      `insert into crm_activities (venture_id, contact_id, kind, summary, occurred_at)
        values ('arca', '${RESET_CONTACT}', 'note', 'Poached', now())`],
    ['an activity to the other venture’s deal',
      `insert into crm_activities (venture_id, contact_id, deal_id, kind, summary, occurred_at)
        values ('arca', '${ARCA_CONTACT}', '${RESET_DEAL}', 'note', 'Poached', now())`],
  ];
  for (const [what, sql] of crossVentureLinks) {
    it(`cannot attach ${what}`, async () => {
      await expect(as(db, 'arca', (q) => q.query(sql))).rejects.toThrow(/foreign key/);
    });
  }

  it('can still write into its own pipeline, links and all', async () => {
    // Without this, every refusal above would pass against a database that refused everything.
    const ok = await as(db, 'arca', async (q) => {
      await q.query(`insert into crm_contacts (venture_id, name, company_id) values ('arca', 'New Person', '${ARCA_COMPANY}')`);
      await q.query(`insert into crm_activities (venture_id, contact_id, deal_id, kind, summary, occurred_at)
        values ('arca', '${ARCA_CONTACT}', '44444444-4444-4444-8444-444444444444', 'note', 'Called back', now())`);
      return readPipeline(q);
    });
    expect(ok.totals.contacts).toBe(2);
  });

  it('cannot change or delete the other venture’s rows', async () => {
    const changed = await as(db, 'arca', (q) => q.query(
      `update crm_deals set stage = 'lost' where id = '${RESET_DEAL}' returning id`,
    ));
    expect(changed.rows).toEqual([]);
    const removed = await as(db, 'arca', (q) => q.query(
      `delete from crm_contacts where id = '${RESET_CONTACT}' returning id`,
    ));
    expect(removed.rows).toEqual([]);
    const still = await as(db, 'the-reset', readPipeline);
    expect(still.deals[0].stage).toBe('meeting');
    expect(still.contacts).toHaveLength(1);
  });
});

describe('forgetting a person', () => {
  it('removes them and what they said, in one delete, as the studio’s own role', async () => {
    const db = await seeded();
    await db.exec('begin');
    await db.query(`select set_config('app.venture_id', 'arca', true)`);
    await db.query(`delete from crm_contacts where id = '${ARCA_CONTACT}'`);
    const left = await db.query<{ n: number }>(`select count(*)::int as n from crm_activities`);
    const deal = await db.query<{ contact_id: string | null }>(`select contact_id from crm_deals`);
    await db.exec('commit');
    expect(left.rows[0].n, 'what they said outlived them').toBe(0);
    // The deal stays — it is the venture's record of a sale — but no longer points at anyone.
    expect(deal.rows).toEqual([{ contact_id: null }]);
  });
});

describe('the policies are the kind that bind', () => {
  it('every pipeline table has row-level security enabled AND forced, with a policy', async () => {
    const db = await seeded();
    const tables = ['crm_companies', 'crm_contacts', 'crm_deals', 'crm_activities'];
    const rls = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname = any($1)`, [tables],
    );
    const policies = await db.query<{ tablename: string }>(
      `select distinct tablename from pg_policies where tablename = any($1)`, [tables],
    );
    expect(rls.rows).toHaveLength(4);
    for (const r of rls.rows) {
      expect(r.relrowsecurity, `${r.relname}: RLS not enabled`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname}: RLS not forced — the owner bypasses it`).toBe(true);
    }
    expect(policies.rows.map((p) => p.tablename).sort()).toEqual([...tables].sort());
  });
});
