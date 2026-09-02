import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * The read model's isolation, proven against real Postgres (FB-170).
 *
 * PGlite is PostgreSQL 18 compiled to wasm and run in-process — the same planner, the same
 * row-level security. That matters more here than anywhere else in this repo: venture isolation is
 * non-negotiable 6, today it is physical (one VPS per venture, D1), and a shared database downgrades
 * it to logical. A test that mocked the database would be asserting my own belief about what
 * Postgres does. This asserts what Postgres does.
 */
const SCHEMA = readFileSync(join(process.cwd(), 'db/001_read_model.sql'), 'utf8');

async function seeded(extra = '') {
  const db = await PGlite.create();
  await db.exec(SCHEMA);
  await db.exec(`
    insert into ventures (id, name) values ('arca','ARCA'), ('the-reset','The Reset');
    insert into run_reports (venture_id, repo, name, written_at, payload) values
      ('arca','arca','a-20260902T160000Z.json','2026-09-02T16:00:00Z','{"ticket":"ARCA-61"}'),
      ('arca','arca-marketing','b-20260901T100000Z.json','2026-09-01T10:00:00Z','{"ticket":"ARCA-9"}'),
      ('the-reset','reset','c-20260902T170000Z.json','2026-09-02T17:00:00Z','{"ticket":"TR-1"}');
  `);
  if (extra) await db.exec(extra);
  // Seed as the owner, then drop to the role the studio actually uses. This is the whole point:
  // PGlite connects as `postgres`, and a SUPERUSER reads straight through row-level security with
  // no error and no log line — the first version of this suite passed every isolation test for that
  // reason. In production the same mistake is using Supabase's default `postgres` user, which is
  // the connection string its dashboard offers first.
  await db.exec('set role foundry_studio');
  return db;
}

describe('venture isolation, enforced by the database', () => {
  let db: PGlite;
  beforeEach(async () => { db = await seeded(); });

  it('a session scoped to one venture cannot see another’s rows', async () => {
    await db.exec(`set app.venture_id = 'arca'`);
    const rows = await db.query<{ venture_id: string }>('select venture_id from run_reports');
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.venture_id === 'arca'), 'another venture’s rows leaked').toBe(true);
  });

  it('naming another venture explicitly still returns nothing', async () => {
    // The attack, not the accident: the query asks for the other venture by name.
    await db.exec(`set app.venture_id = 'arca'`);
    const rows = await db.query(`select * from run_reports where venture_id = 'the-reset'`);
    expect(rows.rows, 'a WHERE clause defeated the policy').toHaveLength(0);
  });

  it('a connection that declares NO venture sees nothing at all', async () => {
    // Failing closed. A bug that forgets to set the scope must show an empty screen, never somebody
    // else's venture — and `current_setting(..., true)` returns NULL rather than raising, which is
    // what makes the policy evaluate to false instead of erroring.
    const rows = await db.query('select * from run_reports');
    expect(rows.rows, 'an unscoped connection read the whole table').toHaveLength(0);
  });

  it('the policy is FORCED, so the owner does not bypass it', async () => {
    // The trap this is here for: `enable row level security` alone leaves the table OWNER exempt,
    // and the owner is exactly who the studio connects as. Without `force`, every test above would
    // pass in CI as superuser and the isolation would be decorative in production.
    const forced = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relrowsecurity, relforcerowsecurity from pg_class where relname = 'run_reports'`,
    );
    expect(forced.rows[0].relrowsecurity, 'RLS is not enabled').toBe(true);
    expect(forced.rows[0].relforcerowsecurity, 'RLS is enabled but NOT forced — the owner bypasses it').toBe(true);
  });

  it('every table carrying venture data has a policy', async () => {
    // A new table added later without a policy is the way this protection quietly stops applying.
    const tables = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    );
    const policies = await db.query<{ tablename: string }>(
      `select distinct tablename from pg_policies where schemaname = 'public'`,
    );
    const withPolicy = new Set(policies.rows.map((r) => r.tablename));
    for (const { tablename } of tables.rows) {
      expect(withPolicy.has(tablename), `${tablename} has no row-level security policy`).toBe(true);
    }
  });
});

describe('the shape the desk actually asks for', () => {
  it('newest first across every surface, undateable last', async () => {
    // FB-177's ordering, now the database's job: newest by the timestamp in the FILENAME, across
    // repositories, not by the filename itself.
    const db = await seeded(`insert into run_reports (venture_id, repo, name, written_at, payload)
        values ('arca','arca','_heartbeat.json', null, '{"heartbeat":true}');`);
    await db.exec(`set app.venture_id = 'arca'`);
    const rows = await db.query<{ name: string }>(
      'select name from run_reports order by written_at desc nulls last',
    );
    expect(rows.rows.map((r) => r.name)).toEqual([
      'a-20260902T160000Z.json',
      'b-20260901T100000Z.json',
      '_heartbeat.json',
    ]);
  });

  it('re-syncing the same report twice does not duplicate it', async () => {
    // The beacon is overwritten in place on every wake; history is append-only. One upsert key has
    // to be right for both, and (venture, repo, name) is.
    // The ingest writes as its own credential, so the upsert is seeded as owner — the studio's role
    // has select only, which the test above the fold relies on.
    const db = await seeded(`
      insert into run_reports (venture_id, repo, name, written_at, payload)
        values ('arca','arca','a-20260902T160000Z.json','2026-09-02T16:00:00Z','{"ticket":"ARCA-61","v":2}')
      on conflict (venture_id, repo, name) do update set payload = excluded.payload;`);
    await db.exec(`set app.venture_id = 'arca'`);
    const rows = await db.query<{ c: number }>('select count(*)::int c from run_reports');
    expect(rows.rows[0].c).toBe(2);
  });
});
