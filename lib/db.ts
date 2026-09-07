import 'server-only';
import { Pool, type PoolClient } from 'pg';

/**
 * The studio's connection to its own database (FB-170's remaining half).
 *
 * FB-170 shipped the schema and proved its isolation against real Postgres. It did not ship a
 * client, so nothing in the studio had ever opened a connection. This is that, and it exists because
 * FB-174 needs somewhere durable to keep a founder's documents.
 *
 * ## Every query names its venture, and the database is what enforces it
 *
 * The schema's policies compare `venture_id` against `app.venture_id` — a per-transaction setting.
 * A query that forgets to set it sees nothing at all, which is the right way round: the failure mode
 * of forgetting is an empty result, never another venture's rows.
 *
 * So there is one way in — `withVenture` — and it is a transaction, because `set_config(..., true)`
 * is scoped to one and a pooled connection is handed to somebody else the moment it is released.
 * Setting it any other way would leak one venture's scope into the next request that borrowed the
 * connection, and it would do so intermittently, under load, which is the worst way to find out.
 */

let pool: Pool | null = null;

/** The pool, or null when this studio has no database configured. */
export function studioDatabase(env: Record<string, string | undefined> = process.env): Pool | null {
  const url = env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      // Supabase's pooler presents a certificate for the pooler host rather than the project's, and
      // Node's default verification rejects it. The connection is still TLS; what is given up is the
      // name check, on a host taken from our own environment and not from anything a user sends.
      ssl: { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // A pool that emits 'error' with nobody listening takes the process down — the same lesson the
    // custom server taught in FB-192, in a different library.
    pool.on('error', (e) => console.error('[db] idle client error', { message: e.message }));
  }
  return pool;
}

/** A venture id in the shape the manifests use. Narrow, because it names a scope. */
const VENTURE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export class NoDatabaseError extends Error {}

/**
 * Run some queries as one venture, inside a transaction that says which.
 *
 * `set_config('app.venture_id', $1, true)` rather than `SET LOCAL app.venture_id = ...`: `SET` takes
 * no parameters, so the value would have to be pasted into the statement text. A venture id is
 * checked above and could not carry an injection today — but a rule that holds because of a regex
 * somewhere else is a rule waiting to stop holding, and the parameterised form cannot be got wrong.
 */
export async function withVenture<T>(
  ventureId: string,
  fn: (client: PoolClient) => Promise<T>,
  env: Record<string, string | undefined> = process.env,
): Promise<T> {
  if (!VENTURE_ID.test(ventureId)) throw new Error(`not a venture id: ${JSON.stringify(ventureId)}`);
  const db = studioDatabase(env);
  if (!db) throw new NoDatabaseError('This studio has no database configured (DATABASE_URL).');

  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', ['app.venture_id', ventureId]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    // Rolled back rather than left open: a failed transaction that keeps its connection is a
    // connection the pool cannot reuse, and four of those is the whole pool.
    try { await client.query('rollback'); } catch { /* the connection is already gone */ }
    throw e;
  } finally {
    client.release();
  }
}
