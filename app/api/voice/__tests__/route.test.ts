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
vi.mock('pg', () => {
  class Pool {
    constructor(..._args: unknown[]) { dbTouched('new Pool'); }
    on() { return this; }
    async connect() {
      dbTouched('connect');
      return { query: async (...a: unknown[]) => { dbTouched('query', a); return { rows: [] }; }, release: () => undefined };
    }
    async query(...a: unknown[]) { dbTouched('query', a); return { rows: [] }; }
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
  loadVentures.mockReturnValue([ARCA, RESET]);
  auth.mockResolvedValue({ user: { email: 'founder@bruntsfield.capital' } });
  post.mockResolvedValue(new Response(JSON.stringify({ text: 'Make the share link expire after a week.' }), { status: 200 }));
  globalThis.fetch = post as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.OPENAI_API_KEY;
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
    expect(dbTouched, 'the database was used').not.toHaveBeenCalled();
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
