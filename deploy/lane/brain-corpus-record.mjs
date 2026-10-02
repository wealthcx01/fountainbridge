#!/usr/bin/env node
// How many of the venture's documents its brain cannot see (FB-169) — the record, and its trip to
// the studio.
//
// gbrain-refresh.sh already checks, after every sync, whether the brain holds every document in
// `context/` and `library/`. Until now the answer reached two places: `state/brain-corpus-gap` on the
// box, and a clause in each run report. Neither is the Memory screen, which is where a founder looks
// to see what their venture knows. This puts it there.
//
// ## Two steps, on purpose
//
//   brain-corpus-record.mjs write <record.json>              (gbrain-refresh.sh; gap text on stdin)
//   brain-corpus-record.mjs publish <record.json> <marker>   (run-once.sh; needs the GitHub token)
//
// The refresh unit holds no credentials, by design: it only reads what is already on disk
// (install-gbrain.sh says so where it writes brain-sync.env). So the refresh writes the record to the
// box's own state folder, and the lane — which already writes run reports to the state ref every
// wake — carries it to `health/brain-corpus.json` on that ref. Nothing new holds a token.
//
// ## Written every time, including when nothing is missing
//
// `state/brain-corpus-gap` is deleted when the brain is complete, so its absence means both "nothing
// missing" and "never checked". The studio must say which, so the record exists in both cases and
// carries the count: 0 is a measured zero, and no record at all is "we do not know".
//
// ## Bounded writes
//
// The refresh runs every few minutes. Publishing each one would add a commit to the state ref every
// wake for a fact that has not changed (the FB-161/162 lesson). So the lane publishes only when the
// answer changed, or once a day so the studio can tell a current answer from an abandoned one.

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Where the record lives on the venture's `foundry-state` ref. Must match `lib/brain-corpus.ts`. */
export const RECORD_PATH = 'health/brain-corpus.json';

/** How many missing documents the record names. The count beside it is always the true count. */
export const RECORD_LIST_CAP = 25;

/** Re-publish an unchanged answer after this long, so its date says the check is still running. */
export const REPUBLISH_AFTER_MS = 20 * 60 * 60 * 1000;

/** How many times to try the write when another write to the same branch got there first. */
export const PUBLISH_ATTEMPTS = 3;

/**
 * Read what gbrain-refresh.sh computed: `<missing> <corpus>` on the first line, then one path per
 * missing document. When the check itself could not run, the script writes `?` instead.
 *
 * Returns `{ missingCount, corpus, missing }`, with both counts null when the check did not run —
 * which is a third answer, never to be shown as zero.
 */
export function parseGap(text) {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const m = /^(\d+)\s+(\d+)$/.exec(lines[0] ?? '');
  if (!m) return { missingCount: null, corpus: null, missing: [] };
  const missing = lines.slice(1);
  // A first line that claims fewer than it lists is believed on the list.
  return { missingCount: Math.max(Number(m[1]), missing.length), corpus: Number(m[2]), missing };
}

/** The record the studio reads. Built field by field, so nothing else can ride along onto the ref. */
export function toRecord(gap, { at }) {
  return {
    version: 1,
    kind: 'brain-corpus',
    at,
    corpus: gap.corpus,
    missingCount: gap.missingCount,
    missing: gap.missing.slice(0, RECORD_LIST_CAP).map(String),
  };
}

/** Everything about a record except when it was made — what "the answer changed" compares. */
function substance(record) {
  if (!record || typeof record !== 'object') return null;
  const { corpus = null, missingCount = null, missing = [] } = record;
  return JSON.stringify({ corpus, missingCount, missing });
}

/**
 * Whether the lane should carry this record to the state ref now.
 *
 * Yes when nothing has been published from this box yet, when the answer differs from the last one
 * published, or when the last one is old enough that the studio would start to doubt it.
 */
