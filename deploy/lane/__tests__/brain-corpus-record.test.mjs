import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  function setUp(tracked, pages) {
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
      `  list) printf '%s\\t-\\n' ${pages.map((p) => `'${p}'`).join(' ')} ;;`,
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
});
