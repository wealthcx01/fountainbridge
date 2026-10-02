// The real executor, against real ActiveGraph, end to end (FB-171).
//
// No mocks of the parts that matter: this runs deploy/executor/executor.mjs as a separate process,
// which calls deploy/activegraph/foundry_graph.py on a real ActiveGraph 1.10.0, which writes a real
// SQLite event store. Only GitHub is stood in for, by a small local server holding the same files
// the real refs hold.
//
// It needs the local ActiveGraph (`make activegraph-test` builds it in .ag-venv). Without it these
// tests are skipped in the ordinary suite — and FAIL in CI's ActiveGraph job, which sets
// FB171_REQUIRE_ACTIVEGRAPH=1, so a skip can never quietly stand in for a pass where it counts.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { execFile, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expectedAttestation, signEvent } from '../executor-lib.mjs';

const ROOT = resolve(import.meta.dirname, '../../..');
const PYTHON = process.env.ACTIVEGRAPH_PYTHON || join(ROOT, '.ag-venv/bin/python');
const HAVE = existsSync(PYTHON);
if (!HAVE && process.env.FB171_REQUIRE_ACTIVEGRAPH === '1') {
  throw new Error(`FB171_REQUIRE_ACTIVEGRAPH=1 but there is no ActiveGraph Python at ${PYTHON}`);
}

const SECRET = 'e2e-secret-not-the-real-one';
const REPO = 'wealthcx01/arca-marketing';
const AG_REPO = 'wealthcx01/fountainbridge';
const SHA = 'e2eda1f8f77aaebef64138f681fde43bf1b77e48';
const FOUNDER = 'founder@bruntsfield.capital';

/** A tiny stand-in for the GitHub contents API: a map of `repo:path` to text. */
function fakeGitHub(files) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/contents\/(.*)$/);
    if (!m) { res.writeHead(404).end(); return; }
    const [, repo, rawPath] = m;
    const path = decodeURI(rawPath);
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const { content } = JSON.parse(body);
        files.set(`${repo}:${path}`, { text: Buffer.from(content, 'base64').toString('utf8'), sha: `sha-${files.size}` });
        res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
      });
      return;
    }
    const exact = files.get(`${repo}:${path}`);
    if (exact) {
      res.writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ content: Buffer.from(exact.text).toString('base64'), sha: exact.sha, path }));
      return;
    }
    const prefix = `${repo}:${path}/`;
    const children = new Map();
    for (const key of files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const name = rest.split('/')[0];
      children.set(name, { name, path: `${path}/${name}`, type: rest.includes('/') ? 'dir' : 'file' });
    }
    if (children.size === 0) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify([...children.values()]));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function event(seq, type, kind, who, at, data) {
  const e = { v: 1, seq, venture: 'arca', repo: 'arca-marketing', id: 'send-001', type, at, actor: { kind, id: who }, data };
  return { ...e, attestation: signEvent(createHmac, SECRET, e) };
}

