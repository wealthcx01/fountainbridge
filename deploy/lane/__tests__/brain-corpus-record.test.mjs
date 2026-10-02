import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { spawnSync, execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseGap, toRecord, shouldPublish, publishRecord, RECORD_PATH, RECORD_LIST_CAP, REPUBLISH_AFTER_MS, PUBLISH_ATTEMPTS,
} from '../brain-corpus-record.mjs';

/**
 * FB-169 — the box's half of "how many documents can the brain not see" reaching the Memory screen.
 *
 * The last block runs the REAL gbrain-refresh.sh against a small git repo and a stand-in `gbrain`,
 * so the record is checked as the timer would write it, not as a unit test imagines it.
 */
const REFRESH = fileURLToPath(new URL('../gbrain-refresh.sh', import.meta.url));

describe('reading the gap the refresh computed', () => {
  it('reads the count, the total and the missing paths', () => {
    expect(parseGap('3 5\ncontext/build/a.md\ncontext/build/b.md\ncontext/build/c.md\n')).toEqual({
      missingCount: 3, corpus: 5, missing: ['context/build/a.md', 'context/build/b.md', 'context/build/c.md'],
    });
  });

  it('reads a complete brain as a measured zero, not as nothing', () => {
    expect(parseGap('0 5\n')).toEqual({ missingCount: 0, corpus: 5, missing: [] });
  });

  it('reads a check that could not run as unknown — never as zero', () => {
    expect(parseGap('?')).toEqual({ missingCount: null, corpus: null, missing: [] });
    expect(parseGap('')).toEqual({ missingCount: null, corpus: null, missing: [] });
  });
});

describe('the record', () => {
  it('names at most the cap, and always carries the true count', () => {
    const missing = Array.from({ length: RECORD_LIST_CAP + 5 }, (_, i) => `context/sell/d${i}.md`);
    const r = toRecord({ missingCount: missing.length, corpus: 40, missing }, { at: '2026-10-02T10:00:00Z' });
    expect(r.missingCount).toBe(RECORD_LIST_CAP + 5);
    expect(r.missing).toHaveLength(RECORD_LIST_CAP);
    expect(r).toMatchObject({ kind: 'brain-corpus', at: '2026-10-02T10:00:00Z', corpus: 40 });
  });
});

describe('when the lane carries it to the studio', () => {
  const at = (h) => new Date(Date.UTC(2026, 9, 2, h)).toISOString();
  const rec = (h, missingCount, missing = []) => ({ at: at(h), corpus: 5, missingCount, missing });

  it('publishes the first record this box has made', () => {
    expect(shouldPublish(rec(1, 0), null, Date.parse(at(1)))).toBe(true);
  });

  it('publishes when the answer changed, however recently it last did', () => {
    expect(shouldPublish(rec(2, 1, ['context/x.md']), rec(1, 0), Date.parse(at(2)))).toBe(true);
  });

  it('does not publish an unchanged answer every wake', () => {
    expect(shouldPublish(rec(3, 0), rec(1, 0), Date.parse(at(3)))).toBe(false);
  });

  it('does publish an unchanged answer once it is a day old, so its date stays honest', () => {
    const later = Date.parse(at(1)) + REPUBLISH_AFTER_MS;
    expect(shouldPublish({ ...rec(1, 0), at: new Date(later).toISOString() }, rec(1, 0), later)).toBe(true);
  });

  it('never re-publishes the very record it already sent, however old', () => {
    // A refresh that has stopped leaves one record behind. Publishing it again on every wake would
    // add a commit to the state ref every five minutes, forever.
    expect(shouldPublish(rec(1, 0), rec(1, 0), Date.parse(at(1)) + 10 * REPUBLISH_AFTER_MS)).toBe(false);
  });
});

/** A fetch that answers like GitHub's contents API, and remembers every call. */
function fakeGitHub({ existingSha = null, putStatuses = [201] } = {}) {
  const calls = [];
  let puts = 0;
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null });
    if (method === 'GET') return existingSha ? json(200, { sha: existingSha }) : json(404, { message: 'Not Found' });
    const status = putStatuses[Math.min(puts++, putStatuses.length - 1)];
    return json(status, status < 300 ? { content: {} } : { message: 'is at old-sha but expected new-sha' });
  };
  return { calls, fetchImpl };
}

