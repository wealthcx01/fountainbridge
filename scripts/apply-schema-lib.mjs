// The rules for loading the studio's schema before a deploy (FB-282), kept apart from the command
// in scripts/apply-schema.mjs so they can be tested without a database.

/** The role the studio signs in as. Row-level security binds it; the table owner would read past it. */
export const STUDIO_ROLE = 'foundry_studio';

/** The table that records which schema files this database already has. */
export const RECORD_TABLE = 'schema_files';

/**
 * Why `url` must not be loaded into, or null when it may.
 *
 * Only a database on Railway's private network (`*.railway.internal`) is allowed, which is where
 * staging's and each preview's own Postgres live. Production's database is on Supabase, so even if
 * SCHEMA_ADMIN_URL were set there by mistake, nothing would be loaded into it. `allowLocal` is for
 * the tests on the planning box only.
 */
export function targetProblem(url, { allowLocal = false } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'SCHEMA_ADMIN_URL is not a database address.';
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return 'SCHEMA_ADMIN_URL is not a Postgres address.';
  const host = u.hostname;
  if (host.endsWith('.railway.internal')) return null;
  if (allowLocal && (host === '' || host === 'localhost' || host === '127.0.0.1')) return null;
  return `The database is at ${host || 'a local socket'}, not on Railway's private network. The schema is only loaded into staging's and previews' own databases.`;
}

/** The schema files, in the order they are loaded: by name, as the test copy loads them. */
export function schemaFiles(names) {
  return names.filter((f) => f.endsWith('.sql')).sort();
}

/** The files not yet recorded as loaded, in order. */
export function filesToLoad(all, recorded) {
  const done = new Set(recorded);
  return schemaFiles(all).filter((f) => !done.has(f));
}

/** Recorded files whose contents have changed since they were loaded. They are never re-run. */
export function changedSinceLoaded(current, recorded) {
  return Object.keys(recorded)
    .filter((f) => current[f] !== undefined && current[f] !== recorded[f])
    .sort();
}
