import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VentureSummary } from './ventures';
import { approvalRepos } from './venture-repos';
import { isPreviewAddress } from './preview-check';
import { CARD_STATES, type CardKind, type CardStore, type StoredCard } from './card-store';
import { isPictureName, isPlainPart, type PlainParts, type Tone } from './review';

/**
 * The planning box's door into the studio (FB-275): cards, pictures, preview links and heartbeats.
 *
 * Only the planning box holds `FACTORY_DOOR_SECRET`, and every request must be signed with it:
 * HMAC-SHA256 over the timestamp, a full stop, and the exact bytes of the body. The format, with a
 * worked example, is in `docs/factory-cards.md`; cowgate's side follows it.
 *
 * In order, before anything is kept:
 *
 *   1. No secret set: the door is closed, and answers as an address that does not exist.
 *   2. The request says it is too big: refused before it is read.
 *   3. No timestamp, no signature, or a timestamp more than five minutes from the studio's clock:
 *      refused before the body is read.
 *   4. The body is read, up to the largest a picture may be, and the signature checked in constant
 *      time.
 *   5. Only then is it read as JSON, and each kind checked: its size, its fields, its repository.
 *
 * **The venture is never taken from the box.** It is worked out from the card's repository and the
 * manifests' `repos`. A repository no venture lists is refused, and so is a request that names a
 * venture its repository does not belong to.
 *
 * Nothing here logs the secret, a signature or a body. Each answer is a short sentence for whoever
 * reads the box's log, and none of them repeats what the card said.
 */

/** How far the timestamp may be from the studio's clock, either way. */
export const WINDOW_SECONDS = 300;
/** A card, a heartbeat or a preview link. */
export const MAX_CARD_BYTES = 64 * 1024;
/** One picture, once decoded. */
export const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
/** The largest request read at all: a 4 MB picture in base64, and room for its fields. */
export const MAX_BODY_BYTES = 6 * 1024 * 1024;

export const TIMESTAMP_HEADER = 'x-factory-timestamp';
export const SIGNATURE_HEADER = 'x-factory-signature';

/** The box's name when a heartbeat gives none. */
export const DEFAULT_BOX = 'planning-box';

/** The signature the box sends: `sha256=` and 64 hex digits, over `<timestamp>.<body>`. */
export function signatureFor(secret: string, timestamp: string, body: Uint8Array | string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex')}`;
}

export interface DoorDeps {
  /** `FACTORY_DOOR_SECRET`. Unset or empty closes the door. */
  secret: string | undefined;
  ventures: VentureSummary[];
  store: CardStore | null;
  /** The GitHub organisation a full repository name may start with (`GITHUB_ORG`). */
  org: string;
  now: () => number;
  log: (line: string) => void;
}

export interface DoorReply {
  status: number;
  body: { ok: boolean; message: string };
}

/** `closed`: answer as an address that does not exist. The route turns it into Next's own 404. */
export type DoorAnswer = { closed: true } | DoorReply;

interface Headers {
  get(name: string): string | null;
}

const say = (status: number, message: string, ok = false): DoorReply => ({ status, body: { ok, message } });

