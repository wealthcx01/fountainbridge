import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { readCard } from '../factory-door';
import { PICTURES } from '../review';
import type { CardStore, CardWithPictures, StoredCard } from '../card-store';

/**
 * The browser tests' cards (`e2e/fixtures/review`), read the way the door reads them (FB-275), for
 * the unit tests. Each file is a card in the door's own format.
 */

const FIXTURES = join(import.meta.dirname, '..', '..', 'e2e', 'fixtures', 'review');

/** The card exactly as the box would send it. */
export function sentCard(repo: string, number: number): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES, repo, `${number}.json`), 'utf8'));
}

/** The same card, as the door stores it. */
export function storedCard(repo: string, number: number): StoredCard {
  const sent = sentCard(repo, number);
  const read = readCard(sent, Date.parse('2026-10-29T00:00:00Z'));
  if (!read.ok) throw new Error(`the test card ${repo}#${number} does not read: ${read.message}`);
  return {
    repo, number, runId: read.runId, state: read.state, sentAt: read.sentAt, headSha: read.plain.headSha,
    previewUrl: read.previewUrl, plain: read.plain, forJohn: read.forJohn,
  };
}

/** The card with all four pictures, at a computer's size and a phone's. */
export function withPictures(card: StoredCard): CardWithPictures {
  return {
    ...card,
    pictures: PICTURES.map((name) => ({
      name, width: name.endsWith('phone') ? 393 : 1440, height: name.endsWith('phone') ? 851 : 1000, takenAt: card.plain.finishedAt,
    })),
  };
}

/** ARCA's #20 and #21 under ARCA, and THE RESET's #5 under THE RESET. */
export async function putTestCards(store: CardStore): Promise<void> {
  await store.putCard('arca', storedCard('arca', 20));
  await store.putCard('arca', storedCard('arca', 21));
  await store.putCard('the-reset', storedCard('thereset-platform', 5));
}

/** A real PNG of the size given, plain white, for the tests that send or keep a picture. */
export function testPng(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits a channel, red-green-blue, no interlace
  // Each row: a filter byte of 0, then three bytes a pixel.
  const rows = Buffer.alloc((width * 3 + 1) * height, 0xff);
  for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}
