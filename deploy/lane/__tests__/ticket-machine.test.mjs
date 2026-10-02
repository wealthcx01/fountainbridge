import { describe, it, expect } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOT_MADE, TRIED_AND_FAILED, requestBody, workTicketOnMachine } from '../ticket-machine.mjs';
import { collectWork, redact, reportFinish, shellLine } from '../worker-call.mjs';

const LANE = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The venture box's side and the machine's side of a ticket machine (FB-239). The box can only ASK
 * the studio; the machine only collects its work and reports back. Nothing here reaches a network
 * beyond this test's own loopback server.
 */

const BOX_ENV = {
  TICKET_MACHINES: 'on', FOUNDRY_STUDIO_URL: 'https://studio.example', TICKET_MACHINE_LANE_KEY: 'lane-key-arca',
  LANE_ID: 'arca', REPO: 'wealthcx01/arca', BASE_BRANCH: 'main', LANE_DEPARTMENT: 'build', LANE_GATE: 'pr', PLAN_TIMEOUT: '600',
};

function fakeStudio(answers) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null });
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { calls, fetchImpl };
}

const run = (fetchImpl, extra = {}) => workTicketOnMachine({
  env: { ...BOX_ENV, ...extra }, slug: 'ARCA-061-x', ticketPath: 'docs/tickets/ARCA-061-x.md', fetchImpl,
  sleep: async () => {}, now: () => Date.parse('2026-10-02T09:00:00Z'),
});

describe('the venture box asks the studio; it never makes a machine itself', () => {
  it('asks with its lane key and nothing else, and sends no credential', async () => {
    const s = fakeStudio([
      { status: 201, body: { created: true, runId: 'aaaaaaaaaaaaaaa1', machine: 'fw-x', expiresAt: '2026-10-02T11:30:00Z' } },
      { status: 200, body: { done: true, ok: true, summary: 'worked', sessions: '', skills: ['review'] } },
    ]);
    const out = await run(s.fetchImpl, { TICKET_GITHUB_TOKEN: 'ghp_secret', CLAUDE_CODE_OAUTH_TOKEN: 'claude-secret', HCLOUD_TOKEN: 'h' });
    expect(out).toMatchObject({ code: 0, summary: 'worked' });
    expect(s.calls[0]).toMatchObject({ url: 'https://studio.example/api/machines', method: 'POST', auth: 'Bearer lane-key-arca' });
    expect(JSON.stringify(s.calls)).not.toMatch(/ghp_secret|claude-secret/);
    expect(s.calls[1].url).toBe('https://studio.example/api/machines/aaaaaaaaaaaaaaa1?venture=arca');
  });

  it('the request carries the ticket and the lane\'s settings', () => {
    expect(requestBody(BOX_ENV, 'ARCA-061-x', 'docs/tickets/ARCA-061-x.md')).toEqual({
      venture: 'arca', repo: 'wealthcx01/arca', baseBranch: 'main', ticketPath: 'docs/tickets/ARCA-061-x.md', slug: 'ARCA-061-x',
      department: 'build', gate: 'pr', requireProposal: false, stateRef: null, tunables: { PLAN_TIMEOUT: '600' },
    });
  });

  it.each([
    ['the budget is used', 402, 'This month\'s budget for temporary machines ($40.00) is used, so no machine was made.'],
    ['no budget was approved', 402, 'No monthly budget for temporary machines has been approved for this venture, so no machine was made.'],
    ['two are already working', 429, 'Your team already has 2 temporary machines working.'],
  ])('when %s, nothing is made, the studio\'s reason is passed on, and it is "not made" — not an attempt', async (_w, status, reason) => {
    const s = fakeStudio([{ status, body: { created: false, reason } }]);
    expect(await run(s.fetchImpl)).toEqual({ code: NOT_MADE, summary: reason });
    expect(s.calls).toHaveLength(1);
  });

  it('when the studio tried and the provider failed, it says so with its own code, which the box counts as a wake', async () => {
    const reason = 'The studio could not get a temporary machine for this ticket, so the work did not start.';
    const s = fakeStudio([{ status: 502, body: { created: false, reason } }]);
    expect(await run(s.fetchImpl)).toEqual({ code: TRIED_AND_FAILED, summary: reason });
    expect(TRIED_AND_FAILED).not.toBe(NOT_MADE);
  });

  it('a studio that cannot be reached is "not made", not a failed attempt', async () => {
    const s = fakeStudio([new Error('ECONNREFUSED')]);
    expect((await run(s.fetchImpl)).code).toBe(NOT_MADE);
  });

  it('without a studio address or key it asks nothing', async () => {
    const s = fakeStudio([]);
    expect((await run(s.fetchImpl, { TICKET_MACHINE_LANE_KEY: '' })).code).toBe(NOT_MADE);
    expect(s.calls).toHaveLength(0);
  });

  it('a run that did not reach its end is a failure (code 1), with the studio\'s sentence', async () => {
    const s = fakeStudio([
      { status: 201, body: { created: true, runId: 'aaaaaaaaaaaaaaa1', machine: 'fw-x', expiresAt: '2026-10-02T11:30:00Z' } },
      { status: 200, body: { done: false } },
      { status: 200, body: { done: true, ok: false, summary: 'stopped while setting itself up' } },
    ]);
    expect(await run(s.fetchImpl)).toMatchObject({ code: 1, summary: 'stopped while setting itself up' });
  });

  it('keeps waiting through a lost answer, and gives up as a failure only after the deadline', async () => {
    let t = Date.parse('2026-10-02T09:00:00Z');
    const s = fakeStudio([
      { status: 201, body: { created: true, runId: 'aaaaaaaaaaaaaaa1', machine: 'fw-x', expiresAt: '2026-10-02T09:01:00Z' } },
      new Error('reset'), new Error('reset'), new Error('reset'),
    ]);
    const out = await workTicketOnMachine({
      env: BOX_ENV, slug: 'ARCA-061-x', ticketPath: 'docs/tickets/ARCA-061-x.md', fetchImpl: s.fetchImpl,
      sleep: async () => { t += 10 * 60_000; }, now: () => t,
    });
    expect(out.code).toBe(1);
    expect(out.summary).toMatch(/did not report back before its deadline/);
    expect(s.calls.length).toBe(3);
  });
});

