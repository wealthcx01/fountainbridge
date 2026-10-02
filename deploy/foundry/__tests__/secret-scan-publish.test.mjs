import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRoots, toRecord, publishRecord, exitCode, RECORD_PATH } from '../secret-scan.mjs';

/**
 * FB-206 — the box's half of a finding reaching the studio.
 *
 * FB-176's scanner said what it found to `journalctl`, on a box nobody logs into. This is the write
 * that puts it where somebody looks: `health/secret-scan.json` on the venture's `foundry-state` ref.
 *
 * The last block runs the REAL script, as the timer does, against a small local stand-in for
 * GitHub's contents API — so the exit codes, the environment it reads and the bytes it sends are
 * all checked as they actually happen, not as a unit test imagines them.
 */
const FAKE_PAT = `github_pat_${'1'.repeat(22)}_${'A'.repeat(59)}`;
const FAKE_LANE_TOKEN = `ghp_${'Z'.repeat(36)}`; // the token the box uses to WRITE; must never leak either
const SCRIPT = fileURLToPath(new URL('../secret-scan.mjs', import.meta.url));

let box;
const put = (rel, text) => {
  mkdirSync(join(box, rel, '..'), { recursive: true });
  writeFileSync(join(box, rel), text);
};
beforeEach(() => { box = mkdtempSync(join(tmpdir(), 'fb206-box-')); });
afterEach(() => { rmSync(box, { recursive: true, force: true }); });

/** A fetch that answers like GitHub's contents API, and remembers every call. */
function fakeGitHub({ refExists = true, existingSha = null, putStatus = 201 } = {}) {
  const calls = [];
  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetchImpl = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url, method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    if (url.includes('/git/ref/heads/foundry-state')) return refExists ? json(200, { ref: 'refs/heads/foundry-state' }) : json(404, { message: 'Not Found' });
    if (url.includes('/git/ref/heads/')) return json(200, { object: { sha: 'base-sha-1' } });
    if (url.endsWith('/git/refs') && method === 'POST') return json(201, {});
    if (url.includes('/contents/') && method === 'GET') return existingSha ? json(200, { sha: existingSha }) : json(404, { message: 'Not Found' });
    if (url.includes('/contents/') && method === 'PUT') return json(putStatus, putStatus < 300 ? { content: {} } : { message: 'Resource not accessible by personal access token' });
    return json(500, {});
  };
  return { calls, fetchImpl };
}

const decode = (b64) => JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