/** Build the graph file from these events, then slip an unsigned event into it, as a hand edit would. */
function damageStore(store, events) {
  const script = [
    'import json, sys',
    `sys.path.insert(0, ${JSON.stringify(join(ROOT, 'deploy/activegraph'))})`,
    'import foundry_graph as fg',
    'from activegraph import Event',
    `g = fg.FoundryGraph("arca", ${JSON.stringify(SECRET)}, ${JSON.stringify(store)})`,
    'g.ingest([json.loads(l) for l in sys.stdin if l.strip()])',
    'key = g.graph.objects("approval")[0].data["key"]',
    'junk = {"v": 1, "seq": 3, "venture": "arca", "repo": "arca-marketing", "id": "send-001", "type": "action.failed",',
    '        "at": "2026-09-03T09:40:00Z", "actor": {"kind": "executor", "id": "foundry-executor"}}',
    'g.graph.emit(Event(id=g.graph.ids.event(), type="action.failed", payload={"approval": key, "foundry_event": junk},',
    '                   actor="executor:foundry-executor", timestamp="2026-09-03T09:40:00Z"))',
  ].join('\n');
  const r = spawnSync(PYTHON, ['-c', script], { input: events.map((e) => JSON.stringify(e)).join('\n'), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`could not damage the store: ${r.stderr}`);
}

function runExecutor(port, store, mode, api = `http://127.0.0.1:${port}`) {
  return new Promise((ok) => {
    execFile('node', [join(ROOT, 'deploy/executor/executor.mjs')], {
      env: {
        PATH: process.env.PATH,
        EXECUTOR_GITHUB_API_URL: api,
        REPO, EXECUTOR_GITHUB_TOKEN: 'fake', FOUNDRY_APPROVAL_SECRET: SECRET, APPROVER_IDENTITIES: FOUNDER,
        ACTIVEGRAPH_REPO: AG_REPO, VENTURE_ID: 'arca',
        ACTIVEGRAPH_GATE: mode, ACTIVEGRAPH_STORE: store, ACTIVEGRAPH_PYTHON: PYTHON,
      },
      timeout: 60_000,
    }, (err, stdout, stderr) => ok({ code: err?.code ?? 0, log: `${stdout}${stderr}` }));
  });
}

describe.skipIf(!HAVE)('the executor asks real ActiveGraph before anything goes out', () => {
  let files; let server; let dir; let store;

  beforeEach(async () => {
    files = new Map();
    server = await fakeGitHub(files);
    dir = mkdtempSync(join(tmpdir(), 'fb171-'));
    store = join(dir, 'arca.db');
    // What a lane proposes, and what the studio writes when the founder clicks Approve.
    files.set(`${REPO}:approvals/send-001/proposal.json`, { text: JSON.stringify({ id: 'send-001', action_type: 'send', summary: 'Launch email' }), sha: SHA });
  });
  afterEach(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

  const put = (path, obj) => files.set(path, { text: JSON.stringify(obj), sha: `sha-${files.size}` });
  const studioGrant = () => put(`${REPO}:approvals/send-001/grant.json`, {
    id: 'send-001', repo: REPO, decision: 'granted', approver: FOUNDER, proposal_sha: SHA,
    attestation: expectedAttestation(createHmac, SECRET, REPO, 'send-001', SHA, FOUNDER),
  });
  const record = (e) => put(`${AG_REPO}:activegraph/arca/arca-marketing/send-001/${String(e.seq).padStart(4, '0')}-${e.type}.json`, e);
  const outcome = () => {
    const ex = files.get(`${REPO}:approvals/send-001/execution.json`);
    return ex ? JSON.parse(ex.text).status : 'nothing written';
  };

  it('sends when a person approved it and ActiveGraph holds that approval', async () => {
    studioGrant();
    record(event(1, 'approval.proposed', 'agent', 'foundry-lane', '2026-09-03T09:22:46.843Z', { proposal_sha: SHA }));
    record(event(2, 'approval.granted', 'human', FOUNDER, '2026-09-03T09:23:10.000Z', { proposal_sha: SHA }));
    const { code, log } = await runExecutor(server.address().port, store, 'enforce');
    expect(code, log).toBe(0);
    expect(outcome(), log).toBe('executed');
  });

  it('refuses an external action ActiveGraph has no approval for, even with a valid grant file', async () => {
    // The ungated case: a correctly signed grant.json, but nothing on the record. Under enforce,
    // nothing goes out — it waits, and says why.
    studioGrant();
    const { log } = await runExecutor(server.address().port, store, 'enforce');
    expect(outcome(), log).toBe('nothing written');
    expect(log).toMatch(/ActiveGraph does not have this grant yet/);
  });

  it('refuses a send the founder refused, even if a grant file appears afterwards (FB-183)', async () => {
    studioGrant();
    record(event(1, 'approval.proposed', 'agent', 'foundry-lane', '2026-09-03T09:22:46.843Z', { proposal_sha: SHA }));
    record(event(2, 'approval.rejected', 'human', FOUNDER, '2026-09-03T09:23:05.000Z', { proposal_sha: SHA, note: 'No.' }));
    const { log } = await runExecutor(server.address().port, store, 'enforce');
    expect(outcome(), log).toBe('rejected');
    expect(log).toMatch(/refused by founder@bruntsfield.capital/);
  });

  it('refuses a grant file the lane wrote, even when ActiveGraph holds a real approval', async () => {
    // ActiveGraph can only ever add a "no". Here it says yes (the founder really approved), and the
    // grant file is a lane's forgery: nothing goes out, in either mode that asks ActiveGraph.
    put(`${REPO}:approvals/send-001/grant.json`, { id: 'send-001', approver: FOUNDER, proposal_sha: SHA, attestation: 'f'.repeat(64) });
    record(event(1, 'approval.proposed', 'agent', 'foundry-lane', '2026-09-03T09:22:46.843Z', { proposal_sha: SHA }));
    record(event(2, 'approval.granted', 'human', FOUNDER, '2026-09-03T09:23:10.000Z', { proposal_sha: SHA }));

    const shadow = await runExecutor(server.address().port, store, 'shadow');
    expect(outcome(), shadow.log).toBe('rejected');
    // Proof that ActiveGraph was asked and said yes, and that its yes did not carry the send.
    expect(shadow.log).toMatch(/the grant file says no; ActiveGraph says approved by founder@bruntsfield.capital/);

    files.delete(`${REPO}:approvals/send-001/execution.json`);
    rmSync(store, { force: true });
    const enforce = await runExecutor(server.address().port, store, 'enforce');
    expect(outcome(), enforce.log).toBe('rejected');
    expect(enforce.log).toMatch(/attestation is missing or invalid/);
    expect(existsSync(store), 'ActiveGraph was asked').toBe(true);
  });

  it('waits, rather than refusing for good, when the graph file has been written to by hand', async () => {
    // The founder really approved this. Someone then wrote into the executor's graph file. The file
    // is only a copy of git, so the executor must wait — not record the real approval as rejected,
    // which it would never revisit. Deleting the file lets the next pass rebuild it and send.
    studioGrant();
    const proposedEv = event(1, 'approval.proposed', 'agent', 'foundry-lane', '2026-09-03T09:22:46.843Z', { proposal_sha: SHA });
    const grantedEv = event(2, 'approval.granted', 'human', FOUNDER, '2026-09-03T09:23:10.000Z', { proposal_sha: SHA });
    record(proposedEv);
    record(grantedEv);
    damageStore(store, [proposedEv, grantedEv]);

    const first = await runExecutor(server.address().port, store, 'enforce');
    expect(outcome(), first.log).toBe('nothing written');
    expect(first.log).toMatch(/someone wrote to it directly/);
    expect(first.log).toMatch(/trying again next pass/);

    rmSync(store, { force: true });
    const second = await runExecutor(server.address().port, store, 'enforce');
    expect(outcome(), second.log).toBe('executed');
  });

  it('will not start if its GitHub address points anywhere but GitHub or this machine', async () => {
    studioGrant();
    const { code, log } = await runExecutor(server.address().port, store, 'off', 'https://example.com');
    expect(code, log).toBe(2);
    expect(log).toMatch(/FAIL-CLOSED: EXECUTOR_GITHUB_API_URL/);
    expect(outcome()).toBe('nothing written');
  });

  it('with the gate off, behaves exactly as before FB-171', async () => {
    studioGrant();
    const { log } = await runExecutor(server.address().port, store, 'off');
    expect(outcome(), log).toBe('executed');
    expect(existsSync(store)).toBe(false);
  });

  it('in shadow, sends on the grant file alone but says ActiveGraph disagreed', async () => {
    studioGrant();
    const { log } = await runExecutor(server.address().port, store, 'shadow');
    expect(outcome(), log).toBe('executed');
    expect(log).toMatch(/SHADOW DISAGREEMENT/);
  });
});