describe('the write to the state ref', () => {
  const record = toRecord({ missingCount: 3, corpus: 5, missing: ['context/build/a.md'] }, { at: '2026-10-02T10:00:00Z' });

  it('goes to health/brain-corpus.json on foundry-state, replacing the last one', async () => {
    const gh = fakeGitHub({ existingSha: 'old-sha' });
    const sent = await publishRecord(record, { token: 't', repo: 'wealthcx01/arca', fetchImpl: gh.fetchImpl });
    expect(sent).toEqual({ ok: true, why: null });
    const put = gh.calls.find((c) => c.method === 'PUT');
    expect(put.url).toBe(`https://api.github.com/repos/wealthcx01/arca/contents/${RECORD_PATH}`);
    expect(put.body.branch).toBe('foundry-state');
    expect(put.body.sha).toBe('old-sha');
    expect(JSON.parse(Buffer.from(put.body.content, 'base64').toString('utf8'))).toEqual(record);
  });

  it('tries again when another write to the branch got there first, then says so', async () => {
    const gh = fakeGitHub({ putStatuses: [409, 201] });
    expect((await publishRecord(record, { token: 't', repo: 'r/r', fetchImpl: gh.fetchImpl })).ok).toBe(true);
    const stuck = fakeGitHub({ putStatuses: [409] });
    const sent = await publishRecord(record, { token: 't', repo: 'r/r', fetchImpl: stuck.fetchImpl });
    expect(sent.ok).toBe(false);
    expect(stuck.calls.filter((c) => c.method === 'PUT')).toHaveLength(PUBLISH_ATTEMPTS);
  });

  it('says why when there is no token, and sends nothing', async () => {
    const gh = fakeGitHub();
    const sent = await publishRecord(record, { token: '', repo: 'r/r', fetchImpl: gh.fetchImpl });
    expect(sent.ok).toBe(false);
    expect(sent.why).toMatch(/TICKET_GITHUB_TOKEN/);
    expect(gh.calls).toHaveLength(0);
  });
});

describe('gbrain-refresh.sh writes the record on the box (run for real)', () => {
  let box;
  beforeEach(() => { box = mkdtempSync(join(tmpdir(), 'fb169-box-')); });
  afterEach(() => { rmSync(box, { recursive: true, force: true }); });

  /** A venture repo with these tracked files, and a `gbrain` that claims to hold these pages. */
  function setUp(tracked, pages, { listFails = false } = {}) {
    const repo = join(box, 'arca');
    for (const f of tracked) {
      mkdirSync(join(repo, f, '..'), { recursive: true });
      writeFileSync(join(repo, f), `# ${f}\n`);
    }
    const git = (...a) => spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
    git('init', '-q', '-b', 'master');
    git('add', '.');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'corpus');
    const bin = join(box, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'gbrain'), [
      '#!/usr/bin/env bash',
      'case "$1" in',
      '  sync) echo "No syncable changes" ;;',
      listFails
        ? '  list) echo "timed out waiting for the lock" >&2; exit 1 ;;'
        : `  list) printf '%s\\t-\\n' ${pages.map((p) => `'${p}'`).join(' ')} ;;`,
      'esac',
      'exit 0',
    ].join('\n'));
    chmodSync(join(bin, 'gbrain'), 0o755);
    const run = spawnSync('bash', [REFRESH], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LANE_DIR: box, REPO_DIR: repo, BASE_BRANCH: 'master' },
    });
    const file = join(box, 'state', 'brain-corpus.json');
    return { run, record: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null };
  }

  const CORPUS = ['context/README.md', 'context/product/policy.md', 'context/sell/brand.md', 'library/sell/deck-notes.md'];

  it('records the documents the brain cannot see, by name and by count', () => {
    const { run, record } = setUp(CORPUS, ['context/sell/brand']);
    expect(run.status).toBe(3); // the refresh still fails loudly, as before
    expect(record).toMatchObject({ kind: 'brain-corpus', corpus: 3, missingCount: 2 });
    expect(record.missing).toEqual(['context/product/policy.md', 'library/sell/deck-notes.md']);
  });

  it('records a complete brain as zero — a record, not an absence', () => {
    const { run, record } = setUp(CORPUS, ['context/sell/brand', 'context/product/policy', 'library/sell/deck-notes']);
    expect(run.status).toBe(0);
    expect(record).toMatchObject({ corpus: 3, missingCount: 0, missing: [] });
    expect(Number.isFinite(Date.parse(record.at))).toBe(true);
  });

  it('records "could not check" when gbrain cannot list what it holds, never "every document is missing"', () => {
    // The review's case: the wait for gbrain's lock runs out and `gbrain list` fails. The empty answer
    // used to be compared against the repo, so every document read as missing on the Memory screen.
    const { run, record } = setUp(CORPUS, [], { listFails: true });
    expect(run.status).toBe(3); // still a failed run, so the timer's unit shows it
    expect(record).toMatchObject({ kind: 'brain-corpus', corpus: null, missingCount: null, missing: [] });
    expect(run.stderr).toMatch(/COULD NOT CHECK/);
  });
});

