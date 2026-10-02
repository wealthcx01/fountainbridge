import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The voice note door (FB-173). A session is required by the middleware; this pins the second door —
 * the venture — and that every refusal happens before a recording is sent anywhere.
 */
const auth = vi.fn();
const loadVentures = vi.fn();
const post = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));

// Every place the studio could keep a recording, watched. The database: any connection or query is
// recorded. Files: every write through node's file system is recorded (and still happens).
const dbTouched = vi.fn();
// What today's count reads as. The daily cap (John, 2026-10-02) reads it before sending anything.
let usedToday: Array<{ seconds: number }> = [];
const answer = (a: unknown[]) => (String(a[0]).includes('select seconds from voicestore.usage') ? { rows: usedToday } : { rows: [] });
vi.mock('pg', () => {
  class Pool {
    constructor(..._args: unknown[]) { dbTouched('new Pool'); }
    on() { return this; }
    async connect() {
      dbTouched('connect');
      return { query: async (...a: unknown[]) => { dbTouched('query', a); return answer(a); }, release: () => undefined };
    }
    async query(...a: unknown[]) { dbTouched('query', a); return answer(a); }
  }
  return { Pool, default: { Pool } };
});
const fileWrites = vi.fn();
vi.mock('node:fs/promises', async (orig) => {
  const real = await orig<typeof import('node:fs/promises')>();
  const watch = <F extends (...a: never[]) => unknown>(name: string, f: F) =>
    ((...a: Parameters<F>) => { fileWrites(name, a[0]); return f(...a); }) as F;
  const out = { ...real, writeFile: watch('writeFile', real.writeFile), appendFile: watch('appendFile', real.appendFile), open: watch('open', real.open) };
  return { ...out, default: out };
});
vi.mock('node:fs', async (orig) => {
  const real = await orig<typeof import('node:fs')>();
  const watch = <F extends (...a: never[]) => unknown>(name: string, f: F) =>
    ((...a: Parameters<F>) => { fileWrites(name, a[0]); return f(...a); }) as F;
  const out = {
    ...real,
    writeFileSync: watch('writeFileSync', real.writeFileSync),
    appendFileSync: watch('appendFileSync', real.appendFileSync),
    createWriteStream: watch('createWriteStream', real.createWriteStream),
  };
  return { ...out, default: out };
});

const realFetch = globalThis.fetch;
const { POST } = await import('../route');

const ARCA = { id: 'arca', name: 'ARCA', repos: ['arca'], departments: [], founderEmail: 'founder@bruntsfield.capital', approvalMatrix: [] };
const RESET = { id: 'the-reset', name: 'The Reset', repos: ['the-reset'], departments: [], founderEmail: 'ross@bruntsfield.capital', approvalMatrix: [] };

function req(fields: Record<string, string | Blob>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') form.append(k, v);
    else form.append(k, v, 'voice-note.m4a');
  }
  return new Request('http://studio/api/voice', { method: 'POST', body: form });
}
const iphone = () => new Blob([new Uint8Array(4000).fill(7)], { type: 'audio/mp4' });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STUDIO_ADMIN_EMAILS;
  delete process.env.TRANSCRIBER;
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.DATABASE_URL = 'postgres://watched/nowhere';
  delete process.env.VOICE_DAILY_MINUTES;
  delete process.env.E2E_TEST_LOGIN;
  usedToday = [];
  loadVentures.mockReturnValue([ARCA, RESET]);
  auth.mockResolvedValue({ user: { email: 'founder@bruntsfield.capital' } });
  post.mockResolvedValue(new Response(JSON.stringify({ text: 'Make the share link expire after a week.' }), { status: 200 }));
  globalThis.fetch = post as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
  delete process.env.DATABASE_URL;
});