describe('the switch on the box', () => {
  it('off: asks nothing, makes nothing, and it is "not made"', () => {
    let code = 0;
    let out = '';
    try {
      out = execFileSync('node', [join(LANE, 'ticket-machine.mjs'), 'run', 'arca-61', 'docs/tickets/arca-61.md'], {
        env: { PATH: process.env.PATH }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) { code = e.status; out = e.stdout; }
    expect({ code, out }).toEqual({ code: NOT_MADE, out: 'Temporary machines are switched off for this venture, so nothing was made.' });
  });
});

const MACHINE_ENV = {
  FOUNDRY_STUDIO_URL: 'https://studio.example', FOUNDRY_RUN_ID: 'aaaaaaaaaaaaaaa1', FOUNDRY_RUN_TOKEN: 'run-token-1234',
  FOUNDRY_VENTURE: 'arca',
};

describe('the machine collects its work and reports back over HTTPS (this replaced SSH)', () => {
  it('collects with its run token, once, and writes a safe env file', async () => {
    const s = fakeStudio([{ status: 200, body: { env: { REPO: 'wealthcx01/arca', TICKET_GITHUB_TOKEN: "it's-a-token" } } }]);
    const text = await collectWork(MACHINE_ENV, s.fetchImpl);
    expect(s.calls[0]).toMatchObject({ url: 'https://studio.example/api/machines/aaaaaaaaaaaaaaa1/start', method: 'POST', auth: 'Bearer run-token-1234', body: { venture: 'arca' } });
    expect(text).toBe("REPO='wealthcx01/arca'\nTICKET_GITHUB_TOKEN='it'\\''s-a-token'\n");
  });

  it('a refusal stops the machine with the studio\'s reason', async () => {
    const s = fakeStudio([{ status: 409, body: { error: 'this run has already collected its work' } }]);
    await expect(collectWork(MACHINE_ENV, s.fetchImpl)).rejects.toThrow(/already collected/);
  });

  it('will not talk to a plain-http studio, or a run id that is not one', async () => {
    await expect(collectWork({ ...MACHINE_ENV, FOUNDRY_STUDIO_URL: 'http://studio.example' }, fakeStudio([]).fetchImpl)).rejects.toThrow(/https/);
    await expect(collectWork({ ...MACHINE_ENV, FOUNDRY_RUN_ID: '../reap' }, fakeStudio([]).fetchImpl)).rejects.toThrow(/run id/);
  });

  it('refuses a value with a line break rather than let it write a second variable', () => {
    expect(() => shellLine('A', 'x\nB=y')).toThrow(/line break/);
    expect(() => shellLine('bad name', 'x')).toThrow(/variable name/);
  });

  it('reports the end with its stage and log, with every credential it holds hidden', async () => {
    const s = fakeStudio([{ status: 200, body: { recorded: true } }]);
    const env = { ...MACHINE_ENV, TICKET_GITHUB_TOKEN: 'ghp_0123456789abcdef' };
    await reportFinish(env, {
      exit: '128', stage: 'setup', skills: '', sessions: '',
      log: 'fetching\nfatal: could not read from https://x-access-token:ghp_0123456789abcdef@github.com/wealthcx01/arca.git',
    }, s.fetchImpl, async () => {});
    expect(s.calls[0].body).toMatchObject({ venture: 'arca', exit: 128, stage: 'setup' });
    expect(s.calls[0].body.log).toContain('fatal: could not read');
    expect(JSON.stringify(s.calls[0].body)).not.toContain('ghp_0123456789abcdef');
    expect(JSON.stringify(s.calls[0].body)).not.toContain('run-token-1234');
  });

  it('retries a report that did not land, then gives up loudly', async () => {
    const s = fakeStudio([new Error('reset'), { status: 500, body: {} }, { status: 200, body: {} }]);
    await expect(reportFinish(MACHINE_ENV, { exit: 0, stage: 'done' }, s.fetchImpl, async () => {})).resolves.toBe(true);
    const never = fakeStudio([new Error('a'), new Error('b'), new Error('c')]);
    await expect(reportFinish(MACHINE_ENV, { exit: 0, stage: 'done' }, never.fetchImpl, async () => {})).rejects.toThrow(/could not tell the studio/);
  });

  it('hides the token inside a clone address even when it is not one it knows', () => {
    expect(redact('https://x-access-token:abc@github.com/x', {})).toBe('https://x-access-token:[hidden]@github.com/x');
  });
});

describe('worker-run.sh, run for real against a stand-in studio', () => {
  it('a machine that fails while setting itself up reports "setup", the failing step and a non-zero exit — never success', async () => {
    const reports = [];
    const server = createServer((req, res) => {
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => {
        const body = data ? JSON.parse(data) : {};
        if (req.url.endsWith('/start')) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ env: { REPO: 'wealthcx01/arca', BASE_BRANCH: 'main', TICKET_SLUG: 'A', TICKET_PATH: 'docs/tickets/A.md', TICKET_GITHUB_TOKEN: 'ghp_never_leaves_0000' } }));
        } else {
          reports.push(body);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{"recorded":true}');
        }
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    // A stand-in apt-get that fails the way a busy or broken package mirror does.
    const scratch = mkdtempSync(join(tmpdir(), 'worker-run-'));
    const bin = join(scratch, 'bin');
    execFileSync('mkdir', ['-p', bin]);
    writeFileSync(join(bin, 'apt-get'), '#!/bin/sh\necho "E: Could not get lock /var/lib/dpkg/lock-frontend" >&2\nexit 100\n');
    chmodSync(join(bin, 'apt-get'), 0o755);

    const code = await new Promise((resolve) => {
      const child = spawn('bash', [join(LANE, 'worker-run.sh')], {
        env: {
          PATH: `${bin}:${process.env.PATH}`, HOME: scratch, FOUNDRY_RUN_DIR: join(scratch, 'run'),
          FOUNDRY_STUDIO_URL: `http://127.0.0.1:${port}`, FOUNDRY_RUN_ID: 'aaaaaaaaaaaaaaa1', FOUNDRY_RUN_TOKEN: 'run-token-1234', FOUNDRY_VENTURE: 'arca',
        },
        stdio: 'ignore',
      });
      child.on('close', resolve);
    });
    server.close();

    expect(code).not.toBe(0);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ venture: 'arca', stage: 'setup' });
    expect(reports[0].exit).not.toBe(0);
    expect(reports[0].log).toMatch(/installing the lane's tools/);
    expect(reports[0].log).toMatch(/Could not get lock/);
    expect(JSON.stringify(reports[0])).not.toContain('ghp_never_leaves_0000');
    // The work was collected into a file only its owner can read.
    expect(readFileSync(join(scratch, 'run', 'run.env'), 'utf8')).toContain("REPO='wealthcx01/arca'");
  }, 30_000);
});

