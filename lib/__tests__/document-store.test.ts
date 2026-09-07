import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildDocumentStore, checksumOf, documentKey, keyBelongsTo,
  DocumentStoreNotConfiguredError, FilesystemDocumentStore,
} from '../document-store';

/**
 * FB-174 — where a founder's document lives.
 *
 * Written as attempts to lose a document or to reach another venture's, rather than as a
 * demonstration that the happy path works. Losing one is the failure a founder finds out about
 * weeks later, which makes it the one worth trying hardest to cause.
 */
const roots: string[] = [];
const store = () => {
  const root = mkdtempSync(join(tmpdir(), 'fb174-'));
  roots.push(root);
  return new FilesystemDocumentStore(root);
};
afterEach(() => { while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true }); });

const bytes = (s: string) => new TextEncoder().encode(s);

describe('a document comes back exactly as it went in', () => {
  it('round-trips byte for byte', async () => {
    const s = store();
    // Bytes that are not text, because a store that quietly decodes is the Grassmarket fault.
    const original = new Uint8Array([0, 1, 2, 255, 254, 10, 13, 0, 0x50, 0x4b]);
    const put = await s.put('arca', original, 'application/octet-stream');
    await expect(s.get('arca', put.key)).resolves.toEqual(original);
  });

  it('survives a document that is entirely zero bytes of content but not empty', async () => {
    const s = store();
    const original = new Uint8Array(1024);
    const put = await s.put('arca', original, 'application/pdf');
    const back = await s.get('arca', put.key);
    expect(back.byteLength).toBe(1024);
    expect(checksumOf(back)).toBe(put.checksum);
  });

  it('is idempotent: handing over the same file twice is one object', async () => {
    const s = store();
    const a = await s.put('arca', bytes('the deck'), 'text/plain');
    const b = await s.put('arca', bytes('the deck'), 'text/plain');
    expect(b.key).toBe(a.key);
    await expect(s.get('arca', a.key)).resolves.toEqual(bytes('the deck'));
  });
});

describe('one venture cannot reach another venture’s document', () => {
  it('refuses a key belonging to someone else, even a real one', async () => {
    const s = store();
    const theirs = await s.put('the-reset', bytes('their board pack'), 'text/plain');
    await expect(s.get('arca', theirs.key)).rejects.toThrow(/another venture/);
  });

  it('gives the same file two addresses when two ventures hold it', async () => {
    const s = store();
    const mine = await s.put('arca', bytes('same deck'), 'text/plain');
    const theirs = await s.put('the-reset', bytes('same deck'), 'text/plain');
    expect(mine.checksum).toBe(theirs.checksum);
    expect(mine.key).not.toBe(theirs.key);
    // Knowing the checksum is not enough. That is the point of the prefix.
    await expect(s.get('arca', theirs.key)).rejects.toThrow(/another venture/);
  });

  it('refuses keys that try to climb, however they are spelled', async () => {
    for (const key of [
      '../the-reset/' + 'a'.repeat(64),
      'arca/../the-reset/' + 'a'.repeat(64),
      'arca/' + 'a'.repeat(64) + '/../../etc/passwd',
      '/etc/passwd',
      'arca/', 'arca', '', 'arca//' + 'a'.repeat(64),
      'arca/' + 'A'.repeat(64),
      'arca/' + 'a'.repeat(63),
    ]) {
      expect(keyBelongsTo('arca', key), key).toBe(false);
    }
  });

  it('will not build an address out of a filename', () => {
    // The founder's filename is a fact about the document, never its address.
    expect(() => documentKey('arca', '../../etc/passwd')).toThrow();
    expect(() => documentKey('arca', 'Q4 board pack.pdf')).toThrow();
    expect(() => documentKey('../the-reset', 'a'.repeat(64))).toThrow();
    expect(() => documentKey('arca/../the-reset', 'a'.repeat(64))).toThrow();
  });
});

describe('choosing a store', () => {
  const base = { DOCUMENT_STORE_DIR: '/tmp/fb174' };

  it('has no store by default, and says so by returning nothing', () => {
    expect(buildDocumentStore({})).toBeNull();
    expect(buildDocumentStore({ DOCUMENT_STORE: 'none' })).toBeNull();
  });

  it('refuses a provider it does not have, rather than falling back to one it does', () => {
    expect(() => buildDocumentStore({ DOCUMENT_STORE: 's4' }))
      .toThrow(DocumentStoreNotConfiguredError);
    expect(() => buildDocumentStore({ DOCUMENT_STORE: '' })).toThrow();
  });

  it('REFUSES to keep a founder’s only copy on a container disk in production', () => {
    // The whole reason this function exists. A container's disk does not survive a deploy, and the
    // loss would be silent.
    expect(() => buildDocumentStore({ ...base, DOCUMENT_STORE: 'filesystem', NODE_ENV: 'production' }))
      .toThrow(/does not survive a deploy/);
    // And allows it everywhere else, because it is genuinely useful there.
    expect(buildDocumentStore({ ...base, DOCUMENT_STORE: 'filesystem' })).toBeTruthy();
  });

  it('refuses a real store that is missing its credentials', () => {
    expect(() => buildDocumentStore({ DOCUMENT_STORE: 'supabase' })).toThrow(/SUPABASE_URL/);
    expect(() => buildDocumentStore({ DOCUMENT_STORE: 'supabase', SUPABASE_URL: 'https://x.test' }))
      .toThrow(/SUPABASE_SERVICE_KEY/);
  });

  it('builds the real store in production when it is properly configured', () => {
    const built = buildDocumentStore({
      DOCUMENT_STORE: 'supabase',
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_KEY: 'service-key',
      NODE_ENV: 'production',
    });
    expect(built?.name).toBe('supabase');
  });
});
