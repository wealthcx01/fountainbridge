import 'server-only';
import type { RunReportSource } from './runreports';
import { HEARTBEAT_FILE } from './runreports';
import { withVenture, studioDatabase } from './db';

/**
 * The run-report cache: git is still the truth, the database only remembers what it already said.
 *
 * ## What this is fixing
 *
 * The desk's slowest read is `what your team did`, measured at **6,417ms** on production. The cause
 * is not the listing — FB-177 made that one parallel call per repository — it is that rendering
 * twenty rows opens `limit × READ_MARGIN` = sixty report files, and every one is an HTTP request to
 * a code host. Sixty requests at roughly a hundred milliseconds each is the six seconds, and no
 * amount of streaming moves it, because the work is real and remote.
 *
 * ## Why a cache is safe here, when a cache usually is not
 *
 * A run report is written once and never changed. The lane names it `<slug>-YYYYMMDDTHHMMSSZ.json`,
 * so a second report is a second file rather than an edit. **The rows are immutable**, which is what
 * makes this a cache rather than a second source of truth: an entry can never be stale, only absent,
 * and absent falls through to git.
 *
 * That is also why the studio is granted `insert` and not `update` or `delete` (db/004). It can fill
 * the cache and can never change or remove an entry, so the worst it can do is fail to fill it.
 *
 * ## The heartbeat is not cached, on purpose
 *
 * `_heartbeat.json` is the one file a lane overwrites in place. Caching it with `on conflict do
 * nothing` would pin the first version the studio ever saw and report a stopped machine as running —
 * the exact failure CLAUDE.md #10 exists to forbid, arriving through an optimisation. It is read
 * from git every time, which FB-164 established is one read per repository.
 *
 * ## Failing soft, deliberately
 *
 * Every database error here is swallowed into a cache miss. A studio whose cache is unreachable must
 * be **slow**, not broken: git is still there and still authoritative. The one thing this must never
 * do is take a screen down to save a second.
 */
export function cachedRunReportSource(
  ventureId: string,
  origin: RunReportSource,
  env: Record<string, string | undefined> = process.env,
): RunReportSource {
  // No database configured: hand back the origin untouched rather than a wrapper that always misses.
  if (!studioDatabase(env)) return origin;

  return {
    // Listings are NOT cached. A listing is the one thing here that changes every five minutes, and
    // a stale one hides the newest report — which is the whole point of the screen.
    list: (repo) => origin.list(repo),
    read: (repo, name) => origin.read(repo, name),

    async readMany(repo, names) {
      const cacheable = names.filter((n) => n !== HEARTBEAT_FILE);
      const found = new Map<string, unknown>();
      if (cacheable.length === 0) return found;

      try {
        const rows = await withVenture(ventureId, async (client) => {
          const r = await client.query<{ name: string; payload: unknown }>(
            'select name, payload from run_reports where repo = $1 and name = any($2::text[])',
            [repo, cacheable],
          );
          return r.rows;
        }, env);
        for (const row of rows) found.set(row.name, row.payload);
      } catch {
        // Unreachable, misconfigured, mid-migration — all the same answer: no hits, read from git.
        return found;
      }

      // Fill what was missed, from the source of truth, and remember it for next time.
      const missing = cacheable.filter((n) => !found.has(n));
      if (missing.length === 0) return found;

      const fetched: Array<{ name: string; payload: unknown }> = [];
      await Promise.all(missing.map(async (name) => {
        const payload = await origin.read(repo, name).catch(() => null);
        // Only a real record is worth keeping. `null` here means the read failed or the file is
        // gone, and writing that would cache a failure as if it were the report.
        if (payload !== null && payload !== undefined) {
          found.set(name, payload);
          fetched.push({ name, payload });
        }
      }));

      if (fetched.length > 0) await remember(ventureId, repo, fetched, env);
      return found;
    },
  };
}

/**
 * Write what git just said into the cache.
 *
 * `on conflict do nothing`, because these rows are immutable and two requests filling the same gap
 * at once is normal rather than a conflict to resolve. One statement rather than N, so a cold cache
 * costs one round trip to warm rather than sixty.
 *
 * Never throws: a cache that cannot be written is a cache miss next time, and that is all.
 */
async function remember(
  ventureId: string,
  repo: string,
  rows: ReadonlyArray<{ name: string; payload: unknown }>,
  env: Record<string, string | undefined>,
): Promise<void> {
  try {
    await withVenture(ventureId, async (client) => {
      await client.query(
        `insert into run_reports (venture_id, repo, name, written_at, payload)
         select $1, $2, n.name, ${WRITTEN_AT_FROM_NAME}, n.payload::jsonb
           from unnest($3::text[], $4::text[]) as n(name, payload)
         on conflict (venture_id, repo, name) do nothing`,
        [ventureId, repo, rows.map((r) => r.name), rows.map((r) => JSON.stringify(r.payload))],
      );
    }, env);
  } catch {
    /* the cache stays cold; the screen is unaffected */
  }
}

/**
 * The instant out of the filename, in SQL.
 *
 * The same rule as `writtenAtFromName` in lib/runreports.ts — `-YYYYMMDDTHHMMSSZ.json` — because the
 * column has to sort the way the loader does (FB-177 found the desk showing reports from five weeks
 * earlier by sorting the wrong thing). Null for a name carrying no stamp, which is the beacon and
 * anything malformed; those sort last, exactly as they do in the loader.
 */
const WRITTEN_AT_FROM_NAME = `
  case when n.name ~ '-[0-9]{8}T[0-9]{6}Z\\.json$'
    then to_timestamp(substring(n.name from '([0-9]{8}T[0-9]{6})Z\\.json$'), 'YYYYMMDD"T"HH24MISS')
         at time zone 'UTC'
    else null
  end`;
