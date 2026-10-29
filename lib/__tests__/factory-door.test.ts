import { describe, expect, it, vi } from 'vitest';
import {
  MAX_BODY_BYTES, MAX_CARD_BYTES, MAX_PICTURE_BYTES, SIGNATURE_HEADER, TIMESTAMP_HEADER, handleDoor, pngSize, signatureFor,
  type DoorAnswer, type DoorDeps,
} from '../factory-door';
import { memoryCardStore, type CardStore } from '../card-store';
import { PLAIN_PARTS } from '../review';
import type { VentureSummary } from '../ventures';
import { sentCard, testPng } from './review-fixtures';

/**
 * FB-275: the planning box's door. Every way in that is not the box, signed, now, about a repository
 * a venture lists, is refused, and nothing is kept.
 */

const SECRET = 'door-test-secret';
const NOW = Date.parse('2026-11-04T09:00:00Z');
const VENTURES = [
  { id: 'arca', name: 'ARCA', repos: ['arca', 'arca-marketing'], departments: [] },
  { id: 'the-reset', name: 'THE RESET', repos: ['thereset-platform'], departments: [] },
] as unknown as VentureSummary[];

function setUp(patch: Partial<DoorDeps> = {}) {
  const store = memoryCardStore(() => new Date(NOW));
  const logged: string[] = [];
  const deps: DoorDeps = { secret: SECRET, ventures: VENTURES, store, org: 'wealthcx01', now: () => NOW, log: (l) => logged.push(l), ...patch };
  return { deps, store: (patch.store === undefined ? store : patch.store) as CardStore, logged };
}

/** Send `body` the way the box does. `sign` changes what is signed or sent, to forge it. */
async function send(
  deps: DoorDeps,
  body: unknown,
  sign: { secret?: string; at?: number; headers?: Record<string, string>; read?: (max: number) => Promise<Uint8Array | null> } = {},
): Promise<DoorAnswer> {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const bytes = new TextEncoder().encode(text);
  const ts = String(Math.floor((sign.at ?? NOW) / 1000));
  const headers = new Map(Object.entries({
    [TIMESTAMP_HEADER]: ts,
    [SIGNATURE_HEADER]: signatureFor(sign.secret ?? SECRET, ts, bytes),
    'content-length': String(bytes.byteLength),
    ...sign.headers,
  }));
  return handleDoor(deps, { get: (n) => headers.get(n) ?? null }, sign.read ?? (async (max) => (bytes.byteLength > max ? null : bytes)));
}

const status = (a: DoorAnswer) => ('closed' in a ? 'closed' : a.status);
const card = (patch: Record<string, unknown> = {}) => ({ ...sentCard('arca', 21), sentAt: '2026-11-04T08:59:00Z', ...patch });

function png(width: number, height: number): string {
  return Buffer.from(testPng(width, height)).toString('base64');
}

describe('the signature', () => {
  it('is HMAC-SHA256 over the timestamp, a full stop and the body, as docs/factory-cards.md shows', () => {
    // The worked example in the doc. If this changes, the box's side must change with it.
    expect(signatureFor('example-secret', '1793782800', '{"kind":"heartbeat"}')).toBe(
      'sha256=33fb545d78ddc9df7b1428e21a112c6776d67017c2ba13186f8b66664d200f0a',
    );
  });
});