describe('worker-run.sh, when the supervisor ends', () => {
  /**
   * Runs the real worker-run.sh, from a scratch copy of the lane with a stand-in supervisor, against a
   * stand-in studio. Set-up succeeds (stand-in apt-get, git and claude), so what is under test is only
   * what the script makes of the supervisor's ending.
   */
  async function workWith(supervisorBody) {
    const reports = [];
    const server = createServer((req, res) => {
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        if (req.url.endsWith('/start')) {
          res.end(JSON.stringify({ env: { REPO: 'wealthcx01/arca', BASE_BRANCH: 'main', TICKET_SLUG: 'ARCA-061-x', TICKET_PATH: 'docs/tickets/ARCA-061-x.md', TICKET_GITHUB_TOKEN: 'ghp_never_leaves_0000' } }));
        } else {
          reports.push(JSON.parse(data));
          res.end('{"recorded":true}');
        }
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));

    const scratch = mkdtempSync(join(tmpdir(), 'worker-end-'));
    const lane = join(scratch, 'lane');
    const bin = join(scratch, 'bin');
    execFileSync('mkdir', ['-p', lane, bin, join(scratch, '.claude', 'skills', 'gstack')]);
    for (const f of ['worker-run.sh', 'worker-call.mjs']) writeFileSync(join(lane, f), readFileSync(join(LANE, f)));
    writeFileSync(join(lane, 'skills-used.mjs'), '');
    writeFileSync(join(lane, 'supervisor.sh'), `#!/usr/bin/env bash\n${supervisorBody}\n`);
    const stub = (name, body) => { writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, name), 0o755); };
    stub('apt-get', 'exit 0');
    stub('claude', 'exit 0');
    // `git clone ... <dir>` makes the repository with the ticket in it; every other git call succeeds.
    stub('git', 'if [ "$1" = clone ]; then for a; do d="$a"; done; mkdir -p "$d/docs/tickets"; echo "# ticket" > "$d/docs/tickets/ARCA-061-x.md"; fi; exit 0');

    const code = await new Promise((resolve) => {
      const child = spawn('bash', [join(lane, 'worker-run.sh')], {
        env: {
          PATH: `${bin}:${process.env.PATH}`, HOME: scratch, FOUNDRY_RUN_DIR: join(scratch, 'run'),
          FOUNDRY_STUDIO_URL: `http://127.0.0.1:${server.address().port}`, FOUNDRY_RUN_ID: 'aaaaaaaaaaaaaaa1', FOUNDRY_RUN_TOKEN: 'run-token-1234', FOUNDRY_VENTURE: 'arca',
        },
        stdio: 'ignore',
      });
      child.on('close', resolve);
    });
    server.close();
    expect(reports).toHaveLength(1);
    return { code, report: reports[0] };
  }

  it('a supervisor that dies before writing any run report (no Claude credential) is "work", never "done"', async () => {
    const { code, report } = await workWith('echo "need Claude auth" >&2; exit 1');
    expect(code).toBe(1);
    expect(report).toMatchObject({ stage: 'work', exit: 1 });
    expect(report.log).toMatch(/before your team wrote down how the ticket ended/);
  }, 30_000);

  it('a "working" report is not an ending: a supervisor that dies after it is still "work"', async () => {
    const { report } = await workWith('echo "ARCA-061-x working" >> "$RUNREPORT_LOG"; exit 1');
    expect(report).toMatchObject({ stage: 'work', exit: 1 });
  }, 30_000);

  it('a supervisor that wrote down that the ticket failed, then exited 1, reached its end: "done"', async () => {
    const { code, report } = await workWith('echo "ARCA-061-x working" >> "$RUNREPORT_LOG"; echo "ARCA-061-x failed" >> "$RUNREPORT_LOG"; exit 1');
    expect(code).toBe(1);
    expect(report).toMatchObject({ stage: 'done', exit: 1 });
  }, 30_000);

  it('a supervisor that exits 0 reached its end', async () => {
    const { code, report } = await workWith('exit 0');
    expect(code).toBe(0);
    expect(report).toMatchObject({ stage: 'done', exit: 0 });
  }, 30_000);
});

