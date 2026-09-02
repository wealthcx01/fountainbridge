#!/usr/bin/env node
// The record of what the venture has read (FB-156) — the merge, as a pure program.
//
// The studio's Memory screen has a `Last used` column that stayed deliberately empty for a ticket
// and a half, because nothing recorded which documents the team read while it worked. This is the
// half that writes it. Same seam as runreport-record.mjs: bash does the GitHub round trip, node does
// the shaping, and the shaping is testable without a network or a box.
//
// Reads the CURRENT readings.json on stdin (empty stdin = there is none yet) and writes the merged
// record on stdout.
//
//   readings-record.mjs <used-file> <work-kind> <work-id> <work-title> [work-url] [at]
//
// `used-file` holds one gbrain slug per line, as `brain-query.mjs --used-file` wrote it.
//
// ## Only the corpus is recorded
//
// The brain indexes the whole venture repo — tickets, code and root docs as well as `context/` and
// `library/`. `Last used` is a column on the founder's corpus, so recording that a lane re-read its
// own ticket file would fill the record with rows the screen does not have and cannot show. The
// filter is here rather than in the digest because the digest's job is the prompt, not the record.
//
// ## Last write wins, one entry per document
//
// Not an append-only history. ARCA's state ref already gains ~288 files a day and has crossed a
// listing cap nobody measured (FB-161, FB-162); a growing record would put the founder's Memory
// screen back on a read whose cost tracks the venture's history. One entry per document is bounded
// by the size of the corpus, which is the thing the column is about anyway.

import { readFileSync } from 'node:fs';

/** `context/sell/positioning` and `library/build/x` — the two D8 areas, and nothing else. */
const CORPUS_SLUG = /^(context|library)\//;

/** Read stdin to a string. Empty when there is no record yet — which is not an error. */
function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Merge one reading into the record.
 *
 * Never throws on a broken existing record: a `readings.json` that will not parse is replaced rather
 * than allowed to stop the lane recording forever. The studio reads an unparseable file as "could
 * not read", which is loud, and the next wake fixes it.
 *
 * @param {string} existingJson the current readings.json, or ''
 * @param {string[]} slugs gbrain slugs the model was actually shown
 * @param {{kind: string, id: string, title: string, url: string}} work
 * @param {string} at ISO instant
 */
export function mergeReadings(existingJson, slugs, work, at) {
  let readings = {};
  try {
    const parsed = JSON.parse(existingJson || '{}');
    if (parsed && typeof parsed === 'object' && parsed.readings && typeof parsed.readings === 'object') {
      readings = { ...parsed.readings };
    }
  } catch { /* unreadable: start again rather than never record anything again */ }

  const entry = {
    at,
    work: {
      kind: work.kind === 'conversation' ? 'conversation' : 'ticket',
      id: work.id || '',
      title: work.title || work.id || '',
      ...(work.url ? { url: work.url } : {}),
    },
  };
  for (const slug of slugs) {
    if (CORPUS_SLUG.test(slug)) readings[slug] = entry;
  }
  return { version: 1, readings };
}

/** One slug per line, blanks and duplicates dropped. */
export function parseUsedFile(text) {
  return [...new Set(String(text || '').split('\n').map((l) => l.trim()).filter(Boolean))];
}

function main() {
  const [usedFile, kind, id, title, url, at] = process.argv.slice(2);
  if (!usedFile) {
    console.error('usage: readings-record.mjs <used-file> <work-kind> <work-id> <work-title> [work-url] [at]');
    process.exit(2);
  }
  let slugs;
  try {
    slugs = parseUsedFile(readFileSync(usedFile, 'utf8'));
  } catch (e) {
    console.error(`[readings] could not read ${usedFile}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  // Nothing from the corpus was read. Exit 3 — distinct from a failure, so the caller can skip the
  // write instead of pushing an identical file every five minutes.
  const merged = mergeReadings(readStdin(), slugs, { kind, id, title, url }, at || new Date().toISOString());
  if (!slugs.some((s) => CORPUS_SLUG.test(s))) process.exit(3);
  process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('readings-record.mjs')) main();
