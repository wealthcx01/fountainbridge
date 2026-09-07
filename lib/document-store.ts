import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Where a founder's document actually lives (FB-174).
 *
 * ## The fault this exists to fix
 *
 * A founder hands over a document. The studio extracts its text, commits the text into the venture's
 * repository, and **throws the original away**. Not archives it — discards it. The 40-page deck a
 * founder spent a week on becomes a markdown file of its words, and the file itself is gone, with
 * nothing on the screen having said so.
 *
 * Two things are wrong with that and they need separating, because only one of them is obvious.
 *
 * The obvious one is the loss. The other is that **git history is permanent**. Anything committed
 * there cannot be taken back out, which is exactly why `depositDocument` scans for secrets before
 * writing (FB-140). A store is different: an object can be deleted. So keeping originals somewhere
 * that is not git is not only about keeping them — it is about being able to stop keeping them.
 *
 * ## The address is the content
 *
 * A document's key is `<venture>/<sha256 of its bytes>`. The founder's filename is a fact about the
 * document, never its address, and that closes a whole class of problem at once: a hex digest cannot
 * contain `..`, a slash, a null byte, or a right-to-left override. `db/002_documents.sql` enforces
 * the same shape with a check constraint, so neither half depends on the other remembering.
 *
 * ## A test double must never serve production
 *
 * This is Grassmarket's scar, inherited on purpose (see FB-173). Its offline transcriber was the
 * unconditional return of a route's dependency in every environment, so a real MP3 was decoded as
 * text and stored as a meeting's transcript — a silent fallback that invented data. The same shape
 * here would be worse: `filesystem` in production writes a founder's only copy to a container disk
 * that is thrown away on the next deploy, and nothing would say so. `buildDocumentStore` refuses.
 */

/** The sha256 of some bytes, lower-case hex — a document's identity. */
export function checksumOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const CHECKSUM = /^[0-9a-f]{64}$/;
/** A venture id, in the shape the manifests use. Narrow on purpose: this ends up in a path. */
const VENTURE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Where one venture's document lives, and the only function that decides.
 *
 * Throws rather than returning null: every caller here is about to read or write a founder's
 * document, and there is no sensible way to carry on without an address (CLAUDE.md #10).
 */
export function documentKey(ventureId: string, checksum: string): string {
  if (!VENTURE_ID.test(ventureId)) throw new Error(`not a venture id: ${JSON.stringify(ventureId)}`);
  if (!CHECKSUM.test(checksum)) throw new Error('a document is addressed by its sha256 and nothing else');
  return `${ventureId}/${checksum}`;
}

/**
 * Is this key one that THIS venture is allowed to ask for?
 *
 * Checked on every read. Knowing another venture's checksum must not be enough to fetch its
 * document — and a checksum is guessable in exactly one case that matters: the same file handed to
 * two ventures. Two ventures holding the same deck is two objects under two prefixes, and neither
 * can read the other's.
 */
export function keyBelongsTo(ventureId: string, key: string): boolean {
  if (!VENTURE_ID.test(ventureId)) return false;
  const [prefix, checksum, ...rest] = key.split('/');
  return rest.length === 0 && prefix === ventureId && CHECKSUM.test(checksum ?? '');
}

/** What a store says once it holds something. */
export interface StoredDocument {
  key: string;
  checksum: string;
  bytes: number;
  contentType: string;
  /** Which store holds it, recorded so a later move is traceable. */
  store: string;
}

export interface DocumentStore {
  /** Recorded on the document's row and its git pointer. */
  readonly name: string;
  put(ventureId: string, body: Uint8Array, contentType: string): Promise<StoredDocument>;
  get(ventureId: string, key: string): Promise<Uint8Array>;
}

export const DOCUMENT_STORE_PROVIDERS = ['none', 'filesystem', 'supabase'] as const;
export type DocumentStoreProvider = (typeof DOCUMENT_STORE_PROVIDERS)[number];
/** Providers that are development conveniences, not places to keep a founder's only copy. */
export const TEST_DOUBLE_PROVIDERS: ReadonlySet<string> = new Set(['filesystem']);

export class DocumentStoreNotConfiguredError extends Error {}

/**
 * A directory on this machine. For tests and for working locally, and refused in production.
 *
 * The refusal is the point. A container's disk does not survive a deploy, so this in production
 * would lose a founder's document quietly, at a moment nobody was watching.
 */
export class FilesystemDocumentStore implements DocumentStore {
  readonly name = 'filesystem';
  constructor(private readonly root: string) {}

  private path(key: string): string {
    // Built from `documentKey`'s output, which is a venture id and a hex digest, so it cannot climb.
    // Resolved and checked anyway: this is the one place a path is joined from a value that came in
    // from outside, and a guard that is never needed costs a line.
    const full = resolve(join(this.root, key));
    if (!full.startsWith(resolve(this.root))) throw new Error('that is not inside the store');
    return full;
  }

  async put(ventureId: string, body: Uint8Array, contentType: string): Promise<StoredDocument> {
    const checksum = checksumOf(body);
    const key = documentKey(ventureId, checksum);
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, checksum, bytes: body.byteLength, contentType, store: this.name };
  }

  async get(ventureId: string, key: string): Promise<Uint8Array> {
    if (!keyBelongsTo(ventureId, key)) throw new Error('that document belongs to another venture');
    return new Uint8Array(await readFile(this.path(key)));
  }
}