describe('write_runreport tells worker-run.sh which reports it really wrote', () => {
  // The real write_runreport from foundry-lib.sh, with GitHub stood in for: the record is built by the
  // real runreport-record.mjs, and only the PUT's answer is invented.
  function writeReport(putAnswer, withLog = true) {
    const scratch = mkdtempSync(join(tmpdir(), 'runreport-log-'));
    const log = join(scratch, 'written');
    const script = `
      set -euo pipefail
      . "${join(LANE, 'foundry-lib.sh')}"
      ensure_state_ref() { return 0; }
      gh_api() { if [ "\${1:-}" = -X ]; then echo '${putAnswer}'; else echo '{}'; fi; }
      write_runreport ARCA-061-x failed "It could not pass its own tests." || true
    `;
    execFileSync('bash', ['-c', script], {
      env: { PATH: process.env.PATH, HOME: scratch, REPO: 'wealthcx01/arca', STATE_REF: 'foundry-state', LANE_ID: 'arca', ...(withLog ? { RUNREPORT_LOG: log } : {}) },
      stdio: 'ignore',
    });
    try { return readFileSync(log, 'utf8'); } catch { return null; }
  }

  it('adds "<slug> <status>" when GitHub accepted the report', () => {
    expect(writeReport('{"content":{"path":"x"}}')).toBe('ARCA-061-x failed\n');
  });

  it('adds nothing when GitHub refused it — a report that was not written is not an ending', () => {
    expect(writeReport('{"message":"Bad credentials"}') ?? '').toBe('');
  });

  it('writes nowhere when RUNREPORT_LOG is not set, as on a venture\'s own box', () => {
    expect(writeReport('{"content":{"path":"x"}}', false)).toBeNull();
  });
});
