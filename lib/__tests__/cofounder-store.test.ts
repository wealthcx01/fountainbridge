import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { normaliseSettings, parseMemory, type RunSeen, type TicketSeen } from '../cofounder';
import { readSettings, readStop, saveSettings, setStop } from '../cofounder-store';
import { MEMORY_PATH, wakeAll, wakeVenture, type CofounderDeps, type MemoryFile } from '../cofounder-service';
import type { Querier } from '../machine-store';
import type { VentureSummary } from '../ventures';

/**
 * FB-201 against real Postgres, as the studio's own role with row-level security on: the settings
 * the admin view keeps, the studio-wide stop, and the whole wake with stand-ins for git.
 */
const SQL = ['001_read_model.sql', '008_cofounder.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

const JOHN = 'john@bruntsfield.capital';
const DAY = 86_400_000;
const NOW = Date.parse('2026-10-01T13:00:00Z'); // 14:00 UK time
const KEY = 'k'.repeat(40);

const VENTURES = [
  { id: 'arca', name: 'ARCA', repos: ['arca'], departments: [] },
  { id: 'the-reset', name: 'THE RESET', repos: ['the-reset'], departments: [] },
] as unknown as VentureSummary[];

let db: PGlite;
async function as<T>(v: string, fn: (q: Querier) => Promise<T>): Promise<T> {
  await db.exec('begin');
  await db.query('select set_config($1, $2, true)', ['app.venture_id', v]);
  try {
    const out = await fn(db as unknown as Querier);
    await db.exec('commit');
    return out;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

beforeEach(async () => {
  db = await PGlite.create();
  await db.exec(SQL);
  await db.exec('set role foundry_studio');
});

describe('the settings the admin view keeps', () => {
  it('a venture nobody has set up gets the defaults, which are off', async () => {
    const s = await as('arca', (q) => readSettings(q));
    expect(s.settings.on).toBe(false);
    expect(s.setBy).toBeNull();
  });

  it('the newest change is the one in force, and who made it is kept', async () => {
    await as('arca', (q) => saveSettings(q, 'arca', { on: true }, JOHN, new Date(NOW)));
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, wakeEveryHours: 12 }, JOHN, new Date(NOW + 1000)));
    const s = await as('arca', (q) => readSettings(q));
    expect(s.settings).toMatchObject({ on: true, wakeEveryHours: 12 });
    expect(s.setBy).toBe(JOHN);
  });

  it('one venture cannot read or write another venture’s settings', async () => {
    await as('arca', (q) => saveSettings(q, 'arca', { on: true }, JOHN, new Date(NOW)));
    expect((await as('the-reset', (q) => readSettings(q))).settings.on).toBe(false);
    await expect(as('the-reset', (q) => saveSettings(q, 'arca', { on: false }, JOHN, new Date(NOW + 1)))).rejects.toThrow();
  });

  it('a row that asks for sending is stored without it and read back without it', async () => {
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, allowSending: true }, JOHN, new Date(NOW)));
    const raw = await as('arca', (q) => q.query<{ settings: Record<string, unknown> }>('select settings from cofounder.settings'));
    expect(raw.rows[0].settings).not.toHaveProperty('allowSending');
    // Even a row written around the studio is read through the same filter.
    await db.exec('reset role');
    await db.query("insert into cofounder.settings values ('arca', now(), 'someone', '{\"on\":true,\"mayMerge\":true}')");
    await db.exec('set role foundry_studio');
    expect(await as('arca', (q) => readSettings(q))).toMatchObject({ settings: normaliseSettings({ on: true }) });
  });

  it('the studio may not rewrite or remove the record of who changed what', async () => {
    await as('arca', (q) => saveSettings(q, 'arca', { on: true }, JOHN, new Date(NOW)));
    await expect(as('arca', (q) => q.query("update cofounder.settings set set_by = 'nobody'"))).rejects.toThrow(/permission/);
    await expect(as('arca', (q) => q.query('delete from cofounder.settings'))).rejects.toThrow(/permission/);
  });
});

