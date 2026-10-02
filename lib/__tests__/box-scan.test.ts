import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import {
  SCAN_STALE_MS,
  findingLine,
  parseScanRecord,
  scanSentence,
  scanState,
  scanTone,
  SCAN_RECORD_PATH,
} from '../box-scan';
import { loadVentureScan, readScanText } from '../box-scan-load';
import type { VentureSummary } from '../ventures';
// @ts-expect-error — a plain .mjs on the box, with no types of its own
import { scanRoots, toRecord, RECORD_PATH, RECORD_LIST_CAP } from '../../deploy/foundry/secret-scan.mjs';

/**
 * FB-206 — the studio's half of a finding on a venture box reaching the studio.
 *
 * The records here are not hand-written. Each one is made by the box's own scanner, over a planted
 * copy of a box, and passed through `toRecord` exactly as the timer does — so the studio is tested
 * against the shape the box actually writes, not a shape this file invented.
 */
const FAKE_PAT = `github_pat_${'1'.repeat(22)}_${'A'.repeat(59)}`;
const NOW = Date.parse('2026-09-20T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const words = (ms: number) => `${Math.round(ms / HOUR)}h`;

/** Plant files under a fresh temp "box", scan it, and return the record the timer would write. */
function scannedBox(files: Record<string, string>, at: string) {
  const box = mkdtempSync(join(tmpdir(), 'fb206-'));
  try {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(box, rel, '..'), { recursive: true });
      writeFileSync(join(box, rel), text);
    }
    const result = scanRoots([join(box, 'opt'), join(box, 'root')].filter((p) => {
      try { return statSync(p).isDirectory(); } catch { return false; }
    }));
    // Through JSON, as it travels: written to the ref, read back by the studio.
    return JSON.parse(JSON.stringify(toRecord(result, { at, host: 'arca', roots: ['/opt/foundry', '/root/.claude'] })));
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
}

describe('the box and the studio agree on where the record lives', () => {
  it('uses one path on both sides', () => {
    // Two copies of a path that must match, in two languages. If they drift, every box reports into
    // a file the studio never reads, and the ledger says "never reported" over a working scanner.
    expect(SCAN_RECORD_PATH).toBe(RECORD_PATH);
  });
});

describe('a planted token reaches the ledger by file and kind, never by value (FB-206)', () => {
  it('names the file, the line and the kind', () => {
    const raw = scannedBox({ 'opt/foundry/lane/lane.env': `A=1\nTICKET_GITHUB_TOKEN=${FAKE_PAT}\n` }, '2026-09-20T03:00:00Z');
    const record = parseScanRecord(raw)!;
    const state = scanState({ kind: 'record', record }, NOW, true);
    expect(state.kind).toBe('found');
    if (state.kind !== 'found') return;
    expect(state.count).toBe(1);
    expect(findingLine(state.findings[0])).toMatch(/opt\/foundry\/lane\/lane\.env, line 2 — looks like a GitHub fine-grained token$/);
    expect(scanTone(state)).toBe('blocked');
    expect(scanSentence(state, words)).toContain('1 credential found outside /etc/foundry/credentials');
  });

  it('never carries the value — not in the record, not in anything the ledger prints', () => {
    const raw = scannedBox({
      'opt/foundry/lane/lane.env': `TICKET_GITHUB_TOKEN=${FAKE_PAT}\n`,
      'root/.claude/projects/arca/t.jsonl': `{"text":"the token is ${FAKE_PAT}"}\n`,
    }, '2026-09-20T03:00:00Z');
    expect(JSON.stringify(raw), 'the value reached the record on the ref').not.toContain(FAKE_PAT);
    const state = scanState({ kind: 'record', record: parseScanRecord(raw)! }, NOW, true);
    const printed = [scanSentence(state, words), ...(state.kind === 'found' ? state.findings.map(findingLine) : [])].join('\n');
    expect(printed).not.toContain(FAKE_PAT);
    expect(printed).not.toContain('github_pat_');
  });

  it('drops anything else a record might carry, rather than passing it to the screen', () => {
    // A field added to a finding later must not ride along into the page unexamined.
    const record = parseScanRecord({
      at: '2026-09-20T03:00:00Z',
      findingCount: 1,
      findings: [{ path: '/opt/x.env', line: 3, what: 'a GitHub token', value: FAKE_PAT, text: `T=${FAKE_PAT}` }],
    })!;
    expect(JSON.stringify(record)).not.toContain(FAKE_PAT);
  });

  it('keeps the true count when the box listed only the first few', () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < RECORD_LIST_CAP + 7; i++) files[`root/.claude/projects/arca/s${i}.jsonl`] = `${FAKE_PAT}\n`;
    const raw = scannedBox(files, '2026-09-20T03:00:00Z');
    expect(raw.findings.length).toBe(RECORD_LIST_CAP);
    const state = scanState({ kind: 'record', record: parseScanRecord(raw)! }, NOW, true);
    expect(state.kind === 'found' && state.count).toBe(RECORD_LIST_CAP + 7);
    expect(scanSentence(state, words)).toContain(`${RECORD_LIST_CAP + 7} credentials found`);
  });
});