/**
 * The lane's step that carries the record to the studio, run as a wake runs it: the real block from
 * run-once.sh, the real brain-corpus-record.mjs, and a stand-in for GitHub on a local port.
 */
describe('run-once.sh carries the record to the studio (run for real)', () => {
  const RUN_ONCE = readFileSync(fileURLToPath(new URL('../run-once.sh', import.meta.url)), 'utf8');
  const BLOCK = RUN_ONCE.slice(
    RUN_ONCE.indexOf('# --- tell the studio what the brain can see'),
    RUN_ONCE.indexOf('# Everything below runs against the department'),
  );
  const LANE = fileURLToPath(new URL('..', import.meta.url));
  let box;
  let server;
  let puts;
  let api;

  beforeEach(async () => {
    box = mkdtempSync(join(tmpdir(), 'fb169-lane-'));
    puts = [];
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        if (req.method === 'PUT') {
          puts.push({ url: req.url, body: JSON.parse(body) });
          res.writeHead(201, { 'Content-Type': 'application/json' }).end('{"content":{}}');
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"message":"Not Found"}');
        }
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    api = `http://127.0.0.1:${server.address().port}`;
  });
  afterEach(async () => {
    await new Promise((r) => server.close(r));
    rmSync(box, { recursive: true, force: true });
  });

  /** One lane wake: only the block under test, with the variables run-once.sh sets before it. */
  function wake() {
    const script = `
      set -euo pipefail
      STATE_DIR="$1"; SCRIPT_DIR="$2"; PRIMARY_REPO=wealthcx01/arca; STATE_REF=foundry-state; API="$3"
      TICKET_GITHUB_TOKEN=t
      flog() { echo "FLOG: $*" >&2; }
      ${BLOCK}
    `;
    return new Promise((resolve) => {
      execFile('bash', ['-c', script, '_', join(box, 'state'), LANE, api], (err, stdout, stderr) => resolve({ err, stdout, stderr }));
    });
  }

  /** A record exactly where gbrain-refresh.sh writes it (the refresh tests above read that same path). */
  function refreshWrote(missingCount, at) {
    mkdirSync(join(box, 'state'), { recursive: true });
    writeFileSync(join(box, 'state', 'brain-corpus.json'), JSON.stringify(
      toRecord({ missingCount, corpus: 5, missing: missingCount ? ['context/product/a.md'] : [] }, { at }),
    ));
  }

  it('sends the record once, then not again on later wakes while the answer is the same', async () => {
    refreshWrote(1, new Date().toISOString());
    const first = await wake();
    expect(first.stderr).not.toMatch(/FLOG/);
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe(`/repos/wealthcx01/arca/contents/${RECORD_PATH}`);
    expect(puts[0].body.branch).toBe('foundry-state');
    expect(JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8')).missingCount).toBe(1);

    // The refresh runs again five minutes later with the same answer. Nothing new is sent.
    refreshWrote(1, new Date(Date.now() + 5 * 60 * 1000).toISOString());
    await wake();
    await wake();
    expect(puts).toHaveLength(1);
  });

  it('sends again as soon as the answer changes', async () => {
    refreshWrote(1, new Date().toISOString());
    await wake();
    refreshWrote(0, new Date(Date.now() + 5 * 60 * 1000).toISOString());
    await wake();
    expect(puts).toHaveLength(2);
  });

  it('sends nothing, and reports no fault, when there is no whole record to send', async () => {
    // No record yet: the refresh has not finished a check on this box.
    const none = await wake();
    expect(none.err).toBeNull();
    // Half a record (a write cut off part way): not something to tell the studio, and not a fault.
    mkdirSync(join(box, 'state'), { recursive: true });
    writeFileSync(join(box, 'state', 'brain-corpus.json'), '{"version":1,"kind":"brain-co');
    const half = await wake();
    expect(half.err).toBeNull();
    expect(half.stderr).not.toMatch(/FLOG/);
    expect(puts).toHaveLength(0);
  });
});