describe('who may send a voice note', () => {
  it('a founder, to their own venture: the words come back, 201', async () => {
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ text: 'Make the share link expire after a week.' });
  });

  it('not to another founder’s venture — and the recording is sent nowhere', async () => {
    const r = await POST(req({ venture: 'the-reset', audio: iphone() }));
    expect(r.status).toBe(403);
    expect(post).not.toHaveBeenCalled();
  });

  it('not without a session', async () => {
    auth.mockResolvedValue(null);
    expect((await POST(req({ venture: 'arca', audio: iphone() }))).status).toBe(403);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('what it refuses, before sending anything', () => {
  it('something that is not a recording', async () => {
    const r = await POST(req({ venture: 'arca', audio: new Blob(['<html>'], { type: 'text/html' }) }));
    expect(r.status).toBe(415);
    expect(post).not.toHaveBeenCalled();
  });

  it('an upload that says it is too big, before reading it', async () => {
    const r = new Request('http://studio/api/voice', {
      method: 'POST',
      headers: { 'content-length': String(50 * 1024 * 1024), 'content-type': 'multipart/form-data; boundary=x' },
      body: 'not read',
    });
    const formData = vi.spyOn(r, 'formData');
    expect((await POST(r)).status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('a studio with no transcriber says so, instead of pretending', async () => {
    delete process.env.OPENAI_API_KEY;
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/not switched on/);
  });
});

describe('what comes back', () => {
  it('no words is a 422 with a sentence — never an empty transcript', async () => {
    post.mockResolvedValue(new Response(JSON.stringify({ text: '' }), { status: 200 }));
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/no words/);
  });

  it('a service that is down is a 502, so the browser keeps the recording', async () => {
    post.mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await POST(req({ venture: 'arca', audio: iphone() }))).status).toBe(502);
  });
});

describe('the studio keeps nothing it was given', () => {
  // The composer tells a founder, before they speak, that the studio does not keep the recording.
  // This makes every store the studio has LIVE — a database, a document store on disk, a GitHub
  // token — and watches each one while a note goes through. The only thing allowed to leave is the
  // one call to the transcription service.
  let store: string;
  beforeEach(() => {
    store = mkdtempSync(join(tmpdir(), 'voice-store-'));
    process.env.DATABASE_URL = 'postgres://watched/nowhere';
    process.env.DOCUMENT_STORE = 'filesystem';
    process.env.DOCUMENT_STORE_DIR = store;
    process.env.GITHUB_TOKEN = 'ghp_watched';
  });
  afterEach(() => {
    rmSync(store, { recursive: true, force: true });
    for (const k of ['DATABASE_URL', 'DOCUMENT_STORE', 'DOCUMENT_STORE_DIR', 'GITHUB_TOKEN']) delete process.env[k];
  });

  const nothingKept = () => {
    expect(readdirSync(store, { recursive: true }), 'something was written to the document store').toEqual([]);
    // The database holds today's count and nothing else: every statement is the cap's own (or the
    // transaction around it), and no value passed to it is the recording or the words.
    const queries = dbTouched.mock.calls.filter((c) => c[0] === 'query').map((c) => c[1] as unknown[]);
    for (const [text, params] of queries) {
      expect(String(text), 'the database was asked something other than the daily count')
        .toMatch(/^(begin|commit|rollback|select set_config|select seconds from voicestore\.usage|insert into voicestore\.usage)/);
      for (const p of (params as unknown[]) ?? []) {
        expect(p instanceof Blob, 'a recording was passed to the database').toBe(false);
        expect(typeof p === 'string' && p.includes('share link'), 'the words were passed to the database').toBe(false);
      }
    }
    expect(fileWrites, 'a file was written').not.toHaveBeenCalled();
    const where = post.mock.calls.map((c) => String(c[0]));
    expect(where.filter((u) => !u.startsWith('https://api.openai.com/')), 'the recording was sent somewhere else').toEqual([]);
  };

  it('when the words come back', async () => {
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(201);
    expect(post).toHaveBeenCalledTimes(1);
    nothingKept();
  });

  it('when the transcription service is down', async () => {
    post.mockResolvedValue(new Response('{}', { status: 503 }));
    expect((await POST(req({ venture: 'arca', audio: iphone() }))).status).toBe(502);
    nothingKept();
  });

  it('when the recording has no words in it', async () => {
    post.mockResolvedValue(new Response(JSON.stringify({ text: '' }), { status: 200 }));
    expect((await POST(req({ venture: 'arca', audio: iphone() }))).status).toBe(422);
    nothingKept();
  });
});

describe('the daily cap (John, 2026-10-02)', () => {
  it('counts what was billed, after the words come back', async () => {
    post.mockResolvedValue(new Response(JSON.stringify({ text: 'Make the share link expire after a week.', duration: 42.2 }), { status: 200 }));
    expect((await POST(req({ venture: 'arca', audio: iphone() }))).status).toBe(201);
    const added = dbTouched.mock.calls.find((c) => c[0] === 'query' && String((c[1] as unknown[])[0]).includes('insert into voicestore.usage'));
    expect(added, 'nothing was added to today\'s count').toBeDefined();
    expect(((added![1] as unknown[])[1] as unknown[])[1]).toBe(43);
  });

  it('when today is used up, it refuses with a sentence and sends nothing', async () => {
    usedToday = [{ seconds: 30 * 60 }];
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(429);
    const body = await r.json();
    expect(body.kind).toBe('capped');
    expect(body.error).toContain('30 minutes a day');
    expect(body.error).toContain('You can still type');
    expect(post, 'the recording was sent although the day was used up').not.toHaveBeenCalled();
  });

  it('one second short of the limit still goes through', async () => {
    usedToday = [{ seconds: 30 * 60 - 1 }];
    expect((await POST(req({ venture: 'arca', audio: iphone() }))).status).toBe(201);
  });

  it('the limit is a setting', async () => {
    process.env.VOICE_DAILY_MINUTES = '5';
    usedToday = [{ seconds: 5 * 60 }];
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(429);
    expect((await r.json()).error).toContain('5 minutes a day');
  });

  it('a studio with no database has no cap, so it has no voice notes', async () => {
    delete process.env.DATABASE_URL;
    const r = await POST(req({ venture: 'arca', audio: iphone() }));
    expect(r.status).toBe(503);
    expect((await r.json()).error, 'refused for some other reason than having nowhere to keep the count').toContain('no database');
    expect(post, 'a recording was sent with no cap in place').not.toHaveBeenCalled();
  });
});
