import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { addSeconds, capRefusal, dailyLimitSeconds, secondsUsed, utcDay, DEFAULT_DAILY_MINUTES, type Querier } from '../voice-cap';

/**
 * The daily cap on voice notes, against real Postgres (FB-173; John, 2026-10-02).
 *
 * PGlite is PostgreSQL in-process, with the same row-level security. The connection drops to
 * `foundry_studio`, the role the studio connects as, because a superuser reads straight through every
 * policy and the isolation test would pass for the wrong reason.
 */
const SQL = ['001_read_model.sql', '006_voice_usage.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

let db: PGlite;
beforeEach(async () => {
  db = await PGlite.create();
  await db.exec(SQL);
  await db.exec('set role foundry_studio');
});

/** What `withVenture` does: one transaction, scoped to one venture. */
async function as<T>(venture: string, fn: (q: Querier) => Promise<T>): Promise<T> {
  await db.exec('begin');
  await db.query('select set_config($1, $2, true)', ['app.venture_id', venture]);
  try {
    const out = await fn(db as unknown as Querier);
    await db.exec('commit');
    return out;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

const DAY = '2026-10-02';

describe('today\'s count', () => {
  it('starts at nothing and adds up each note', async () => {
    expect(await as('arca', (q) => secondsUsed(q, DAY))).toBe(0);
    await as('arca', (q) => addSeconds(q, DAY, 83.4));
    await as('arca', (q) => addSeconds(q, DAY, 40));
    expect(await as('arca', (q) => secondsUsed(q, DAY))).toBe(84 + 40);
  });

  it('a new day starts again', async () => {
    await as('arca', (q) => addSeconds(q, DAY, 1_800));
    expect(await as('arca', (q) => secondsUsed(q, '2026-10-03'))).toBe(0);
  });

  it('one venture can never see or spend another\'s allowance', async () => {
    await as('arca', (q) => addSeconds(q, DAY, 1_800));
    expect(await as('the-reset', (q) => secondsUsed(q, DAY))).toBe(0);
    await as('the-reset', (q) => addSeconds(q, DAY, 60));
    expect(await as('arca', (q) => secondsUsed(q, DAY))).toBe(1_800);
    expect(await as('the-reset', (q) => secondsUsed(q, DAY))).toBe(60);
  });

  it('the studio cannot wipe a count — a count that can be wiped is not a limit', async () => {
    await as('arca', (q) => addSeconds(q, DAY, 1_800));
    await expect(as('arca', (q) => q.query('delete from voicestore.usage'))).rejects.toThrow(/permission denied/);
    expect(await as('arca', (q) => secondsUsed(q, DAY))).toBe(1_800);
  });
});

describe('the lock holds for the table\'s owner too', () => {
  it('row-level security is forced, not just enabled', async () => {
    // The studio's role does not own the table, so the isolation test above passes either way.
    // FORCE is what stops the OWNER reading through the policy; this checks it is set.
    await db.exec('reset role');
    const { rows } = await db.query<{ relforcerowsecurity: boolean; relrowsecurity: boolean }>(
      "select relrowsecurity, relforcerowsecurity from pg_class where oid = 'voicestore.usage'::regclass");
    expect(rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  });
});

describe('the allowance', () => {
  it('is 30 minutes a day unless set', () => {
    expect(DEFAULT_DAILY_MINUTES).toBe(30);
    expect(dailyLimitSeconds({})).toBe(1_800);
    expect(dailyLimitSeconds({ VOICE_DAILY_MINUTES: '10' })).toBe(600);
    for (const bad of ['', '0', '-3', 'lots']) expect(dailyLimitSeconds({ VOICE_DAILY_MINUTES: bad }), bad).toBe(1_800);
  });

  it('refuses at the limit, in plain words, and not a second before', () => {
    expect(capRefusal(1_799, 1_800)).toBeNull();
    const said = capRefusal(1_800, 1_800);
    expect(said).toContain('30 minutes a day');
    expect(said).toContain('midnight UTC');
    expect(said).toContain('You can still type');
  });

  it('resets at midnight UTC', () => {
    expect(utcDay(Date.parse('2026-10-02T23:59:59Z'))).toBe('2026-10-02');
    expect(utcDay(Date.parse('2026-10-03T00:00:00Z'))).toBe('2026-10-03');
  });
});