/**
 * Supabase Storage, which comes with the Postgres this studio already uses (FB-170).
 *
 * The bucket is private and the service key never leaves the server. There is deliberately no method
 * here that hands a browser a URL: a founder's document is fetched through the studio, after the
 * same `canAccessVenture` check every other venture-scoped read passes, because a signed URL is a
 * capability that outlives the check that produced it.
 */
export class SupabaseDocumentStore implements DocumentStore {
  readonly name = 'supabase';
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {}

  private endpoint(key: string): string {
    return `${this.url.replace(/\/$/, '')}/storage/v1/object/${encodeURIComponent(this.bucket)}/${key}`;
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey };
  }

  async put(ventureId: string, body: Uint8Array, contentType: string): Promise<StoredDocument> {
    const checksum = checksumOf(body);
    const key = documentKey(ventureId, checksum);
    const res = await fetch(this.endpoint(key), {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': contentType, 'x-upsert': 'true' },
      body: body as unknown as BodyInit,
    });
    // Loud, and with the venture named. A deposit that half-worked is the failure a founder finds
    // out about weeks later (CLAUDE.md #10).
    if (!res.ok && res.status !== 409) {
      throw new Error(`the document store refused ${ventureId}'s document: ${res.status}`);
    }
    return { key, checksum, bytes: body.byteLength, contentType, store: this.name };
  }

  async get(ventureId: string, key: string): Promise<Uint8Array> {
    if (!keyBelongsTo(ventureId, key)) throw new Error('that document belongs to another venture');
    const res = await fetch(this.endpoint(key), { headers: this.headers() });
    if (!res.ok) throw new Error(`the document store could not return that document: ${res.status}`);
    const got = new Uint8Array(await res.arrayBuffer());
    // The acceptance criterion is byte for byte, so it is checked rather than hoped for. A store
    // that returns something OTHER than what was put in is the failure most worth catching, because
    // every other layer would carry on as if it were the document.
    const back = checksumOf(got);
    if (`${ventureId}/${back}` !== key) {
      throw new Error('the document that came back is not the document that was stored');
    }
    return got;
  }
}

/**
 * The one place a store is chosen.
 *
 * An unknown provider is refused here rather than falling back to something that appears to work,
 * and a test double is refused in production. Both are the ADR-0001 registry shape Grassmarket uses
 * for its transcribers, for the reason FB-173 records.
 */
export function buildDocumentStore(
  env: Record<string, string | undefined> = process.env,
): DocumentStore | null {
  const provider = (env.DOCUMENT_STORE ?? 'none').trim();
  const isProduction = env.NODE_ENV === 'production';

  if (!(DOCUMENT_STORE_PROVIDERS as readonly string[]).includes(provider)) {
    throw new DocumentStoreNotConfiguredError(
      `DOCUMENT_STORE is "${provider}", which is not a store. One of: ${DOCUMENT_STORE_PROVIDERS.join(', ')}.`,
    );
  }

  // Not an error, and said explicitly rather than by omission. Most studios have no store yet, and
  // the deposit path tells a founder plainly that the original was not kept.
  if (provider === 'none') return null;

  if (isProduction && TEST_DOUBLE_PROVIDERS.has(provider)) {
    throw new DocumentStoreNotConfiguredError(
      `DOCUMENT_STORE is "${provider}", which is a development convenience and not a place to keep `
      + 'a founder’s only copy — a container disk does not survive a deploy.',
    );
  }

  if (provider === 'filesystem') {
    const root = env.DOCUMENT_STORE_DIR?.trim();
    if (!root) throw new DocumentStoreNotConfiguredError('The filesystem store needs DOCUMENT_STORE_DIR.');
    return new FilesystemDocumentStore(root);
  }

  const url = env.SUPABASE_URL?.trim();
  const serviceKey = env.SUPABASE_SERVICE_KEY?.trim();
  const bucket = env.DOCUMENT_STORE_BUCKET?.trim() || 'documents';
  if (!url || !serviceKey) {
    throw new DocumentStoreNotConfiguredError(
      'The Supabase store needs SUPABASE_URL and SUPABASE_SERVICE_KEY.',
    );
  }
  return new SupabaseDocumentStore(url, serviceKey, bucket);
}
