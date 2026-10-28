#!/usr/bin/env node
// Loads any new schema files into staging's or a preview's own database, before Railway deploys the
// studio there (FB-282). Railway runs it as the pre-deploy command, inside its own private network,
// so the database never needs a public address.
//
// What it does, in order:
//   1. Does nothing unless SCHEMA_ADMIN_URL is set. Only staging sets it (and previews, which copy
//      staging), so production, whose schema is kept by hand on Supabase, is never touched.
//   2. Refuses any database that is not on Railway's private network (lib: targetProblem).
//   3. Takes a lock, so two deploys at once cannot load the same file twice.
//   4. Loads each `db/*.sql` file it has not loaded before, in name order, each in its own
//      transaction, and records it with a hash. A file that changed after it was loaded is reported
//      and never re-run: a change to the schema is a new file.
//   5. Gives the studio's role a sign-in, if STUDIO_DB_PASSWORD is set: LOGIN, with that password.
//      The password lives only in Railway's variables, never in this repository, and is never
//      printed. Setting it on every deploy keeps the role in step if the variable changes.
//
// Any failure exits non-zero, which stops the deploy: Railway keeps the previous one running.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { RECORD_TABLE, STUDIO_ROLE, changedSinceLoaded, filesToLoad, schemaFiles, targetProblem } from './apply-schema-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = 282_282; // any fixed number: the lock only has to be the same for every deploy

const say = (m) => console.log(`[apply-schema] ${m}`);

/**
 * Load the schema into the database at `url`. Exported for the tests, which pass `allowLocal` and
 * a role name of their own (roles are shared by every database on a server).
 */
export async function applySchema({ url, password, dir = join(ROOT, 'db'), role = STUDIO_ROLE, allowLocal = false, log = say }) {
  const problem = targetProblem(url, { allowLocal });
  if (problem) throw new Error(problem);
  const local = allowLocal && ['', 'localhost', '127.0.0.1'].includes(new URL(url).hostname);
  const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK]);
    await client.query(`create table if not exists ${RECORD_TABLE} (
      name text primary key, sha256 text not null, loaded_at timestamptz not null default now())`);
    // Nobody but the owner reads the record.
    await client.query(`revoke all on ${RECORD_TABLE} from public`);

    const all = schemaFiles(readdirSync(dir));
    const hashes = Object.fromEntries(all.map((f) => [f, createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')]));
    const recordedRows = (await client.query(`select name, sha256 from ${RECORD_TABLE}`)).rows;
    const recorded = Object.fromEntries(recordedRows.map((r) => [r.name, r.sha256]));

    for (const f of changedSinceLoaded(hashes, recorded)) {
      log(`${f} has changed since it was loaded. It is not run again: put a schema change in a new file.`);
    }
    const todo = filesToLoad(all, Object.keys(recorded));
    for (const f of todo) {
      await client.query('begin');
      try {
        await client.query(readFileSync(join(dir, f), 'utf8'));
        await client.query(`insert into ${RECORD_TABLE} (name, sha256) values ($1, $2)`, [f, hashes[f]]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw new Error(`${f} failed to load, and nothing from it was kept: ${e.message}`);
      }
      log(`loaded ${f}`);
    }
    log(todo.length ? `${todo.length} new schema file(s) loaded.` : 'The schema is up to date.');

    if (password) {
      const exists = (await client.query('select 1 from pg_roles where rolname = $1', [role])).rowCount;
      if (!exists) throw new Error(`The role ${role} does not exist; db/001_read_model.sql makes it.`);
      // DDL takes no parameters, so the password is quoted by the driver, and never logged.
      await client.query(`alter role ${client.escapeIdentifier(role)} login password ${client.escapeLiteral(password)}`);
      log(`${role} can sign in, with the password in STUDIO_DB_PASSWORD.`);
    } else {
      log('STUDIO_DB_PASSWORD is not set, so the studio role\'s sign-in was left as it is.');
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK]).catch(() => {});
    await client.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const url = process.env.SCHEMA_ADMIN_URL?.trim();
  if (!url) {
    say('SCHEMA_ADMIN_URL is not set: nothing to do. (Only staging and previews set it.)');
    process.exit(0);
  }
  applySchema({ url, password: process.env.STUDIO_DB_PASSWORD?.trim() || undefined }).then(
    () => process.exit(0),
    (e) => {
      console.error(`[apply-schema] ${e.message}`);
      process.exit(1);
    },
  );
}