export function shouldPublish(record, lastPublished, now) {
  if (!record) return false;
  if (!lastPublished) return true;
  // The very record already published. Without this, a refresh that stopped running would leave one
  // old record behind, and every wake after the first day would publish it again — forever.
  if (record.at === lastPublished.at) return false;
  if (substance(record) !== substance(lastPublished)) return true;
  const last = Date.parse(lastPublished.at);
  return !Number.isFinite(last) || now - last >= REPUBLISH_AFTER_MS;
}

/**
 * Put the record on the venture's state ref. The same write as the credential scan's (FB-206): read
 * the old file's version id, then PUT the new one, retrying when another write got there first.
 *
 * Returns `{ ok, why }` and never throws. A failure is described in words, never with the token.
 */
export async function publishRecord(record, { token, repo, ref = 'foundry-state', api = 'https://api.github.com', fetchImpl = fetch }) {
  if (!token) return { ok: false, why: 'TICKET_GITHUB_TOKEN is not set, so the studio cannot be told.' };
  if (!repo) return { ok: false, why: 'REPO is not set, so there is nowhere to write the record.' };
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const said = async (res) => {
    try {
      const body = await res.json();
      return body && typeof body.message === 'string' ? `: ${body.message}` : '';
    } catch {
      return '';
    }
  };
  const url = `${api}/repos/${repo}/contents/${RECORD_PATH}`;
  const content = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8').toString('base64');
  const n = record.missingCount;
  const message = `health: venture brain (${n === null ? 'could not check' : n === 0 ? 'sees every document' : `cannot see ${n}`})`;
  try {
    for (let attempt = 1; ; attempt++) {
      const current = await fetchImpl(`${url}?ref=${encodeURIComponent(ref)}`, { headers });
      let sha;
      if (current.ok) sha = (await current.json())?.sha;
      else if (current.status !== 404) return { ok: false, why: `GitHub would not show the last record (${current.status}${await said(current)})` };

      const put = await fetchImpl(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ message, content, branch: ref, ...(sha ? { sha } : {}) }),
      });
      if (put.ok) return { ok: true, why: null };
      const collided = put.status === 409 || put.status === 422;
      if (collided && attempt < PUBLISH_ATTEMPTS) continue;
      return { ok: false, why: `GitHub refused the write (${put.status}${await said(put)})${collided ? `, ${attempt} times in a row` : ''}` };
    }
  } catch (err) {
    return { ok: false, why: `could not reach GitHub (${err && err.message ? err.message : String(err)})` };
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Write a file whole or not at all, so a reader never sees half a record. */
function writeAtomically(path, text) {
  const tmp = join(dirname(path), `.${Date.now()}.${process.pid}.tmp`);
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''));
if (isMain) {
  const [cmd, file, marker] = process.argv.slice(2);
  if (cmd === 'write' && file) {
    let text = '';
    try { text = readFileSync(0, 'utf8'); } catch { text = ''; }
    const record = toRecord(parseGap(text), { at: new Date().toISOString() });
    writeAtomically(file, `${JSON.stringify(record, null, 2)}\n`);
    process.exit(0);
  }
  if (cmd === 'publish' && file && marker) {
    const record = readJson(file);
    // No record yet: the brain has not finished a check on this box. Nothing to say, and not a fault.
    if (!record) process.exit(0);
    if (!shouldPublish(record, readJson(marker), Date.now())) process.exit(0);
    const env = process.env;
    const sent = await publishRecord(record, {
      token: env.TICKET_GITHUB_TOKEN,
      repo: env.REPO,
      ref: env.STATE_REF || 'foundry-state',
      api: env.API || 'https://api.github.com',
    });
    if (!sent.ok) {
      process.stderr.write(`COULD NOT TELL THE STUDIO what the brain can see — ${sent.why}\n`);
      process.exit(1);
    }
    writeAtomically(marker, `${JSON.stringify(record)}\n`);
    process.stdout.write(`Told the studio: ${env.REPO}, ${RECORD_PATH}.\n`);
    process.exit(0);
  }
  process.stderr.write('usage: brain-corpus-record.mjs write <record.json> | publish <record.json> <marker>\n');
  process.exit(2);
}
