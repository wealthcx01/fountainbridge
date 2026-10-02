/**
 * What the credential scan on each venture's machine last said (FB-206).
 *
 * ## The gap this closes
 *
 * FB-176 put a credential scanner on every venture box. It runs daily, exits non-zero when it finds a
 * token outside `/etc/foundry/credentials`, and names the file and the line. And then it said so in
 * `journalctl`, on a machine nobody logs into. The studio knew something was wrong and said so only
 * where no one was looking — the exact failure CLAUDE.md #10 forbids.
 *
 * Now the timer also writes what it found to `health/secret-scan.json` on the venture's
 * `foundry-state` ref, beside the run reports, and this is the studio's read of it.
 *
 * ## Who sees it, and where
 *
 * **Only Bruntsfield, and only on the admin ledger.** A credential on a founder's box is our
 * operational failure, and not something they can act on — the same rule as the budget on
 * `/api/health` (FB-083). And not on the rail: a read added there is a read on every screen under
 * every venture, which is what cost the studio about six seconds a page before FB-164.
 *
 * ## Five answers, not two
 *
 * "Clean" is only reassuring when it is recent and when the scanner could actually look. So the
 * ledger keeps these apart, and never prints one in the words of another:
 *
 * - **not reported** — no record on the ref. The scanner is not installed, or has never managed to
 *   report. This is NOT clean.
 * - **unreadable** — there is a record and the studio could not read it.
 * - **clean** — the last scan found nothing.
 * - **found** — the last scan found a credential, named by file and kind, never by value.
 * - and either of the last two can be **old**: a scan that should run daily and last ran three weeks
 *   ago is a scanner that has stopped, whatever it said then.
 *
 * Pure: the clock and the record are passed in, so every one of those sentences is a unit test.
 */

/** One credential the scanner found. File, line and kind — the record never holds the value. */
export interface ScanFinding {
  path: string;
  line: number;
  what: string;
}

/** The record as the box wrote it, after parsing. */
export interface ScanRecord {
  at: string;
  host: string | null;
  /** The true count. `findings` may list fewer — the box caps the list, never the count. */
  findingCount: number;
  findings: ScanFinding[];
  /** Lines that matched the looser `password = …` rule. Counted on the box, not listed here. */
  looseCount: number;
  /** Paths the scan could not read. A clean scan with some of these is not a complete answer. */
  unreadableCount: number;
}

/** Where the box writes it, on the `foundry-state` ref. Must match `deploy/foundry/secret-scan.mjs`. */
export const SCAN_RECORD_PATH = 'health/secret-scan.json';

/**
 * How old a scan can be before it stops counting as current.
 *
 * The timer fires daily with up to half an hour of random delay, and `Persistent=true` catches up a
 * missed run after a reboot. Two days is one missed run plus that slack: a box that has skipped two
 * days in a row has a scanner that is not running, whatever its last answer was.
 */
export const SCAN_STALE_MS = 2 * 24 * 60 * 60 * 1000;

/** What one read of the ref returned. */
export type ScanRead =
  | { kind: 'absent' }
  | { kind: 'record'; record: ScanRecord }
  | { kind: 'unreadable'; error: string };

/** One repo's record. Injected like every other read model, so the UI gate runs offline. */
export type ScanSource = (repo: string) => Promise<ScanRead>;

/**
 * Parse the record the box wrote. Returns null when it is not a scan record at all.
 *
 * Strict about the two fields the screen's honesty depends on — when, and how many — and forgiving
 * about the rest. A record with no readable date cannot say whether it is current, and a record with
 * no count cannot say whether it is clean, so either one is "unreadable", never "clean".
 */
export function parseScanRecord(raw: unknown): ScanRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const at = typeof o.at === 'string' && Number.isFinite(Date.parse(o.at)) ? o.at : null;
  const count = typeof o.findingCount === 'number' && Number.isInteger(o.findingCount) && o.findingCount >= 0
    ? o.findingCount
    : null;
  if (!at || count === null) return null;

  const findings: ScanFinding[] = [];
  if (Array.isArray(o.findings)) {
    for (const f of o.findings) {
      if (!f || typeof f !== 'object') continue;
      const r = f as Record<string, unknown>;
      if (typeof r.path !== 'string' || !r.path) continue;
      // Rebuilt field by field, so nothing else the file might carry can reach the screen.
      findings.push({
        path: r.path,
        line: typeof r.line === 'number' && r.line > 0 ? Math.floor(r.line) : 0,
        what: typeof r.what === 'string' && r.what ? r.what : 'a credential',
      });
    }
  }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return {
    at,
    host: typeof o.host === 'string' && o.host ? o.host : null,
    // A record that lists more rows than it counts is believed on the rows.
    findingCount: Math.max(count, findings.length),
    findings,
    looseCount: n(o.looseCount),
    unreadableCount: n(o.unreadableCount),
  };
}

