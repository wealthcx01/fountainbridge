import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { loadRunReports, HEARTBEAT_FILE, type RunReportSource } from '../runreports';

/**
 * The run-report cache, against real Postgres (FB-170).
 *
 * PGlite is PostgreSQL 18 in-process, so the SQL here is the SQL that runs — including the
 * filename-to-timestamp expression, which is the part most likely to be quietly wrong and the part
 * FB-177 already got wrong once in TypeScript.
 *
 * The cache itself takes a `pg` pool, which PGlite is not, so the wiring is exercised through a
 * hand-rolled source implementing the same contract. What is tested against real Postgres is the
 * schema and the statements; what is tested against the fake is the fall-through behaviour.
 */
const SQL = ['001_read_model.sql', '004_run_reports_cache.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

// The same shape the loader's own tests use: `approvalRepos` reads `departments`, so a venture with
// none has no repositories to walk and every assertion below would pass over an empty result.
const venture = {
  id: 'arca',
  repos: ['arca'],
  departments: [{ id: 'build', repo: 'arca' }],
} as never;

const report = (ticket: string) => ({
  ticket, lane: 'build', status: 'progress', summary: `did ${ticket}`,
  started: '2026-09-09T10:00:00Z', finished: '2026-09-09T10:01:00Z',
});

describe('what the cache stores, against real Postgres', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await PGlite.create();
    await db.exec(SQL);
    await db.exec(`insert into ventures (id, name) values ('arca','ARCA')`);
    await db.exec(`set app.venture_id = 'arca'`);
  });

  it('reads the instant out of the filename, the way the loader does', async () => {
    // The column has to sort the way `writtenAtFromName` does. FB-177 is what happens when the
    // ordering is decided by something other than the timestamp: the desk showed reports from five
    // weeks earlier because the sort compared slugs.
    await db.exec(`
      insert into run_reports (venture_id, repo, name, written_at, payload)
      select 'arca', 'arca', n.name,
        case when n.name ~ '-[0-9]{8}T[0-9]{6}Z\\.json$'
          then to_timestamp(substring(n.name from '([0-9]{8}T[0-9]{6})Z\\.json$'), 'YYYYMMDD"T"HH24MISS') at time zone 'UTC'
          else null end,
        '{}'::jsonb
      from unnest(array['ARCA-61-x-20260902T164512Z.json','sign-in-fix-20260731T190348Z.json','_heartbeat.json']) as n(name)`);
    const rows = await db.query<{ name: string }>(
      'select name from run_reports order by written_at desc nulls last');
    expect(rows.rows.map((r) => r.name)).toEqual([
      'ARCA-61-x-20260902T164512Z.json',   // 2 September — newest, though its slug sorts first
      'sign-in-fix-20260731T190348Z.json', // 31 July
      '_heartbeat.json',                   // no stamp, so last
    ]);
  });

  it('the studio can fill the cache and can never change or remove an entry', async () => {
    // db/004 grants insert and withholds update and delete, so the worst a bug can do is fail to
    // fill. Asserted as a grant rather than as behaviour, because behaviour here runs as the owner.
    const g = await db.query<{ privilege_type: string }>(
      `select privilege_type from information_schema.role_table_grants
        where grantee = 'foundry_studio' and table_name = 'run_reports' order by privilege_type`);
    const held = g.rows.map((r) => r.privilege_type);
    expect(held).toContain('SELECT');
    expect(held).toContain('INSERT');
    expect(held, 'the studio can change a cached report').not.toContain('UPDATE');
    expect(held, 'the studio can delete a cached report').not.toContain('DELETE');
  });

  it('filling the same gap twice is not a conflict', async () => {
    const ins = `insert into run_reports (venture_id, repo, name, written_at, payload)
                 values ('arca','arca','a-20260909T100000Z.json', now(), '{"v":1}')
                 on conflict (venture_id, repo, name) do nothing`;
    await db.exec(ins);
    await db.exec(ins);
    expect((await db.query<{ c: number }>('select count(*)::int c from run_reports')).rows[0].c).toBe(1);
  });
});

describe('how the loader behaves when a source can read many at once', () => {
  /** A source that counts what it was asked for, so the saving is measurable rather than assumed. */
  function counting(files: Record<string, unknown>, cached: string[]) {
    const singles: string[] = [];
    const batches: number[] = [];
    const src: RunReportSource = {
      async list() { return Object.keys(files); },
      async read(_repo, name) { singles.push(name); return files[name] ?? null; },
      async readMany(_repo, names) {
        batches.push(names.length);
        return new Map(names.filter((n) => cached.includes(n)).map((n) => [n, files[n]]));
      },
    };
    return { src, singles, batches };
  }

  const files: Record<string, unknown> = {
    'a-20260909T100000Z.json': report('ARCA-1'),
    'b-20260909T090000Z.json': report('ARCA-2'),
    // `ticket: 'heartbeat'` is what makes a record the beacon — not its filename, which only decides
  // that it is always read. Getting this wrong put a third row in `reports` and is exactly the
  // confusion FB-161 hit from the other direction.
  [HEARTBEAT_FILE]: { ...report('heartbeat'), status: 'idle' },
  };

  it('asks the batch once and does not ask again for what it got', async () => {
    const { src, singles, batches } = counting(files, ['a-20260909T100000Z.json', 'b-20260909T090000Z.json']);
    const out = await loadRunReports(venture, src, 20);
    expect(out.reports).toHaveLength(2);
    expect(batches, 'one round trip for the repository').toEqual([3]);
    // Only the beacon fell through, because only the beacon was not in the batch's answer.
    expect(singles).toEqual([HEARTBEAT_FILE]);
  });

  it('a miss falls through to the single read rather than vanishing', async () => {
    // The property that makes this a cache and not a second source of truth: absent means "ask git",
    // never "there is no such report".
    const { src, singles } = counting(files, ['a-20260909T100000Z.json']);
    const out = await loadRunReports(venture, src, 20);
    expect(out.reports).toHaveLength(2);
    expect(singles).toContain('b-20260909T090000Z.json');
  });

  it('a batch that throws is a miss, not a broken screen', async () => {
    const src: RunReportSource = {
      async list() { return Object.keys(files); },
      async read(_r, name) { return files[name] ?? null; },
      async readMany() { throw new Error('the database is unreachable'); },
    };
    const out = await loadRunReports(venture, src, 20);
    expect(out.reports, 'an unreachable cache took the screen down').toHaveLength(2);
  });

  it('a source with no batch method works exactly as before', async () => {
    const src: RunReportSource = {
      async list() { return Object.keys(files); },
      async read(_r, name) { return files[name] ?? null; },
    };
    const out = await loadRunReports(venture, src, 20);
    expect(out.reports).toHaveLength(2);
    expect(out.heartbeats).toHaveLength(1);
  });
});
