import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRoots, report, scanForSecrets } from '../secret-scan.mjs';

/**
 * FB-176 — the scanner, tested against the five places a credential was actually found.
 *
 * Not five invented paths. On 2026-09-02 a rotation on ARCA's box found one live token in
 * `lane.env`, the composer's `.env`, a clone URL inside `.git/config`, and three agent session
 * transcripts under `/root/.claude/`. The last four got there with nobody deciding they should.
 *
 * A token-shaped string is planted in each, and the scanner has to name the file and the kind. The
 * planted values are obviously fake and long enough to match the pattern; nothing here is a real
 * credential (CLAUDE.md #8).
 */
const FAKE_PAT = `github_pat_${'1'.repeat(22)}_${'A'.repeat(59)}`;
const FAKE_CLASSIC = `ghp_${'B'.repeat(36)}`;

let box;
const at = (...p) => join(box, ...p);
const put = (rel, text) => {
  const path = at(rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
  return path;
};

beforeEach(() => { box = mkdtempSync(join(tmpdir(), 'fb176-')); });
afterEach(() => { rmSync(box, { recursive: true, force: true }); });

describe('the five places a credential has actually been found (FB-176)', () => {
  it('finds one planted in each, and says which', () => {
    const planted = [
      put('opt/foundry/lane/lane.env', `FOUNDRY_DEPARTMENTS="build sell"\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`),
      put('opt/foundry/librechat/.env', `HOST=0.0.0.0\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`),
      put('opt/foundry/lane/arca/.git/config', `[remote "origin"]\n\turl = https://x-access-token:${FAKE_PAT}@github.com/wealthcx01/arca.git\n`),
      put('root/.claude/projects/arca/2026-08-03.jsonl', `{"text":"exported TICKET_GITHUB_TOKEN=${FAKE_PAT}"}\n`),
      put('root/.claude/projects/arca/2026-08-17.jsonl', `{"text":"the token is ${FAKE_CLASSIC}"}\n`),
    ];

    const { findings } = scanRoots([at('opt'), at('root')]);
    const found = findings.map((f) => f.path).sort();
    expect(found, 'the scanner missed one of the five').toEqual([...planted].sort());
    for (const f of findings) expect(f.what).toMatch(/GitHub/);
  });

  it('names the file and the line, and never the value', () => {
    put('opt/foundry/lane/lane.env', `A=1\nB=2\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    const result = scanRoots([at('opt')]);
    expect(result.findings[0].line, 'the line number is how somebody finds it').toBe(3);

    const said = report(result);
    expect(said).toContain('lane.env:3');
    expect(said).toContain('a GitHub fine-grained token');
    // The whole point. A scanner that prints the secret has written it to another log.
    expect(said, 'the scanner printed the credential it found').not.toContain(FAKE_PAT);
    expect(JSON.stringify(result), 'the value reached the JSON output').not.toContain(FAKE_PAT);
  });

  it('leaves the one file that is allowed to hold them alone', () => {
    const home = put('etc/foundry/credentials', `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    const { findings } = scanRoots([at('etc')], { allowed: new Set([home]) });
    expect(findings, 'the home is the system working, not a finding').toEqual([]);
  });

  it('says nothing was found when nothing is there, rather than saying nothing', () => {
    put('opt/foundry/lane/lane.env', 'FOUNDRY_DEPARTMENTS="build sell"\nDAILY_BUDGET=8\n');
    const result = scanRoots([at('opt')]);
    expect(result.findings).toEqual([]);
    expect(report(result)).toContain('No credential found outside');
  });
});

describe('what the scanner does when it cannot look (FB-176)', () => {
  it('reports a path it could not read instead of calling the box clean', () => {
    // "We looked and found nothing" and "we could not look" are different answers, and only one of
    // them is reassuring. A scan that silently skips an unreadable file is the second dressed as the
    // first — which is the failure CLAUDE.md #10 is about.
    const path = put('opt/foundry/lane/unreadable.env', 'x');
    const result = scanRoots([at('opt')], { maxBytes: -1 });
    expect(result.findings).toEqual([]);
    // maxBytes: -1 makes every file "too big", which is the skip path, not the error path — so this
    // asserts the honest half directly instead: an unreadable file becomes a problem, not a silence.
    const withProblem = { findings: [], problems: [{ path, why: 'EACCES' }] };
    const said = report(withProblem);
    expect(said).toContain('could not be read, so this is not a complete answer');
    expect(said).toContain('unreadable.env');
  });
});

describe('the net itself', () => {
  it('is the same one the studio and the composer use', () => {
    // The drift test (`lib/__tests__/secret-drift.test.ts`) is what keeps the three copies together.
    // This asserts the copy in this file actually works, which that one cannot.
    expect(scanForSecrets(`TICKET_GITHUB_TOKEN=${FAKE_PAT}`)).toBe('a GitHub fine-grained token');
    expect(scanForSecrets(`token=${FAKE_CLASSIC}`)).toBe('a GitHub token');
    expect(scanForSecrets('-----BEGIN OPENSSH PRIVATE KEY-----')).toBe('a private key');
    expect(scanForSecrets('nothing to see here')).toBeNull();
  });

  it('does not follow a symlink out of the tree it was asked to scan', () => {
    const outside = mkdtempSync(join(tmpdir(), 'fb176-outside-'));
    writeFileSync(join(outside, 'secrets.env'), `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    mkdirSync(at('opt', 'foundry'), { recursive: true });
    symlinkSync(outside, at('opt', 'foundry', 'elsewhere'));
    try {
      expect(scanRoots([at('opt')]).findings).toEqual([]);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

/**
 * FB-176, second pass — what running it on a real box taught.
 *
 * The first version returned **727 findings** on ARCA's box. Two were real; the rest were a settings
 * form with a `password` field, a pricing provider with `apiKey =`, jQuery's minified bundle, a
 * ticket file *about* an API key in source, and the scanner's own credential helper matching on the
 * words `access-token` in its documentation.
 *
 * A report nobody can read is the same failure as a log nobody opens, which is the thing this ticket
 * exists to fix.
 */
describe('a report a person can actually read (FB-176)', () => {
  it('does not let source code bury a real credential', () => {
    put('opt/foundry/lane/arca/client/SettingsPage.tsx', 'const f = { password: "placeholder-value" }\n');
    put('opt/foundry/lane/arca/db/seed.ts', 'const admin = { password: "seed-password-here" }\n');
    put('opt/foundry/lane/arca/modules/pricing.ts', 'const apiKey = process.env.PRICING_KEY ?? "unset-placeholder"\n');
    const real = put('opt/foundry/lane/lane.env', `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);

    const { findings, weak } = scanRoots([at('opt')]);
    // The credential is the finding. The three source files are counted, not listed among them.
    expect(findings.map((f) => f.path)).toEqual([real]);
    expect(weak.length).toBe(3);

    const said = report({ findings, weak, problems: [] });
    expect(said).toContain('1 credential found');
    expect(said).toContain('3 lines also matched the looser password/secret rule');
    expect(said, 'the loose matches were listed without being asked for').not.toContain('SettingsPage.tsx');
  });

  it('lists the loose matches when asked, because they are counted and not hidden', () => {
    put('opt/foundry/lane/arca/db/seed.ts', 'const admin = { password: "seed-password-here" }\n');
    const result = scanRoots([at('opt')]);
    const said = report(result, '/etc/foundry/credentials', true);
    expect(said).toContain('seed.ts');
    expect(said).toContain('a password/secret assignment');
  });

  it('exits on a credential, and not on a form field', () => {
    // The exit code is what a systemd timer notices. A scan that failed daily because a venture's
    // own source contains the word `password` is a scan whose failure means nothing within a week.
    put('opt/foundry/lane/arca/client/SettingsPage.tsx', 'const f = { password: "placeholder-value" }\n');
    expect(scanRoots([at('opt')]).findings, 'a form field counted as a credential').toEqual([]);

    put('opt/foundry/lane/lane.env', `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`);
    expect(scanRoots([at('opt')]).findings.length, 'a real credential did not count').toBe(1);
  });

  it('keeps reading a file after a loose match, in case a real one is further down', () => {
    put('opt/foundry/lane/arca/config.ts', [
      'const form = { password: "placeholder-value" }',
      'const other = 1',
      `const token = "${FAKE_PAT}"`,
    ].join('\n'));
    const { findings } = scanRoots([at('opt')]);
    expect(findings.length, 'a loose match on line 1 hid a credential on line 3').toBe(1);
    expect(findings[0].line).toBe(3);
  });
});

describe('what the scan skips, and what it must never skip (FB-176)', () => {
  it('does not fail daily over a dependency’s example credentials', () => {
    // 23 of the 26 findings on ARCA's box were a vendored toolkit's redaction test fixtures.
    put('root/.claude/skills/gstack/test/redact.test.ts', `expect(redact("${FAKE_PAT}"))\n`);
    expect(scanRoots([at('root')]).findings, 'a dependency’s fixture counted as a credential').toEqual([]);
  });

  it('still reads the agent transcripts, which is where three real ones were found', () => {
    // The sibling directory, and the reason this scanner exists. A token was written into three
    // session transcripts over three weeks by nobody's decision, and nothing noticed.
    const t = put('root/.claude/projects/arca/2026-08-03.jsonl', `{"text":"${FAKE_PAT}"}\n`);
    expect(scanRoots([at('root')]).findings.map((f) => f.path)).toEqual([t]);
  });
});