/** The ledger's answer for one venture. */
export type ScanState =
  | { kind: 'not-reported'; hasMachine: boolean }
  | { kind: 'unreadable'; error: string }
  | { kind: 'clean'; at: string; ageMs: number; stale: boolean; unreadableCount: number }
  | { kind: 'found'; at: string; ageMs: number; stale: boolean; findings: ScanFinding[]; count: number };

/**
 * Turn a read into the state the ledger shows.
 *
 * `hasMachine` only changes the words of "not reported" — it never turns a missing record into a
 * clean one. A venture whose manifest names no machine and a venture whose machine has never
 * reported are both "we do not know", and the sentence says which.
 */
export function scanState(read: ScanRead, nowMs: number, hasMachine: boolean): ScanState {
  if (read.kind === 'absent') return { kind: 'not-reported', hasMachine };
  if (read.kind === 'unreadable') return { kind: 'unreadable', error: read.error };
  const { record } = read;
  const ageMs = Math.max(0, nowMs - Date.parse(record.at));
  const stale = ageMs > SCAN_STALE_MS;
  if (record.findingCount > 0) {
    return { kind: 'found', at: record.at, ageMs, stale, findings: record.findings, count: record.findingCount };
  }
  return { kind: 'clean', at: record.at, ageMs, stale, unreadableCount: record.unreadableCount };
}

/** The shared tone each state is drawn in. A credential is red; not knowing is grey, never green. */
export function scanTone(state: ScanState): 'ok' | 'attention' | 'blocked' | 'idle' {
  switch (state.kind) {
    case 'found': return 'blocked';
    case 'clean': return state.stale || state.unreadableCount > 0 ? 'attention' : 'ok';
    case 'unreadable': return 'attention';
    case 'not-reported': return 'idle';
  }
}

/** Where a credential is allowed to live. Named in the sentence so the fix is in the sentence. */
export const CREDENTIALS_HOME = '/etc/foundry/credentials';

/**
 * The sentence for one venture. Plain words, the fact first, then what it means.
 *
 * `ago` is passed in already worded (`"3 days"`) so this stays free of the clock.
 */
export function scanSentence(state: ScanState, ago: (ms: number) => string): string {
  switch (state.kind) {
    case 'not-reported':
      return state.hasMachine
        ? 'Its machine has never reported a credential scan. That is not the same as clean: the '
          + 'scanner may not be installed, or may not be able to write to the studio.'
        : 'No credential scan has reported. Its manifest names no machine yet, so there may be '
          + 'nothing to scan — but that is not the same as clean.';
    case 'unreadable':
      return `The last scan's record could not be read, so this machine's state is not known. ${state.error}`;
    case 'clean': {
      if (state.stale) {
        return `The last scan was ${ago(state.ageMs)} ago and found nothing — but it should run every `
          + 'day. A clean result that old is not reassurance: the scanner may have stopped.';
      }
      const when = `Scanned ${ago(state.ageMs)} ago: no credential anywhere but ${CREDENTIALS_HOME}.`;
      return state.unreadableCount > 0
        ? `${when} But ${state.unreadableCount} ${state.unreadableCount === 1 ? 'place' : 'places'} could `
          + 'not be read, so that is not a complete answer.'
        : when;
    }
    case 'found': {
      const n = state.count;
      const head = `${n} credential${n === 1 ? '' : 's'} found outside ${CREDENTIALS_HOME}, `
        + `${state.stale ? `in a scan ${ago(state.ageMs)} old that has not run since` : `scanned ${ago(state.ageMs)} ago`}.`;
      return `${head} Rotate ${n === 1 ? 'it' : 'them'}, then move the value into ${CREDENTIALS_HOME}.`;
    }
  }
}

/** One finding, in words. `lane.env, line 3 — looks like a GitHub token`. */
export function findingLine(f: ScanFinding): string {
  return `${f.path}${f.line > 0 ? `, line ${f.line}` : ''} — looks like ${f.what}`;
}