describe('the record the box writes (FB-206)', () => {
  it('goes to health/secret-scan.json on the state ref, with the finding and never the value', async () => {
    put('opt/foundry/lane/lane.env', `A=1\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    const record = toRecord(scanRoots([join(box, 'opt')]), { at: '2026-09-20T03:00:00Z', host: 'arca', roots: ['/opt/foundry'] });
    const gh = fakeGitHub();
    const sent = await publishRecord(record, { token: FAKE_LANE_TOKEN, repo: 'wealthcx01/arca', fetchImpl: gh.fetchImpl });
    expect(sent).toEqual({ ok: true, why: null });

    const write = gh.calls.find((c) => c.method === 'PUT');
    expect(write.url).toBe(`https://api.github.com/repos/wealthcx01/arca/contents/${RECORD_PATH}`);
    expect(write.body.branch).toBe('foundry-state');
    expect(write.body.sha, 'a first write carries no sha').toBeUndefined();
    const onRef = decode(write.body.content);
    expect(onRef.findingCount).toBe(1);
    expect(onRef.findings[0]).toEqual({ path: join(box, 'opt/foundry/lane/lane.env'), line: 2, what: 'a GitHub fine-grained token' });
    expect(JSON.stringify(write.body), 'the credential reached the record').not.toContain(FAKE_PAT);
    expect(Buffer.from(write.body.content, 'base64').toString('utf8')).not.toContain(FAKE_PAT);
  });

  it('is written on a clean scan too — a record that only appears on a finding cannot be told from a stopped scanner', async () => {
    put('opt/foundry/lane/lane.env', 'DAILY_BUDGET=8\n');
    const record = toRecord(scanRoots([join(box, 'opt')]), { at: '2026-09-20T03:00:00Z', host: 'arca', roots: ['/opt/foundry'] });
    const gh = fakeGitHub({ existingSha: 'old-sha' });
    expect((await publishRecord(record, { token: FAKE_LANE_TOKEN, repo: 'wealthcx01/arca', fetchImpl: gh.fetchImpl })).ok).toBe(true);
    const write = gh.calls.find((c) => c.method === 'PUT');
    expect(decode(write.body.content).findingCount).toBe(0);
    expect(write.body.sha, 'an update must name the file it replaces').toBe('old-sha');
    expect(write.body.message).toBe('health: credential scan (clean)');
  });

  it('starts the state ref from the base branch when nothing on this box has written to it yet', async () => {
    const record = toRecord({ findings: [], weak: [], problems: [] }, { at: '2026-09-20T03:00:00Z', host: 'x', roots: [] });
    const gh = fakeGitHub({ refExists: false });
    expect((await publishRecord(record, { token: FAKE_LANE_TOKEN, repo: 'wealthcx01/arca', base: 'main', fetchImpl: gh.fetchImpl })).ok).toBe(true);
    const made = gh.calls.find((c) => c.method === 'POST');
    expect(made.body).toEqual({ ref: 'refs/heads/foundry-state', sha: 'base-sha-1' });
    expect(gh.calls.some((c) => c.url.endsWith('/git/ref/heads/main'))).toBe(true);
  });

  it('says why it could not write, in words, and never with the token in them', async () => {
    const record = toRecord({ findings: [], weak: [], problems: [] }, { at: '2026-09-20T03:00:00Z', host: 'x', roots: [] });
    const gh = fakeGitHub({ putStatus: 403 });
    const sent = await publishRecord(record, { token: FAKE_LANE_TOKEN, repo: 'wealthcx01/arca', fetchImpl: gh.fetchImpl });
    expect(sent.ok).toBe(false);
    expect(sent.why).toContain('GitHub refused the write (403');
    expect(sent.why).not.toContain(FAKE_LANE_TOKEN);
  });

  it('refuses to guess when the box is not configured to report', async () => {
    const record = toRecord({ findings: [], weak: [], problems: [] }, { at: '2026-09-20T03:00:00Z', host: 'x', roots: [] });
    const gh = fakeGitHub();
    expect((await publishRecord(record, { token: '', repo: 'wealthcx01/arca', fetchImpl: gh.fetchImpl })).why).toContain('TICKET_GITHUB_TOKEN is not set');
    expect((await publishRecord(record, { token: FAKE_LANE_TOKEN, repo: '', fetchImpl: gh.fetchImpl })).why).toContain('REPO is not set');
    expect(gh.calls, 'it reached for GitHub without what it needs').toEqual([]);
  });

  it('exits on a credential first, then on a report that did not arrive', () => {
    expect(exitCode(2, true)).toBe(1);
    expect(exitCode(2, false), 'a failed report hid a credential').toBe(1);
    expect(exitCode(0, false), 'a clean scan nobody heard about exited as success').toBe(3);
    expect(exitCode(0, true)).toBe(0);
    expect(exitCode(0)).toBe(0);
  });
});

/** Run the real script, as the timer does, against a stand-in for GitHub on a local port. */
async function runAsTimer({ putStatus = 201, env = {} } = {}) {
  const received = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      received.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
      const send = (status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.url.includes('/git/ref/heads/')) return send(200, { ref: 'x', object: { sha: 's' } });
      if (req.method === 'GET') return send(404, { message: 'Not Found' });
      if (req.method === 'PUT') return send(putStatus, putStatus < 300 ? { content: {} } : { message: 'Bad credentials' });
      return send(500, {});
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const api = `http://127.0.0.1:${server.address().port}`;
  try {
    const child = spawn(process.execPath, [SCRIPT, '--publish', '--home', join(box, 'etc/foundry/credentials'), join(box, 'opt')], {
      env: { PATH: process.env.PATH, API: api, REPO: 'wealthcx01/arca', TICKET_GITHUB_TOKEN: FAKE_LANE_TOKEN, ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    const code = await new Promise((r) => child.on('close', r));
    return { code, stdout, stderr, received };
  } finally {
    server.close();
  }
}

describe('the script, run the way the timer runs it (FB-206)', () => {
  it('a planted token: exits 1, and the studio is told the file and kind but not the value', async () => {
    put('opt/foundry/lane/lane.env', `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    const run = await runAsTimer();
    expect(run.code).toBe(1);
    const write = run.received.find((r) => r.method === 'PUT');
    expect(write, 'the studio was never told').toBeTruthy();
    expect(write.url).toBe(`/repos/wealthcx01/arca/contents/${RECORD_PATH}`);
    expect(write.auth).toBe(`Bearer ${FAKE_LANE_TOKEN}`);
    const onRef = decode(write.body.content);
    expect(onRef.findings.map((f) => f.what)).toEqual(['a GitHub fine-grained token']);
    expect(JSON.stringify(run.received)).not.toContain(FAKE_PAT);
    expect(run.stdout + run.stderr).not.toContain(FAKE_PAT);
    expect(run.stdout).toContain('Told the studio');
  });

  it('a clean box still reports, and exits 0', async () => {
    put('opt/foundry/lane/lane.env', 'DAILY_BUDGET=8\n');
    const run = await runAsTimer();
    expect(run.code).toBe(0);
    expect(decode(run.received.find((r) => r.method === 'PUT').body.content).findingCount).toBe(0);
  });

  it('a clean box that cannot tell the studio exits 3 and says why, without the token', async () => {
    put('opt/foundry/lane/lane.env', 'DAILY_BUDGET=8\n');
    const run = await runAsTimer({ putStatus: 401 });
    expect(run.code).toBe(3);
    expect(run.stderr).toContain('COULD NOT TELL THE STUDIO');
    expect(run.stderr).toContain('Bad credentials');
    expect(run.stderr + run.stdout).not.toContain(FAKE_LANE_TOKEN);
  });

  it('scans the first root it is given when there is no --home', async () => {
    // Before FB-206 the root list dropped its first entry whenever `--home` was absent.
    put('opt/foundry/lane/lane.env', `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    const child = spawn(process.execPath, [SCRIPT, join(box, 'opt')], { env: { PATH: process.env.PATH } });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    const code = await new Promise((r) => child.on('close', r));
    expect(code).toBe(1);
    expect(out).toContain('1 credential found');
  });
});