describe('a closed door', () => {
  it.each([[undefined], [''], ['   ']])('with the secret %j, answers as an address that does not exist, and reads nothing', async (secret) => {
    const { deps } = setUp({ secret });
    const read = vi.fn(async () => new Uint8Array());
    expect(await send(deps, card(), { read })).toEqual({ closed: true });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('a request that is not from the box is refused before its body is read', () => {
  const cases: [string, Parameters<typeof send>[2]][] = [
    ['unsigned', { headers: { [TIMESTAMP_HEADER]: '', [SIGNATURE_HEADER]: '' } }],
    ['with no timestamp', { headers: { [TIMESTAMP_HEADER]: '' } }],
    ['with a signature that is not one', { headers: { [SIGNATURE_HEADER]: 'sha256=nope' } }],
    ['signed six minutes ago', { at: NOW - 6 * 60_000 }],
    ['signed six minutes from now', { at: NOW + 6 * 60_000 }],
  ];
  it.each(cases)('%s', async (_why, sign) => {
    const { deps, store } = setUp();
    const read = vi.fn(async () => new Uint8Array());
    const a = await send(deps, card(), { ...sign, read });
    expect(status(a)).toBe(401);
    expect(read).not.toHaveBeenCalled();
    expect(await store.card('arca', 'arca', 21)).toBeNull();
  });

  it('signed with another secret: refused, nothing kept', async () => {
    const { deps, store } = setUp();
    expect(await send(deps, card(), { secret: 'not-the-secret' })).toEqual({
      status: 401, body: { ok: false, message: 'The signature does not match. Nothing was kept.' },
    });
    expect(await store.card('arca', 'arca', 21)).toBeNull();
  });

  it('a body changed after it was signed: refused', async () => {
    const { deps, store } = setUp();
    const signedText = JSON.stringify(card());
    const ts = String(NOW / 1000);
    const changed = new TextEncoder().encode(JSON.stringify(card({ title: 'Changed on the way' })));
    const headers = new Map([[TIMESTAMP_HEADER, ts], [SIGNATURE_HEADER, signatureFor(SECRET, ts, signedText)]]);
    const a = await handleDoor(deps, { get: (n) => headers.get(n) ?? null }, async () => changed);
    expect(status(a)).toBe(401);
    expect(await store.card('arca', 'arca', 21)).toBeNull();
  });

  it('a timestamp four minutes old still gets in', async () => {
    const { deps } = setUp();
    expect(status(await send(deps, card(), { at: NOW - 4 * 60_000 }))).toBe(200);
  });
});

describe('sizes', () => {
  it('a request that says it is too big is refused before it is read', async () => {
    const { deps } = setUp();
    const read = vi.fn(async () => new Uint8Array());
    expect(status(await send(deps, card(), { headers: { 'content-length': String(MAX_BODY_BYTES + 1) }, read }))).toBe(413);
    expect(read).not.toHaveBeenCalled();
  });

  it('a body that turns out too big while it is read is refused', async () => {
    const { deps } = setUp();
    expect(status(await send(deps, card(), { headers: { 'content-length': '10' }, read: async () => null }))).toBe(413);
  });

  it('a card over 64 KB is refused, signed or not', async () => {
    const { deps, store } = setUp();
    const big = card({ padding: 'x'.repeat(MAX_CARD_BYTES) });
    expect(status(await send(deps, big))).toBe(413);
    expect(await store.card('arca', 'arca', 21)).toBeNull();
  });

  it('a picture over 4 MB is refused', async () => {
    const { deps, store } = setUp();
    await send(deps, card());
    const tooBig = Buffer.alloc(MAX_PICTURE_BYTES + 1);
    Buffer.from(png(2, 2), 'base64').copy(tooBig);
    const r = await send(deps, { kind: 'screenshot', repo: 'arca', number: 21, name: 'after-phone', headSha: 'sha-arca-21', takenAt: '2026-11-04T08:59:00Z', png: tooBig.toString('base64') });
    expect(status(r)).toBe(413);
    expect(await store.picture('arca', 'arca', 21, 'after-phone')).toBeNull();
  });
});

describe('whose card it is comes from its repository, never from the box', () => {
  it('a card is kept under the venture that lists its repository', async () => {
    const { deps, store } = setUp();
    expect(await send(deps, card())).toEqual({ status: 200, body: { ok: true, message: 'Card kept.' } });
    expect((await store.card('arca', 'arca', 21))?.state).toBe('finished');
    expect(await store.card('the-reset', 'arca', 21)).toBeNull();
  });

  it("the full name in the studio's organisation is the same repository", async () => {
    const { deps, store } = setUp();
    expect(status(await send(deps, card({ repo: 'wealthcx01/arca' })))).toBe(200);
    expect(await store.card('arca', 'arca', 21)).not.toBeNull();
  });

  it.each([
    ['a repository no venture lists', { repo: 'cowgate' }],
    ['the same name in another organisation', { repo: 'someone-else/arca' }],
    ["a venture named that is not the repository's", { venture: 'the-reset' }],
    ['a venture named that does not exist', { venture: 'nobody' }],
  ])('refuses %s, and keeps nothing anywhere', async (_why, patch) => {
    const { deps, store } = setUp();
    expect(status(await send(deps, card(patch)))).toBe(422);
    for (const v of ['arca', 'the-reset', 'nobody']) expect(await store.finished(v, ['arca', 'cowgate'])).toEqual([]);
  });

  it("a venture named that is the repository's own is fine", async () => {
    const { deps } = setUp();
    expect(status(await send(deps, card({ venture: 'arca' })))).toBe(200);
  });

  it('a repository two ventures list is refused, because whose it is cannot be told', async () => {
    const twice = [...VENTURES, { id: 'copycat', name: 'Copycat', repos: ['arca'], departments: [] }] as unknown as VentureSummary[];
    const { deps } = setUp({ ventures: twice });
    expect(status(await send(deps, card()))).toBe(422);
  });
});

describe('a card', () => {
  it("keeps the plain parts by name, and everything else as John's", async () => {
    const { deps, store } = setUp();
    await send(deps, card({ budgetLeft: '$21.60', archonRun: 'run-21' }));
    const kept = (await store.card('arca', 'arca', 21))!;
    expect(Object.keys(kept.plain).sort()).toEqual([...PLAIN_PARTS].sort());
    expect(JSON.stringify(kept.plain)).not.toMatch(/budgetLeft|run-21|archon|What to do next/i);
    expect(kept.forJohn).toEqual({
      budgetLeft: '$21.60',
      archonRun: 'run-21',
      forJohn: { cost: '$2.10, of a $15 budget', nextStep: "What to do next: approve it once ARCA's founder has signed it off.", runUrl: 'https://archon.example.invalid/runs/arca-21' },
    });
  });

  it('an older version arriving late changes nothing', async () => {
    const { deps, store } = setUp();
    await send(deps, card({ title: 'Newer' }));
    expect(status(await send(deps, card({ title: 'Older', sentAt: '2026-11-04T08:00:00Z' })))).toBe(409);
    expect((await store.card('arca', 'arca', 21))?.plain.title).toBe('Newer');
  });

  it.each([
    ['a state it does not know', { state: 'merged' }],
    ['no title', { title: '' }],
    ['a sentAt in the future', { sentAt: '2026-11-05T09:00:00Z' }],
    ['checks that passed more than ran', { checks: { passed: 4, total: 3 } }],
    ['a trail line with a tone it does not know', { trail: [{ at: '2026-11-04T08:00:00Z', tone: 'shouting', text: 'x' }] }],
    ["a run link for John that is not a web address", { forJohn: { runUrl: 'javascript:alert(1)' } }],
  ])('with %s is refused', async (_why, patch) => {
    const { deps, store } = setUp();
    expect(status(await send(deps, card(patch)))).toBe(400);
    expect(await store.card('arca', 'arca', 21)).toBeNull();
  });

  it('with a preview that is not a preview address is refused', async () => {
    const { deps } = setUp();
    expect(status(await send(deps, card({ previewUrl: 'http://169.254.169.254/?a.up.railway.app' })))).toBe(422);
  });

  it('not JSON, or of a kind the door does not know, is refused', async () => {
    const { deps } = setUp();
    expect(status(await send(deps, 'not json'))).toBe(400);
    expect(status(await send(deps, { kind: 'press' }))).toBe(400);
  });

  it('a studio with nowhere to keep cards says so', async () => {
    const { deps } = setUp({ store: null });
    expect(status(await send(deps, card()))).toBe(503);
  });
});

describe('a picture', () => {
  const shot = (patch: Record<string, unknown> = {}) => ({
    kind: 'screenshot', repo: 'arca', number: 21, name: 'after-phone', headSha: 'sha-arca-21', takenAt: '2026-11-04T08:59:00Z', png: png(393, 851), ...patch,
  });

  it('is kept as bytes, with its size read from the PNG itself', async () => {
    const { deps, store } = setUp();
    await send(deps, card());
    expect(await send(deps, shot())).toEqual({ status: 200, body: { ok: true, message: 'Picture kept.' } });
    expect(Buffer.from((await store.picture('arca', 'arca', 21, 'after-phone'))!).toString('base64')).toBe(shot().png);
    expect((await store.card('arca', 'arca', 21))?.pictures).toEqual([{ name: 'after-phone', width: 393, height: 851, takenAt: '2026-11-04T08:59:00.000Z' }]);
  });

  it('that is not a PNG is refused, whatever it is called', async () => {
    const { deps, store } = setUp();
    await send(deps, card());
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(0)]).toString('base64');
    expect(status(await send(deps, shot({ png: svg })))).toBe(415);
    expect(status(await send(deps, shot({ png: jpeg })))).toBe(415);
    expect(await store.picture('arca', 'arca', 21, 'after-phone')).toBeNull();
  });

  it('of a card that is not here yet, or of another version of the work, is refused', async () => {
    const { deps, store } = setUp();
    expect(status(await send(deps, shot()))).toBe(409);
    await send(deps, card());
    expect(status(await send(deps, shot({ headSha: 'sha-something-older' })))).toBe(409);
    expect(await store.picture('arca', 'arca', 21, 'after-phone')).toBeNull();
  });

  it('with a name that is not one of the four is refused', async () => {
    const { deps } = setUp();
    await send(deps, card());
    expect(status(await send(deps, shot({ name: '../../etc/passwd' })))).toBe(400);
  });

  it("goes when a newer card is about another version of the work", async () => {
    const { deps, store } = setUp();
    await send(deps, card());
    await send(deps, shot());
    await send(deps, card({ headSha: 'sha-arca-21-again', sentAt: '2026-11-04T08:59:30Z' }));
    expect(await store.picture('arca', 'arca', 21, 'after-phone')).toBeNull();
  });
});

describe('pngSize', () => {
  it('reads the width and height from the header', () => {
    expect(pngSize(Buffer.from(png(1440, 1000), 'base64'))).toEqual({ width: 1440, height: 1000 });
  });
  it('is null for anything else', () => {
    expect(pngSize(new Uint8Array(8))).toBeNull();
    expect(pngSize(Buffer.from('GIF89a........................................'))).toBeNull();
  });
});

describe('a preview link', () => {
  it('is kept when it is a preview address, and refused otherwise', async () => {
    const { deps, store } = setUp();
    await send(deps, card({ previewUrl: null }));
    expect(status(await send(deps, { kind: 'preview', repo: 'arca', number: 21, url: 'https://arca-pr-21.up.railway.app' }))).toBe(200);
    expect((await store.card('arca', 'arca', 21))?.previewUrl).toBe('https://arca-pr-21.up.railway.app');
    for (const url of ['https://example.com', 'http://arca-pr-21.up.railway.app', 'https://localhost', 'javascript:alert(1)']) {
      expect(status(await send(deps, { kind: 'preview', repo: 'arca', number: 21, url }))).toBe(422);
    }
    expect((await store.card('arca', 'arca', 21))?.previewUrl).toBe('https://arca-pr-21.up.railway.app');
  });

  it('for a card that is not here is refused', async () => {
    const { deps } = setUp();
    expect(status(await send(deps, { kind: 'preview', repo: 'arca', number: 99, url: 'https://arca-pr-99.up.railway.app' }))).toBe(409);
  });
});

describe('a heartbeat', () => {
  it('records when the box reported, by its own signed clock', async () => {
    const { deps, store } = setUp();
    expect(await send(deps, { kind: 'heartbeat' })).toEqual({ status: 200, body: { ok: true, message: 'Heard.' } });
    expect(await store.lastBeat('planning-box')).toMatchObject({ box: 'planning-box', reportedAt: '2026-11-04T09:00:00.000Z' });
  });

  it('needs no repository, and still needs the signature', async () => {
    const { deps, store } = setUp();
    expect(status(await send(deps, { kind: 'heartbeat' }, { secret: 'wrong' }))).toBe(401);
    expect(await store.lastBeat('planning-box')).toBeNull();
  });
});

describe('what the door writes in the log', () => {
  it('never the secret, a signature or a body', async () => {
    const { deps, logged } = setUp();
    await send(deps, card());
    await send(deps, card(), { secret: 'wrong' });
    await send(deps, card({ repo: 'cowgate' }));
    const all = logged.join('\n');
    expect(all).not.toContain(SECRET);
    expect(all).not.toMatch(/sha256=|[0-9a-f]{64}/);
    expect(all).not.toMatch(/Prices in pounds|\$2\.10|archon/i);
  });
});