describe('clean, old, and never reported are three different answers (FB-206)', () => {
  it('a clean, recent scan says when, and is the only state drawn in the "ok" tone', () => {
    const raw = scannedBox({ 'opt/foundry/lane/lane.env': 'DAILY_BUDGET=8\n' }, new Date(NOW - 5 * HOUR).toISOString());
    const state = scanState({ kind: 'record', record: parseScanRecord(raw)! }, NOW, true);
    expect(state).toMatchObject({ kind: 'clean', stale: false });
    expect(scanTone(state)).toBe('ok');
    expect(scanSentence(state, words)).toBe('Scanned 5h ago: no credential anywhere but /etc/foundry/credentials.');
  });

  it('a clean scan older than two days is not called clean', () => {
    const at = new Date(NOW - SCAN_STALE_MS - HOUR).toISOString();
    const raw = scannedBox({ 'opt/foundry/lane/lane.env': 'DAILY_BUDGET=8\n' }, at);
    const state = scanState({ kind: 'record', record: parseScanRecord(raw)! }, NOW, true);
    expect(state).toMatchObject({ kind: 'clean', stale: true });
    expect(scanTone(state)).not.toBe('ok');
    const said = scanSentence(state, words);
    expect(said).toContain('the scanner may have stopped');
    expect(said).not.toMatch(/^Scanned/);
  });

  it('a scan exactly a day and a half old is still current — one daily run with its random delay', () => {
    const at = new Date(NOW - 36 * HOUR).toISOString();
    const state = scanState({ kind: 'record', record: parseScanRecord({ at, findingCount: 0 })! }, NOW, true);
    expect(state).toMatchObject({ kind: 'clean', stale: false });
  });

  it('a box that has never written a record reads as "not reported", never as clean', () => {
    const state = scanState({ kind: 'absent' }, NOW, true);
    expect(state.kind).toBe('not-reported');
    expect(scanTone(state)).not.toBe('ok');
    const said = scanSentence(state, words);
    expect(said).toContain('never reported');
    expect(said).toContain('not the same as clean');
  });

  it('says so differently when the venture has no machine named at all', () => {
    expect(scanSentence(scanState({ kind: 'absent' }, NOW, false), words)).toContain('names no machine');
  });

  it('a clean scan that could not read some places says it is not a complete answer', () => {
    const state = scanState({ kind: 'record', record: parseScanRecord({ at: '2026-09-20T03:00:00Z', findingCount: 0, unreadableCount: 2 })! }, NOW, true);
    expect(scanTone(state)).toBe('attention');
    expect(scanSentence(state, words)).toContain('2 places could not be read');
  });

  it('a record with no date or no count is unreadable, not clean', () => {
    expect(parseScanRecord({ findingCount: 0 })).toBeNull();
    expect(parseScanRecord({ at: 'yesterday', findingCount: 0 })).toBeNull();
    expect(parseScanRecord({ at: '2026-09-20T03:00:00Z' })).toBeNull();
    expect(parseScanRecord({ at: '2026-09-20T03:00:00Z', findingCount: -1 })).toBeNull();
  });
});

describe('reading it off the ref (FB-206)', () => {
  const venture = (over: Partial<VentureSummary> = {}) => ({
    id: 'arca', name: 'ARCA', description: null, status: 'active', founderName: null, founderEmail: null,
    repos: ['arca'], approvalMatrix: [], vpsHost: 'arca.bruntsfield.capital', departments: [], ...over,
  }) as VentureSummary;

  it('a read that fails is "could not be read", never "not reported" and never clean', async () => {
    const state = await loadVentureScan(venture(), NOW, async () => { throw new Error('rate limited'); });
    expect(state.kind).toBe('unreadable');
    expect(scanSentence(state, words)).toContain('could not be read');
  });

  it('a file that is there but broken is unreadable, not absent', () => {
    expect(readScanText('arca', null).kind).toBe('absent');
    expect(readScanText('arca', '{not json').kind).toBe('unreadable');
    expect(readScanText('arca', '{"findingCount":0}').kind).toBe('unreadable');
  });

  it('reads the venture’s first repo, which is where the box writes', async () => {
    const asked: string[] = [];
    await loadVentureScan(venture({ repos: ['arca', 'arca-marketing'] }), NOW, async (r) => { asked.push(r); return { kind: 'absent' }; });
    expect(asked).toEqual(['arca']);
  });
});

describe('who pays for the read, and who can see it (FB-206)', () => {
  /** Every source file in the app, outside tests. */
  function sources(): string[] {
    const root = join(__dirname, '..', '..');
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === '.next' || e.name === '__tests__') continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(relative(root, p));
      }
    };
    for (const d of ['app', 'components', 'lib']) walk(join(root, d));
    return out.map((p) => p.replace(/\\/g, '/'));
  }

  it('is imported by the admin ledger and nowhere else', () => {
    // The rail is on every screen under every venture; a read added there is paid on every page
    // (FB-164). And a founder's screen must never carry it (FB-083's rule).
    const root = join(__dirname, '..', '..');
    const importers = sources().filter((p) => /from ['"](@\/lib\/|\.\/|\.\.\/lib\/)box-scan-load['"]/.test(readFileSync(join(root, p), 'utf8')));
    expect(importers).toEqual(['app/page.tsx']);
  });

  it('is mounted on the ledger only after a founder has been sent away', () => {
    // app/page.tsx redirects a founder before it renders anything admin-only. The scan must come
    // after that line, or a founder with two ventures would see it on their picker.
    const page = readFileSync(join(__dirname, '..', '..', 'app', 'page.tsx'), 'utf8');
    const founderLeaves = page.indexOf('if (!access.isAdmin) return <FounderVentures');
    const scanMounted = page.indexOf('<LoadedBoxScan');
    expect(founderLeaves).toBeGreaterThan(0);
    expect(scanMounted).toBeGreaterThan(founderLeaves);
  });
});
