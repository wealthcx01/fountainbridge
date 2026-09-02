#!/usr/bin/env node
// Generates the studio's PWA icons (FB-141) as flat PNGs, with no image dependency.
//
// Why generated rather than committed as art: the studio has no raster assets by design ("No raster
// assets" — the design README), and the one place a raster is unavoidable is a home-screen icon,
// which iOS and Android both require as PNG. A generator keeps the colours tied to the same tokens
// the rest of the studio uses, and makes a re-render a one-line change rather than a round trip.
//
// The mark is deliberately plain: the accent field with a paper square inset, sized inside the
// maskable safe zone (40% radius) so Android's circle crop cannot clip it. It is a placeholder for
// the brand's own icon, and says so in the ticket.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCENT = [26, 59, 38];    // --color-accent  #1a3b26
const PAPER  = [247, 246, 242]; // --color-paper   #f7f6f2

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** A square icon: accent field, paper square inset, inside the maskable safe zone. */
function icon(size) {
  const inset = Math.round(size * 0.30);   // safe zone: nothing important outside the middle 80%
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0]; // filter byte: none
    for (let x = 0; x < size; x++) {
      const inner = x >= inset && x < size - inset && y >= inset && y < size - inset;
      row.push(...(inner ? PAPER : ACCENT));
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const out = join(process.cwd(), 'public', `icon-${size}.png`);
  writeFileSync(out, icon(size));
  console.log(`wrote ${out}`);
}
// iOS reads apple-touch-icon and does NOT honour maskable padding, so it gets the same square.
writeFileSync(join(process.cwd(), 'public', 'apple-touch-icon.png'), icon(180));
console.log('wrote public/apple-touch-icon.png');
