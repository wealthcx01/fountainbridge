import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/**
 * The documents table's isolation, proven against real Postgres (FB-174).
 *
 * The same argument FB-170 makes, for the table that carries the most sensitive thing the studio
 * holds: a founder's own documents. PGlite is PostgreSQL 18 in-process — the same planner, the same
 * row-level security — so what passes here is what Postgres does, not what I believe it does.
 */
const SCHEMA = ['db/001_read_model.sql', 'db/002_documents.sql']
  .map((f) => readFileSync(join(process.cwd(), f), 'utf8')).join('\n');

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

async function seeded() {
  const db = await PGlite.create();
  await db.exec(SCHEMA);
  await db.exec(`
    insert into ventures (id, name) values ('arca','ARCA'), ('the-reset','The Reset');
    insert into documents (venture_id, checksum, filename, content_type, bytes, store, storage_key, deposited_by)
    values
      ('arca','${SHA_A}','Q4 board pack.pdf','application/pdf',900000,'supabase','arca/${SHA_A}','john@bruntsfield.capital'),
      ('the-reset','${SHA_B}','their raise deck.pdf','application/pdf',400000,'supabase','the-reset/${SHA_B}','someone@else.test');
  `);
  // Seeded as the owner, then dropped to the role the studio actually connects as. FB-170's note:
  // a SUPERUSER reads straight through row-level security with no error and no log line.
  await db.exec(`
    create role studio nologin;
    grant select, insert, update, delete on all tables in schema public to studio;
    set role studio;
  `);
  return db;
}

const scoped = async (db: PGlite, venture: string, sql: string) => {
  await db.exec(`set local app.venture_id = '${venture}'`);
  return db.query(sql);
};

describe('a venture sees only its own documents', () => {
  it('returns its own', async () => {
    const db = await seeded();
    await db.exec('begin');
    const rows = await scoped(db, 'arca', 'select filename from documents');
    expect(rows.rows).toEqual([{ filename: 'Q4 board pack.pdf' }]);
  });

  it('naming another venture’s document explicitly still returns nothing', async () => {
    const db = await seeded();
    await db.exec('begin');
    const rows = await scoped(db, 'arca', `select filename from documents where venture_id = 'the-reset'`);
    expect(rows.rows).toEqual([]);
  });

  it('a connection that names NO venture sees nothing at all', async () => {
    const db = await seeded();
    await db.exec('begin');
    const rows = await db.query('select filename from documents');
    expect(rows.rows).toEqual([]);
  });

  it('cannot count what it cannot read', async () => {
    // A count is the leak that looks harmless: "how many documents does the-reset hold" is a fact
    // about another venture.
    const db = await seeded();
    await db.exec('begin');
    const rows = await scoped(db, 'arca', 'select count(*)::int as n from documents');
    expect(rows.rows).toEqual([{ n: 1 }]);
  });
});

describe('the database refuses an address that crosses ventures', () => {
  it('will not store a row whose object sits under another venture’s prefix', async () => {
    const db = await PGlite.create();
    await db.exec(SCHEMA);
    await db.exec(`insert into ventures (id, name) values ('arca','ARCA'), ('the-reset','The Reset')`);
    // The application bug this is here to survive: the right venture on the row, the wrong prefix on
    // the object. Nothing in the studio would notice; Postgres does.
    await expect(db.exec(`
      insert into documents (venture_id, checksum, filename, content_type, bytes, store, storage_key, deposited_by)
      values ('arca','${SHA_A}','x.pdf','application/pdf',1,'supabase','the-reset/${SHA_A}','a@b.test')
    `)).rejects.toThrow(/documents_key_is_scoped/);
  });

  it('will not store an address that is not a checksum', async () => {
    const db = await PGlite.create();
    await db.exec(SCHEMA);
    await db.exec(`insert into ventures (id, name) values ('arca','ARCA')`);
    for (const bad of ['../../etc/passwd', 'Q4 board pack.pdf', 'A'.repeat(64), 'a'.repeat(63)]) {
      await expect(db.exec(`
        insert into documents (venture_id, checksum, filename, content_type, bytes, store, storage_key, deposited_by)
        values ('arca','${bad}','x.pdf','application/pdf',1,'supabase','arca/${bad}','a@b.test')
      `)).rejects.toThrow();
    }
  });

  it('will not store a document of no bytes', async () => {
    const db = await PGlite.create();
    await db.exec(SCHEMA);
    await db.exec(`insert into ventures (id, name) values ('arca','ARCA')`);
    await expect(db.exec(`
      insert into documents (venture_id, checksum, filename, content_type, bytes, store, storage_key, deposited_by)
      values ('arca','${SHA_A}','x.pdf','application/pdf',0,'supabase','arca/${SHA_A}','a@b.test')
    `)).rejects.toThrow(/documents_bytes_positive/);
  });
});

describe('handing over the same document twice', () => {
  it('is one row, updated, not two', async () => {
    const db = await PGlite.create();
    await db.exec(SCHEMA);
    await db.exec(`insert into ventures (id, name) values ('arca','ARCA')`);
    const row = (path: string) => `
      insert into documents (venture_id, checksum, filename, content_type, bytes, store, storage_key, deposited_by, context_path)
      values ('arca','${SHA_A}','deck.pdf','application/pdf',10,'supabase','arca/${SHA_A}','a@b.test','${path}')
      on conflict (venture_id, checksum) do update set context_path = excluded.context_path`;
    await db.exec(row('context/general/deck.md'));
    await db.exec(row('context/general/deck-2.md'));
    const rows = await db.query('select context_path from documents');
    expect(rows.rows).toEqual([{ context_path: 'context/general/deck-2.md' }]);
  });
});
