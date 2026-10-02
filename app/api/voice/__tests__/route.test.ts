import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