describe('the studio-wide stop', () => {
  it('pressed under one venture, it reads as stopped under every venture', async () => {
    await as('arca', (q) => setStop(q, true, JOHN, new Date(NOW)));
    for (const v of ['arca', 'the-reset']) expect((await as(v, (q) => readStop(q))).stopped).toBe(true);
    await as('the-reset', (q) => setStop(q, false, JOHN, new Date(NOW + 1000)));
    expect((await as('arca', (q) => readStop(q))).stopped).toBe(false);
  });
});

/** Stand-ins for git: one memory file per venture, and a list of the notes written. */
function world(tickets: Record<string, TicketSeen[]>, runs: Record<string, RunSeen[]>) {
  const files = new Map<string, MemoryFile>();
  const notes: Array<{ venture: string; repo: string; ticketId: string; text: string }> = [];
  let now = NOW;
  let noteFails: string | null = null;
  const deps: CofounderDeps = {
    env: { COFOUNDER_WAKE_KEY: KEY },
    ventures: VENTURES,
    withVenture: as,
    readMemory: async (v) => files.get(v.id) ?? { text: null },
    writeMemory: async (v, text) => { files.set(v.id, { text, sha: `sha-${files.size}` }); },
    readTickets: async (v) => tickets[v.id] ?? [],
    readRuns: async (v) => runs[v.id] ?? [],
    noteOnTicket: async (v, repo, ticketId, text) => {
      if (noteFails) return { ok: false, message: noteFails };
      notes.push({ venture: v.id, repo, ticketId, text });
      return { ok: true, message: '' };
    },
    now: () => now,
  };
  return {
    deps, files, notes,
    at: (t: number) => { now = t; },
    failNotes: (m: string | null) => { noteFails = m; },
  };
}

const stuck = { arca: [{ repo: 'arca', id: 'ARCA-61', title: 'Price feed', group: 'in-progress', body: '' }] };
const oldRun = { arca: [{ startedAt: new Date(NOW - 9 * DAY).toISOString(), outcome: 'progress', ticketsTouched: ['ARCA-61'] }] };