/** A card, a picture, a preview link or a heartbeat, from the box. */
export async function handleDoor(deps: DoorDeps, headers: Headers, readBody: (max: number) => Promise<Uint8Array | null>): Promise<DoorAnswer> {
  const secret = deps.secret?.trim();
  if (!secret) return { closed: true };

  const declared = Number(headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return refuse(deps, 413, 'That is too big. A picture may be 4 MB; anything else 64 KB.');

  const timestamp = headers.get(TIMESTAMP_HEADER)?.trim() ?? '';
  const signature = headers.get(SIGNATURE_HEADER)?.trim() ?? '';
  if (!/^\d{1,12}$/.test(timestamp) || !/^sha256=[0-9a-f]{64}$/.test(signature)) {
    return refuse(deps, 401, `The request is not signed. Send ${TIMESTAMP_HEADER} and ${SIGNATURE_HEADER}.`);
  }
  if (Math.abs(deps.now() / 1000 - Number(timestamp)) > WINDOW_SECONDS) {
    return refuse(deps, 401, 'The timestamp is more than five minutes from the studio\'s clock. Sign it again and resend.');
  }

  const body = await readBody(MAX_BODY_BYTES);
  if (body === null) return refuse(deps, 413, 'That is too big. A picture may be 4 MB; anything else 64 KB.');

  const expected = Buffer.from(signatureFor(secret, timestamp, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return refuse(deps, 401, 'The signature does not match. Nothing was kept.');
  }

  let message: unknown;
  try {
    message = JSON.parse(Buffer.from(body).toString('utf8'));
  } catch {
    return refuse(deps, 400, 'The body is not JSON.');
  }
  if (!isObject(message)) return refuse(deps, 400, 'The body must be a JSON object.');
  const kind = message.kind;
  if (kind !== 'screenshot' && body.byteLength > MAX_CARD_BYTES) return refuse(deps, 413, 'That is too big. Anything but a picture may be 64 KB.');
  if (kind === 'heartbeat') return heartbeat(deps, message, timestamp);
  if (kind !== 'card' && kind !== 'screenshot' && kind !== 'preview') {
    return refuse(deps, 400, '`kind` must be "card", "screenshot", "preview" or "heartbeat".');
  }

  const where = whose(deps, message);
  if (!where.ok) return refuse(deps, where.status, where.message);
  if (!deps.store) return refuse(deps, 503, 'This studio has nowhere to keep cards yet (it has no database). Nothing was kept.');

  try {
    if (kind === 'card') return await card(deps, deps.store, where.ventureId, where.repo, message);
    if (kind === 'screenshot') return await screenshot(deps, deps.store, where.ventureId, where.repo, where.number, message);
    return await preview(deps, deps.store, where.ventureId, where.repo, where.number, message);
  } catch (e) {
    deps.log(`${kind} for ${where.repo}#${where.number} could not be kept: ${(e as Error)?.message ?? 'unknown fault'}`);
    return say(500, 'The studio could not keep this just now. Try again in a minute.');
  }
}

function refuse(deps: DoorDeps, status: number, message: string): DoorReply {
  deps.log(`refused (${status}): ${message}`);
  return say(status, message);
}

/**
 * Which venture a request is for, from its repository and nothing else.
 *
 * The repository may be the manifests' own name (`arca`) or the full one in this studio's GitHub
 * organisation (`wealthcx01/arca`). A venture named in the body is only ever checked against it.
 */
export function whose(
  deps: Pick<DoorDeps, 'ventures' | 'org'>,
  m: Record<string, unknown>,
): { ok: true; ventureId: string; repo: string; number: number } | { ok: false; status: number; message: string } {
  if (typeof m.repo !== 'string' || !m.repo.trim()) return { ok: false, status: 400, message: '`repo` is missing.' };
  if (!Number.isInteger(m.number) || (m.number as number) <= 0 || (m.number as number) > 2_000_000_000) {
    return { ok: false, status: 400, message: '`number` must be the pull request\'s number.' };
  }
  const named = m.repo.trim();
  const [owner, name] = named.includes('/') ? named.split('/', 2) : [null, named];
  const repo = owner === null || owner.toLowerCase() === deps.org.toLowerCase() ? name : null;
  const owners = repo ? deps.ventures.filter((v) => approvalRepos(v).includes(repo)) : [];
  if (!repo || owners.length === 0) return { ok: false, status: 422, message: 'No venture lists that repository. Nothing was kept.' };
  if (owners.length > 1) return { ok: false, status: 422, message: 'More than one venture lists that repository, so the studio cannot tell whose it is. Nothing was kept.' };
  if (m.venture !== undefined && m.venture !== owners[0].id) {
    return { ok: false, status: 422, message: 'The venture named does not match the repository\'s. Nothing was kept.' };
  }
  return { ok: true, ventureId: owners[0].id, repo, number: m.number as number };
}

async function heartbeat(deps: DoorDeps, m: Record<string, unknown>, timestamp: string): Promise<DoorReply> {
  const box = m.box === undefined ? DEFAULT_BOX : m.box;
  if (typeof box !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(box)) {
    return refuse(deps, 400, '`box` must be a short name in lower-case letters, digits and dashes.');
  }
  if (!deps.store) return refuse(deps, 503, 'This studio has nowhere to keep a heartbeat yet (it has no database).');
  try {
    await deps.store.beat(box, new Date(Number(timestamp) * 1000).toISOString());
  } catch (e) {
    deps.log(`heartbeat could not be kept: ${(e as Error)?.message ?? 'unknown fault'}`);
    return say(500, 'The studio could not keep this just now. Try again in a minute.');
  }
  return say(200, 'Heard.', true);
}

/** The parts of a card that say where it is from and where it stands. Neither plain nor John's. */
const ENVELOPE = new Set(['kind', 'venture', 'repo', 'number', 'runId', 'state', 'sentAt', 'previewUrl']);

async function card(deps: DoorDeps, store: CardStore, ventureId: string, repo: string, m: Record<string, unknown>): Promise<DoorReply> {
  const read = readCard(m, deps.now());
  if (!read.ok) return refuse(deps, 400, read.message);
  if (read.previewUrl !== null && !isPreviewAddress(read.previewUrl)) {
    return refuse(deps, 422, '`previewUrl` is not a preview address the studio can check. Nothing was kept.');
  }
  const kept = await store.putCard(ventureId, {
    repo,
    number: m.number as number,
    runId: read.runId,
    state: read.state,
    sentAt: read.sentAt,
    headSha: read.plain.headSha,
    previewUrl: read.previewUrl,
    plain: read.plain,
    forJohn: read.forJohn,
  });
  deps.log(`card ${repo}#${m.number} ${kept}`);
  return kept === 'stored'
    ? say(200, 'Card kept.', true)
    : say(409, 'A newer version of this card is already here, so this one was not kept.');
}

/**
 * A card's fields, checked. The plain parts are the names in `PLAIN_PARTS` (lib/review.ts) and
 * nothing else. Every other field the card carries is kept as John's, whatever it is called.
 */
export function readCard(m: Record<string, unknown>, now: number):
  | { ok: true; state: CardKind; sentAt: string; runId: string | null; previewUrl: string | null; plain: PlainParts; forJohn: Record<string, unknown> }
  | { ok: false; message: string } {
  try {
    if (!(CARD_STATES as readonly unknown[]).includes(m.state)) throw new Error(`\`state\` must be one of: ${CARD_STATES.join(', ')}.`);
    const sentAt = when(m.sentAt, 'sentAt');
    if (Date.parse(sentAt) > now + WINDOW_SECONDS * 1000) throw new Error('`sentAt` is in the future.');
    const runId = m.runId === undefined || m.runId === null ? null : text(m.runId, 'runId', 100);
    const previewUrl = m.previewUrl === undefined || m.previewUrl === null ? null : text(m.previewUrl, 'previewUrl', 500);

    const title = text(m.title, 'title', 300);
    if (!title.trim()) throw new Error('`title` is missing.');
    const headSha = m.headSha === undefined ? '' : text(m.headSha, 'headSha', 100);
    if (!/^[A-Za-z0-9._-]*$/.test(headSha)) throw new Error('`headSha` must be a commit id.');
    const checks = m.checks === undefined ? { passed: 0, total: 0 } : m.checks;
    if (!isObject(checks) || !count(checks.passed) || !count(checks.total) || (checks.passed as number) > (checks.total as number)) {
      throw new Error('`checks` must be { "passed": n, "total": n }, with passed no more than total.');
    }
    if (m.demo !== undefined && typeof m.demo !== 'boolean') throw new Error('`demo` must be true or false.');
    const plain: PlainParts = {
      ref: m.ref === undefined ? '' : text(m.ref, 'ref', 40),
      title,
      finishedAt: m.finishedAt === undefined ? sentAt : when(m.finishedAt, 'finishedAt'),
      headSha,
      ...(m.demo === undefined ? {} : { demo: m.demo as boolean }),
      summary: m.summary === undefined ? '' : text(m.summary, 'summary', 4000),
      changes: list(m.changes, 'changes', 30).map((c, i) => {
        if (!isObject(c)) throw new Error(`\`changes[${i}]\` must be { "label", "text" }.`);
        return { label: text(c.label, `changes[${i}].label`, 60), text: text(c.text, `changes[${i}].text`, 1000) };
      }),
      reaches: m.reaches === undefined ? '' : text(m.reaches, 'reaches', 500),
      checks: { passed: checks.passed as number, total: checks.total as number },
      trail: list(m.trail, 'trail', 50).map((t, i) => {
        if (!isObject(t) || !(TONES as readonly unknown[]).includes(t.tone)) {
          throw new Error(`\`trail[${i}]\` must be { "at", "tone", "text" }, with tone one of: ${TONES.join(', ')}.`);
        }
        return { at: when(t.at, `trail[${i}].at`), tone: t.tone as Tone, text: text(t.text, `trail[${i}].text`, 1000) };
      }),
    };

    const forJohn = Object.fromEntries(Object.entries(m).filter(([k]) => !ENVELOPE.has(k) && !isPlainPart(k)));
    if (forJohn.forJohn !== undefined) {
      const j = forJohn.forJohn;
      if (!isObject(j)) throw new Error('`forJohn` must be an object.');
      for (const k of ['cost', 'nextStep'] as const) if (j[k] !== undefined) text(j[k], `forJohn.${k}`, 500);
      // Drawn as a link on John's screen, so only ever a web address.
      if (j.runUrl !== undefined && !/^https:\/\/[^\s"<>]+$/.test(text(j.runUrl, 'forJohn.runUrl', 500))) {
        throw new Error('`forJohn.runUrl` must be an https address.');
      }
    }
    return { ok: true, state: m.state as CardKind, sentAt, runId, previewUrl, plain, forJohn };
  } catch (e) {
    return { ok: false, message: `${(e as Error).message} Nothing was kept.` };
  }
}

const TONES = ['ok', 'working', 'attention', 'blocked', 'idle'] as const;

async function screenshot(deps: DoorDeps, store: CardStore, ventureId: string, repo: string, number: number, m: Record<string, unknown>): Promise<DoorReply> {
  if (typeof m.name !== 'string' || !isPictureName(m.name)) {
    return refuse(deps, 400, '`name` must be before-computer, after-computer, before-phone or after-phone.');
  }
  let takenAt: string;
  let headSha: string;
  try {
    takenAt = when(m.takenAt, 'takenAt');
    headSha = text(m.headSha, 'headSha', 100);
  } catch (e) {
    return refuse(deps, 400, `${(e as Error).message} Nothing was kept.`);
  }
  if (typeof m.png !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(m.png)) return refuse(deps, 400, '`png` must be the picture in base64.');
  const bytes = Buffer.from(m.png, 'base64');
  if (bytes.byteLength > MAX_PICTURE_BYTES) return refuse(deps, 413, 'That picture is bigger than 4 MB.');
  const size = pngSize(bytes);
  if (!size) return refuse(deps, 415, 'That is not a PNG. Pictures must be PNG.');
  if (size.width > 10_000 || size.height > 50_000) return refuse(deps, 422, 'That picture is larger than any screen.');

  const kept = await store.putPicture(ventureId, repo, number, { name: m.name, headSha, takenAt, bytes, ...size });
  deps.log(`picture ${m.name} for ${repo}#${number} ${kept}`);
  if (kept === 'no-card') return say(409, 'There is no card for that pull request yet. Send the card first.');
  if (kept === 'other-version') return say(409, 'That picture is of a different version of the work than the card. Nothing was kept.');
  return say(200, 'Picture kept.', true);
}

/** A PNG's size from its header, or null when the bytes are not a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 33 || SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
  // The first chunk of every PNG is IHDR, and its first eight bytes are the width and the height.
  if (Buffer.from(bytes.subarray(12, 16)).toString('latin1') !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

async function preview(deps: DoorDeps, store: CardStore, ventureId: string, repo: string, number: number, m: Record<string, unknown>): Promise<DoorReply> {
  if (m.url !== null && (typeof m.url !== 'string' || m.url.length > 500 || !isPreviewAddress(m.url))) {
    return refuse(deps, 422, '`url` is not a preview address the studio can check. Nothing was kept.');
  }
  const kept = await store.putPreview(ventureId, repo, number, m.url as string | null);
  deps.log(`preview for ${repo}#${number} ${kept}`);
  if (kept === 'no-card') return say(409, 'There is no card for that pull request yet. Send the card first.');
  return say(200, m.url === null ? 'Preview link removed.' : 'Preview link kept.', true);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, name: string, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new Error(`\`${name}\` must be text of at most ${max} characters.`);
  return v;
}

function when(v: unknown, name: string): string {
  if (typeof v !== 'string' || v.length > 40 || Number.isNaN(Date.parse(v))) throw new Error(`\`${name}\` must be a date and time, like 2026-11-04T09:15:00Z.`);
  return new Date(v).toISOString();
}

function list(v: unknown, name: string, max: number): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw new Error(`\`${name}\` must be a list of at most ${max}.`);
  return v;
}

const count = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10_000;

