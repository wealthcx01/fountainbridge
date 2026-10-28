/**
 * The rules behind the test copy (FB-272), kept apart from `scripts/test-copy.mjs` so they can be
 * tested without starting anything.
 *
 * The one rule that matters most: **a test copy only ever talks to a throwaway database on this
 * machine.** Never Supabase, never staging's database, never production's. Every database this
 * script creates, connects to or drops must pass `throwawayProblem`, which says what is wrong in a
 * sentence, or returns null when the address is safe.
 */
import { randomBytes } from 'node:crypto';

/** Every throwaway database's name starts with this, and nothing else may be dropped. */
export const PREFIX = 'fb_test_';

/** A throwaway database's whole name: the prefix, then 1 to 40 lower-case letters, digits or `_`. */
export const THROWAWAY_NAME = /^fb_test_[a-z0-9_]{1,40}$/;

/** The database role the studio is given (`db/001_read_model.sql`), as in production. */
export const STUDIO_ROLE = 'foundry_studio';

/** Hosts that are this machine. A Unix socket folder (starting with `/`) also counts. */
const LOCAL_HOSTS = new Set(['', 'localhost', '127.0.0.1', '[::1]', '::1']);

/** A new name for one run's database, e.g. `fb_test_20261028t1612_3f9a1c`. */
export function newDatabaseName(now = new Date(), random = randomBytes(3).toString('hex')) {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').toLowerCase();
  return `${PREFIX}${stamp}_${random}`;
}

/**
 * Why this address is NOT a local throwaway database, or null when it is.
 *
 * Safe means all three of:
 *   - it is a `postgres://` or `postgresql://` address;
 *   - it points at this machine: no host, `localhost`, `127.0.0.1`, `::1`, or a socket folder;
 *   - the database's name is a throwaway name (`fb_test_…`).
 *
 * Anything else is refused, including an address that cannot be read at all.
 * @param {string | undefined} url
 * @returns {string | null}
 */
export function throwawayProblem(url) {
  if (!url || !url.trim()) return 'There is no database address.';
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'The database address cannot be read.';
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return `The database address is not a Postgres address (it starts "${parsed.protocol}").`;
  }
  // `?host=` overrides the host part, as it does for libpq and for `pg`. Both must be local.
  const hostParam = parsed.searchParams.get('host');
  if (hostParam !== null && !hostParam.startsWith('/') && !LOCAL_HOSTS.has(hostParam)) {
    return `The database is on another machine (${hostParam}), not on this one.`;
  }
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    return `The database is on another machine (${parsed.hostname}), not on this one.`;
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!THROWAWAY_NAME.test(name)) {
    return `The database "${name}" is not a throwaway database. Its name must start "${PREFIX}".`;
  }
  return null;
}

/**
 * The address the studio is given: the throwaway database, through this machine's socket, signed in
 * as the person running the script, and acting as `foundry_studio` from the first statement.
 *
 * Acting as `foundry_studio` matters. The studio's isolation between ventures is row-level security
 * (FB-170), and Postgres skips it for a superuser or a table's owner. The person who made the
 * database owns its tables, so without the role the test copy would read through every policy, and
 * a test of isolation would pass when it should fail. `sslmode=disable` because a socket has no TLS.
 * @param {{ database: string, user: string, socket: string }} where
 */
export function studioDatabaseUrl({ database, user, socket }) {
  const options = `-c role=${STUDIO_ROLE}`;
  return (
    `postgresql://${encodeURIComponent(user)}@localhost/${encodeURIComponent(database)}` +
    `?host=${encodeURIComponent(socket)}&sslmode=disable&options=${encodeURIComponent(options)}`
  );
}

/**
 * What a test copy writes on its database, so a later run can tell whether it was left behind.
 * @param {{ host: string, pid: number, state: string, started: string }} owner
 */
export function ownerNote(owner) {
  return JSON.stringify({ by: 'scripts/test-copy.mjs', ...owner });
}

/**
 * Was this database left behind by a test copy that is no longer running?
 *
 * A copy can be killed without warning (the factory's runtime host ends a run that way), and then
 * it cannot drop its own database. So every start looks for those and drops them.
 *
 * Left behind means: its note says it was made on this machine, and either the process that made
 * it has gone or its state folder has. A database with no readable note is left alone, because
 * nothing says whose it is.
 * @param {string | null} note the database's comment
 * @param {{ host: string, alive: (pid: number) => boolean, exists: (path: string) => boolean }} here
 */
export function isLeftBehind(note, here) {
  if (!note) return false;
  let owner;
  try {
    owner = JSON.parse(note);
  } catch {
    return false;
  }
  if (!owner || owner.by !== 'scripts/test-copy.mjs' || owner.host !== here.host) return false;
  if (!Number.isInteger(owner.pid) || typeof owner.state !== 'string') return false;
  return !here.alive(owner.pid) || !here.exists(owner.state);
}
