// FB-282: the pre-deploy step that loads the schema into staging's and previews' own databases.
//
// The rules are tested without a database. The loading itself is tested against a throwaway
// database on the planning box's Postgres, and skipped (saying so) where there is none, as in CI.
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { changedSinceLoaded, filesToLoad, schemaFiles, targetProblem } from '../apply-schema-lib.mjs';
import { applySchema } from '../apply-schema.mjs';

describe('which databases the schema may be loaded into', () => {
  it("allows only Railway's private network", () => {
    expect(targetProblem('postgresql://postgres:x@postgres.railway.internal:5432/railway')).toBeNull();
  });

  it("refuses production's Supabase, a public Railway proxy, and anything that is not Postgres", () => {
    expect(targetProblem('postgresql://foundry_studio.ref:x@aws-1-eu-west-1.pooler.supabase.com:5432/postgres')).toMatch(/not on Railway's private network/);
    expect(targetProblem('postgresql://postgres:x@maglev.proxy.rlwy.net:41234/railway')).toMatch(/not on Railway's private network/);
    expect(targetProblem('mysql://x@db.railway.internal/x')).toMatch(/not a Postgres address/);
    expect(targetProblem('not an address')).toMatch(/not a database address/);
  });

  it('refuses this machine unless a test asks for it', () => {
    expect(targetProblem('postgresql:///fb_test_x?host=/var/run/postgresql')).toMatch(/local socket/);
    expect(targetProblem('postgresql:///fb_test_x?host=/var/run/postgresql', { allowLocal: true })).toBeNull();
  });
});

describe('which files are loaded', () => {
  it('loads .sql files by name, as the test copy does, and only the new ones', () => {
    const all = ['002_documents.sql', 'README.md', '001_read_model.sql', '005_push.sql', '005_crm.sql'];
    expect(schemaFiles(all)).toEqual(['001_read_model.sql', '002_documents.sql', '005_crm.sql', '005_push.sql']);
    expect(filesToLoad(all, ['001_read_model.sql', '005_crm.sql'])).toEqual(['002_documents.sql', '005_push.sql']);
  });

  it('reports a loaded file whose contents changed, and never re-runs it', () => {
    expect(changedSinceLoaded({ 'a.sql': 'new', 'b.sql': 'same' }, { 'a.sql': 'old', 'b.sql': 'same' })).toEqual(['a.sql']);
    expect(filesToLoad(['a.sql', 'b.sql'], ['a.sql', 'b.sql'])).toEqual([]);
  });
});

// The real thing, against this machine's Postgres.
const SOCKET = '/var/run/postgresql';
const tag = randomBytes(3).toString('hex');
const DB = `fb_test_schema_${tag}`;
const ROLE = `fb_test_role_${tag}`;
const url = `postgresql:///${DB}?host=${SOCKET}`;
let admin = null;

async function reachable() {
  const c = new pg.Client({ host: SOCKET, database: 'postgres' });
  try {
    await c.connect();
    return c;
  } catch {
    return null;
  }
}

describe('loading the schema into a real database', () => {
  beforeAll(async () => {
    admin = await reachable();
    if (!admin) return;
    await admin.query(`create database ${DB}`);
    await admin.query(`create role ${ROLE} nologin`);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.query(`drop database if exists ${DB}`);
    await admin.query(`drop role if exists ${ROLE}`);
    await admin.end();
  });

  it('loads every file the first time, records each, and gives the role its sign-in', async (ctx) => {
    if (!admin) return ctx.skip(); // no local Postgres here (CI): the rules above still ran
    const lines = [];
    await applySchema({ url, password: 'a-test-password-not-a-secret', role: ROLE, allowLocal: true, log: (m) => lines.push(m) });
    const files = execFileSync('ls', ['db']).toString().split('\n').filter((f) => f.endsWith('.sql'));
    const db = new pg.Client({ host: SOCKET, database: DB });
    await db.connect();
    const loaded = (await db.query('select name from schema_files order by name')).rows.map((r) => r.name);
    await db.end();
    expect(loaded).toEqual(schemaFiles(files));
    expect(lines).toContain(`${files.length} new schema file(s) loaded.`);
    const r = await admin.query('select rolcanlogin, rolpassword is not null as has_password from pg_authid where rolname = $1', [ROLE]);
    expect(r.rows[0]).toEqual({ rolcanlogin: true, has_password: true });
    expect(lines.join('\n')).not.toContain('a-test-password-not-a-secret');
  });

  it('loads nothing the second time', async (ctx) => {
    if (!admin) return ctx.skip();
    const lines = [];
    await applySchema({ url, password: 'a-test-password-not-a-secret', role: ROLE, allowLocal: true, log: (m) => lines.push(m) });
    expect(lines).toContain('The schema is up to date.');
  });

  it('refuses a role that does not exist, rather than making one', async (ctx) => {
    if (!admin) return ctx.skip();
    await expect(applySchema({ url, password: 'x', role: `${ROLE}_missing`, allowLocal: true, log: () => {} })).rejects.toThrow(/does not exist/);
  });
});
