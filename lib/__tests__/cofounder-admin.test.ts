import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { emptyMemory, parseMemory, renderMemory } from '../cofounder';
import { readSettings, readStop } from '../cofounder-store';
import { changeSettings, changeStop, cofounderOverview, lookNow, releaseVenture } from '../cofounder-admin';
import type { CofounderDeps, MemoryFile } from '../cofounder-service';
import type { Querier } from '../machine-store';
import type { VentureSummary } from '../ventures';

/**
 * FB-201: who may turn the cofounder's dial, press the stop, and release a venture it is holding
 * back on — against real Postgres, as the studio's own role with row-level security on.
 */
const SQL = ['001_read_model.sql', '008_cofounder.sql']
  .map((f) => readFileSync(join(process.cwd(), 'db', f), 'utf8')).join('\n');

const JOHN = 'john@bruntsfield.capital';
const ARCA_FOUNDER = 'ross@bruntsfield.capital';
const RESET_FOUNDER = 'amy@bruntsfield.capital';
const NOW = Date.parse('2026-10-01T13:00:00Z');

const VENTURES = [
  { id: 'arca', name: 'ARCA', repos: ['arca'], founderEmail: ARCA_FOUNDER, departments: [] },
  { id: 'the-reset', name: 'THE RESET', repos: ['the-reset'], founderEmail: RESET_FOUNDER, departments: [] },
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

function world() {
  const files = new Map<string, MemoryFile>();
  const notes: string[] = [];
  const deps: CofounderDeps = {
    env: { STUDIO_ADMIN_EMAILS: JOHN },
    ventures: VENTURES,
    withVenture: as,
    readMemory: async (v) => files.get(v.id) ?? { text: null },
    writeMemory: async (v, text) => { files.set(v.id, { text, sha: 'next' }); },
    readTickets: async () => [],
    readRuns: async () => [],
    noteOnTicket: async (_v, _r, id) => { notes.push(id); return { ok: true, message: '' }; },
    now: () => NOW,
  };
  return { deps, files, notes };
}

const latched = () => renderMemory({ ...emptyMemory('arca'), latch: { at: '2026-09-30T10:00:00Z', reason: 'ARCA-61 has not moved in 9 days.' } });

describe('the dial', () => {
  it('John can turn a venture on, and the record says it was him', async () => {
    const w = world();
    const r = await changeSettings(w.deps, JOHN, 'arca', { on: true, wakeEveryHours: 12 });
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/on for ARCA/) });
    const s = await as('arca', (q) => readSettings(q));
    expect(s.settings).toMatchObject({ on: true, wakeEveryHours: 12 });
    expect(s.setBy).toBe(JOHN);
  });

  it('a founder, a stranger, or nobody signed in cannot change it, even for their own venture', async () => {
    const w = world();
    for (const who of [ARCA_FOUNDER, 'someone@gmail.com', null]) {
      expect((await changeSettings(w.deps, who, 'arca', { on: true })).ok).toBe(false);
    }
    expect((await as('arca', (q) => readSettings(q))).settings.on).toBe(false);
  });

  it('a request that asks for sending is saved without it', async () => {
    const w = world();
    await changeSettings(w.deps, JOHN, 'arca', { on: true, allowSending: true, mayMerge: true, proposes: { grant: true } });
    const raw = await as('arca', (q) => q.query<{ settings: Record<string, unknown> }>('select settings from cofounder.settings'));
    expect(JSON.stringify(raw.rows[0].settings)).not.toMatch(/allowSending|mayMerge|grant/);
  });
});

describe('the studio-wide stop', () => {
  it('only Bruntsfield can press or lift it', async () => {
    const w = world();
    expect((await changeStop(w.deps, ARCA_FOUNDER, true)).ok).toBe(false);
    expect((await as('arca', (q) => readStop(q))).stopped).toBe(false);
    expect((await changeStop(w.deps, JOHN, true)).ok).toBe(true);
    expect((await as('the-reset', (q) => readStop(q))).stopped).toBe(true);
  });
});

describe('releasing a venture it is holding back on', () => {
  it('the venture’s own founder can release it, and the memory says who did', async () => {
    const w = world();
    w.files.set('arca', { text: latched(), sha: 'a' });
    const r = await releaseVenture(w.deps, ARCA_FOUNDER, 'arca');
    expect(r.ok).toBe(true);
    const m = parseMemory(w.files.get('arca')!.text, 'arca');
    expect(m?.latch).toBeNull();
    expect(m?.lastOutcome).toContain(ARCA_FOUNDER);
  });

  it('another venture’s founder cannot', async () => {
    const w = world();
    w.files.set('arca', { text: latched(), sha: 'a' });
    expect((await releaseVenture(w.deps, RESET_FOUNDER, 'arca')).ok).toBe(false);
    expect(parseMemory(w.files.get('arca')!.text, 'arca')?.latch).not.toBeNull();
  });

  it('a memory file it cannot read is left alone', async () => {
    const w = world();
    w.files.set('arca', { text: '<!-- cofounder-memory\n{ broken\n-->', sha: 'a' });
    expect((await releaseVenture(w.deps, JOHN, 'arca')).ok).toBe(false);
    expect(w.files.get('arca')!.sha).toBe('a');
  });

  it('after a release, the next wake looks again', async () => {
    const w = world();
    w.files.set('arca', { text: latched(), sha: 'a' });
    await changeSettings(w.deps, JOHN, 'arca', { on: true, quietHours: null });
    expect((await lookNow(w.deps, JOHN, 'arca')).message).toMatch(/holding back/);
    await releaseVenture(w.deps, JOHN, 'arca');
    expect((await lookNow(w.deps, JOHN, 'arca')).message).toMatch(/Nothing new on ARCA/);
  });
});

describe('look now', () => {
  it('is Bruntsfield only, and cannot get past a venture that is off', async () => {
    const w = world();
    expect((await lookNow(w.deps, ARCA_FOUNDER, 'arca')).ok).toBe(false);
    expect((await lookNow(w.deps, JOHN, 'arca')).message).toMatch(/switched off/);
  });
});

describe('the overview the page shows', () => {
  it('a venture whose memory cannot be read says so instead of vanishing', async () => {
    const w = world();
    w.files.set('arca', { text: '<!-- cofounder-memory\n{ broken\n-->', sha: 'a' });
    const deps = { ...w.deps, readMemory: async (v: VentureSummary) => { if (v.id === 'the-reset') throw new Error('GitHub said no'); return w.files.get(v.id) ?? { text: null }; } };
    const o = await cofounderOverview(deps);
    expect(o.ventures.map((v) => v.ventureId)).toEqual(['arca', 'the-reset']);
    expect(o.ventures[0].memoryError).toMatch(/could not be read/);
    expect(o.ventures[1].memoryError).toMatch(/GitHub said no/);
  });
});
