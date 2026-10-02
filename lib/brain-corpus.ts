/**
 * Whether the team can find every document the venture holds (FB-169).
 *
 * ## The gap this closes
 *
 * The venture's knowledge is searched, not read front to back. When the team plans a piece of work it
 * asks the venture's index what is relevant, and only what the index holds can come back. On ARCA the
 * index held two of five documents for a month — every Build document was skipped — and every surface
 * said the knowledge was there: the Memory screen listed it, the team said it had searched, the sync
 * said "done". Nothing said three documents were never being read.
 *
 * The venture's machine now checks after every refresh, and writes the answer to
 * `health/brain-corpus.json` on the venture's `foundry-state` ref
 * (`deploy/lane/brain-corpus-record.mjs`). This module is the studio's read of it, and the sentence
 * the Memory screen prints.
 *
 * ## Five answers, never flattened
 *
 * - **not recorded** — there is no record. The machine does not check yet, or has never managed to
 *   report. This is NOT "nothing is missing", and is never printed as zero.
 * - **unreadable** — there is a record and the studio could not read it.
 * - **could not check** — the machine tried and the check itself did not finish.
 * - **complete** — a measured zero: every document can be found.
 * - **missing** — some cannot, counted and named.
 *
 * Any of the last three can also be **old**: the check runs every few minutes and is reported at
 * least daily, so an answer from days ago is a check that has stopped.
 *
 * Pure: the clock and the record are passed in, so every sentence is a unit test.
 */

/** Where the venture's machine writes it. Must match `deploy/lane/brain-corpus-record.mjs`. */
export const CORPUS_RECORD_PATH = 'health/brain-corpus.json';

/**
 * How old the answer can be before the screen says so. The machine re-reports an unchanged answer
 * every twenty hours; two days is one missed report plus slack.
 */
export const CORPUS_STALE_MS = 2 * 24 * 60 * 60 * 1000;

/** How many missing documents the sentence names before it says "and N more". */
export const NAMED_IN_NOTE = 5;

export interface CorpusRecord {
  at: string;
  /** How many documents there are to find. Null when the check did not finish. */
  corpus: number | null;
  /** How many of them cannot be found. Null when the check did not finish — never read as zero. */
  missingCount: number | null;
  /** Their paths, e.g. `context/build/policy.md`. May list fewer than the count; never more. */
  missing: string[];
}

export type CorpusRead =
  | { kind: 'absent' }
  | { kind: 'record'; record: CorpusRecord }
  | { kind: 'unreadable'; error: string };

/** One repo's record. Injected like every other read model, so the UI gate runs offline. */
export type CorpusSource = (repo: string) => Promise<CorpusRead>;

const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;

/**
 * Read the record the machine wrote. Null when it is not one at all.
 *
 * Strict about the date — an answer with no date cannot say whether it is current — and about the
 * count's type. A count that is missing (as opposed to wrong) is the machine's own "could not check".
 */
export function parseCorpusRecord(raw: unknown): CorpusRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.at !== 'string' || !Number.isFinite(Date.parse(o.at))) return null;
  if (o.missingCount !== null && o.missingCount !== undefined && count(o.missingCount) === null) return null;
  const missing = Array.isArray(o.missing)
    ? o.missing.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];
  const missingCount = count(o.missingCount);
  return {
    at: o.at,
    corpus: missingCount === null ? null : count(o.corpus),
    // A record that names more documents than it counts is believed on the names.
    missingCount: missingCount === null ? null : Math.max(missingCount, missing.length),
    missing: missingCount === null ? [] : missing,
  };
}

/** Turn the file's text into a read. A file that is there and cannot be read is NOT "absent". */
export function readCorpusText(text: string | null): CorpusRead {
  if (text === null) return { kind: 'absent' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'unreadable', error: 'the record is not readable' };
  }
  const record = parseCorpusRecord(raw);
  return record ? { kind: 'record', record } : { kind: 'unreadable', error: 'the record does not say when it was checked' };
}

/**
 * Whether the machine's check counts this document. Must agree with `corpusGap` in
 * `deploy/lane/brain-lib.mjs` (a test compares them): markdown in `context/` or `library/`, and no
 * README at any depth. The check also covers only the venture's first surface, which the caller
 * decides, because that is the only repo the machine indexes.
 */