describe('a whole wake', () => {
  it('switched on in the admin view, it raises the stuck ticket once, latches, and writes its memory to git', async () => {
    const w = world(stuck, oldRun);
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, quietHours: null }, JOHN, new Date(NOW - 1000)));
    const reply = await wakeAll(w.deps, `Bearer ${KEY}`);
    expect(reply.status).toBe(200);
    expect(w.notes).toEqual([expect.objectContaining({ venture: 'arca', ticketId: 'ARCA-61' })]);
    const memory = parseMemory(w.files.get('arca')!.text, 'arca');
    expect(memory?.latch?.reason).toMatch(/ARCA-61/);
    // the-reset is off: no note, no memory written.
    expect(w.files.has('the-reset')).toBe(false);

    w.at(NOW + 7 * 3_600_000);
    await wakeAll(w.deps, `Bearer ${KEY}`);
    expect(w.notes).toHaveLength(1);
  });

  it('turned off in the admin view, the next wake does nothing', async () => {
    const w = world(stuck, oldRun);
    await as('arca', (q) => saveSettings(q, 'arca', { on: false }, JOHN, new Date(NOW - 1000)));
    const r = await wakeVenture(w.deps, VENTURES[0], { force: true });
    expect(r).toMatchObject({ ran: false, sentence: expect.stringMatching(/switched off/) });
    expect(w.notes).toEqual([]);
  });

  it('the studio-wide stop stops every venture, even ones switched on', async () => {
    const w = world(stuck, oldRun);
    for (const v of VENTURES) await as(v.id, (q) => saveSettings(q, v.id, { on: true, quietHours: null }, JOHN, new Date(NOW - 1000)));
    await as('arca', (q) => setStop(q, true, JOHN, new Date(NOW - 500)));
    const reply = await wakeAll(w.deps, `Bearer ${KEY}`);
    const woke = reply.body.woke as Array<{ ran: boolean; sentence: string }>;
    expect(woke.map((x) => x.ran)).toEqual([false, false]);
    expect(woke.every((x) => /studio-wide stop/.test(x.sentence))).toBe(true);
    expect(w.notes).toEqual([]);
  });

  it('a stopped or switched-off venture costs no reads from git at all', async () => {
    const w = world(stuck, oldRun);
    let reads = 0;
    const deps = { ...w.deps, readMemory: async () => { reads += 1; return { text: null }; }, readTickets: async () => { reads += 1; return []; } };
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, quietHours: null }, JOHN, new Date(NOW - 1000)));
    await as('arca', (q) => setStop(q, true, JOHN, new Date(NOW - 500)));
    await wakeAll(deps, `Bearer ${KEY}`);
    expect(reads).toBe(0);
  });

  it('a note that could not be written does not latch, and the next wake tries again', async () => {
    const w = world(stuck, oldRun);
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, quietHours: null, wakeEveryHours: 1 }, JOHN, new Date(NOW - 1000)));
    w.failNotes('Saving conversations is not set up on the studio yet.');
    const first = await wakeVenture(w.deps, VENTURES[0]);
    expect(first.sentence).toMatch(/could not be written.*try again/);
    expect(parseMemory(w.files.get('arca')!.text, 'arca')?.latch).toBeNull();
    w.failNotes(null);
    w.at(NOW + 2 * 3_600_000);
    await wakeVenture(w.deps, VENTURES[0]);
    expect(w.notes).toHaveLength(1);
  });

  it('a memory file it cannot read stops the wake instead of starting again from nothing', async () => {
    const w = world(stuck, oldRun);
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, quietHours: null }, JOHN, new Date(NOW - 1000)));
    w.files.set('arca', { text: '# notes\n<!-- cofounder-memory\n{ broken\n-->', sha: 'x' });
    const r = await wakeVenture(w.deps, VENTURES[0]);
    expect(r.ran).toBe(false);
    expect(r.sentence).toContain(MEMORY_PATH);
    expect(w.notes).toEqual([]);
  });

  it('the timer must present the key; without it nothing wakes', async () => {
    const w = world(stuck, oldRun);
    await as('arca', (q) => saveSettings(q, 'arca', { on: true, quietHours: null }, JOHN, new Date(NOW - 1000)));
    for (const h of [null, 'Bearer wrong', `Bearer ${KEY}x`, KEY]) {
      expect((await wakeAll(w.deps, h)).status).toBe(401);
    }
    expect((await wakeAll({ ...w.deps, env: { COFOUNDER_WAKE_KEY: 'short' } }, 'Bearer short')).status).toBe(401);
    expect(w.notes).toEqual([]);
  });

  it('one venture failing does not stop the others', async () => {
    const w = world({ ...stuck, 'the-reset': [{ repo: 'the-reset', id: 'RST-4', title: 'Landing page', group: 'in-progress', body: '' }] },
      { ...oldRun, 'the-reset': [{ startedAt: new Date(NOW - 10 * DAY).toISOString(), outcome: 'progress', ticketsTouched: ['RST-4'] }] });
    for (const v of VENTURES) await as(v.id, (q) => saveSettings(q, v.id, { on: true, quietHours: null }, JOHN, new Date(NOW - 1000)));
    const deps = { ...w.deps, readTickets: async (v: VentureSummary) => { if (v.id === 'arca') throw new Error('GitHub said no'); return w.deps.readTickets(v); } };
    const reply = await wakeAll(deps, `Bearer ${KEY}`);
    const woke = reply.body.woke as Array<{ ventureId: string; ran: boolean; sentence: string }>;
    expect(woke[0]).toMatchObject({ ventureId: 'arca', ran: false, sentence: expect.stringMatching(/could not wake.*GitHub said no/) });
    expect(w.notes.map((n) => n.ticketId)).toEqual(['RST-4']);
  });
});