export function checkedByMachine(path: string): boolean {
  const p = path.trim();
  return /^(context|library)\/.+\.mdx?$/i.test(p) && !/(^|\/)readme\.mdx?$/i.test(p);
}

/**
 * How many of the table's rows the check does not count: another surface's documents, or a file the
 * machine skips. `primaryRepo` is the venture's first surface, the only one its machine indexes.
 */
export function uncheckedRows(rows: ReadonlyArray<{ repo: string; doc: { path: string } }>, primaryRepo: string | undefined): number {
  return rows.filter((r) => r.repo !== primaryRepo || !checkedByMachine(r.doc.path)).length;
}

/** What the screen says, and how loudly. */
export interface CorpusNote {
  /** `missing` is the one that needs a founder's eye; everything else is a quiet line. */
  tone: 'attention' | 'quiet';
  text: string;
}

/** `context/build/no-fake-demo-data-policy.md` → `no fake demo data policy`, when no title is known. */
function nameOf(path: string, titles: ReadonlyMap<string, string>): string {
  const known = titles.get(path);
  if (known) return known;
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.[A-Za-z0-9]+$/, '').replace(/[-_]+/g, ' ').trim() || path;
}

function dateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.parse(iso)));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The sentence under the Memory table.
 *
 * `titles` maps a document's path to the title the table shows, so the names in the sentence are
 * the names on the rows above it.
 *
 * `unchecked` is how many rows in the table the check does not cover (a second surface's documents,
 * a folder's own README). Without it, "all 5 of your documents" could sit above a table of seven.
 */
export function corpusNote(
  read: CorpusRead,
  { ventureName, nowMs, titles = new Map(), unchecked = 0 }: {
    ventureName: string; nowMs: number; titles?: ReadonlyMap<string, string>; unchecked?: number;
  },
): CorpusNote {
  if (read.kind === 'absent') {
    return {
      tone: 'quiet',
      text: `Nothing checks yet whether your team can find every document here when it looks up what ${ventureName} knows, so the studio cannot say whether any are missing.`,
    };
  }
  if (read.kind === 'unreadable') {
    return {
      tone: 'quiet',
      text: `The studio could not read the check of whether your team can find every document here, so it cannot say whether any are missing just now.`,
    };
  }

  const { record } = read;
  const old = nowMs - Date.parse(record.at) > CORPUS_STALE_MS
    ? ` That check is from ${dateOf(record.at)} and has not run since, so it may be out of date.`
    : '';
  const outside = unchecked > 0
    ? unchecked === 1
      ? ' One more document listed above is not part of this check, and your team does not look it up.'
      : ` ${unchecked} more documents listed above are not part of this check, and your team does not look them up.`
    : '';

  if (record.missingCount === null) {
    return {
      tone: 'quiet',
      text: `The last check of whether your team can find every document here did not finish, so the studio cannot say whether any are missing.${old}`,
    };
  }
  if (record.missingCount === 0) {
    const all = record.corpus === null ? 'every one of your documents' : record.corpus === 1 ? 'your one document' : `all ${record.corpus} of your documents`;
    return {
      tone: 'quiet',
      text: `Your team can find ${all} when it looks up what ${ventureName} knows (checked ${dateOf(record.at)}).${outside}${old}`,
    };
  }

  const n = record.missingCount;
  const of = record.corpus !== null && record.corpus >= n ? ` of your ${record.corpus}` : '';
  const named = record.missing.slice(0, NAMED_IN_NOTE).map((p) => nameOf(p, titles));
  const more = n - named.length;
  const list = named.length === 0
    ? ''
    : ` ${n === 1 ? 'It is' : 'They are'}: ${named.join(', ')}${more > 0 ? `, and ${more} more` : ''}.`;
  return {
    tone: 'attention',
    text: `Your team cannot find ${plural(n, 'document', 'documents')}${of} when it looks up what ${ventureName} knows, so it works without ${n === 1 ? 'it' : 'them'}.${list} ${n === 1 ? 'It is' : 'They are'} still kept here and nothing is lost. This is for Bruntsfield to fix; there is nothing you need to do.${outside}${old}`,
  };
}
