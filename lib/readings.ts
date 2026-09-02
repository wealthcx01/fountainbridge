/**
 * What has actually been read, and for what (FB-156).
 *
 * ## The gap this closes
 *
 * FB-133 built the Memory screen's provenance — who handed each document over, and when — and left
 * the fourth column, `Last used`, deliberately empty with the reason written underneath it:
 * *nothing yet records which documents your team read while it worked.* That was true and it was
 * the right thing to ship, because the alternative on this screen is a plausible number nobody
 * measured. But an empty column is also the founder's own question going unanswered: *is the thing
 * I handed over actually being used?* A corpus you cannot see working is a corpus you stop feeding.
 *
 * ## Where the record comes from
 *
 * The reading already happens in exactly one place. Both the lane's RESEARCH step and the composer
 * reach the venture brain through `askBrain()` (`deploy/lane/brain-query.mjs`), which returns the
 * pages that went into the digest the model was handed. So the record is written where the reading
 * happens — the box appends to `readings.json` on the venture's `foundry-state` ref, beside the run
 * reports — and this module is the studio's read of it.
 *
 * ## One file, rewritten — not a file per reading
 *
 * ARCA's state ref already gains ~288 files a day and has crossed a GitHub listing cap nobody
 * measured (FB-161, FB-162). A per-reading record would be the same mistake with a new name, and it
 * would put `Last used` on a read whose cost grows with the venture's history — the exact thing
 * FB-083's budget rule forbids and FB-164 just finished undoing. `readings.json` holds one entry per
 * document, so it is bounded by the size of the corpus and costs one read per surface, forever.
 *
 * ## Keyed on the brain's slug, not on a path with an extension
 *
 * gbrain indexes `context/sell/arca-brand-positioning.md` under the slug
 * `context/sell/arca-brand-positioning` — the path with its extension dropped. A search hit carries
 * no path field, so the slug is all the box has. Rather than have the box guess an extension back on
 * (and be wrong the first time someone deposits a `.txt`), the record is keyed by the slug exactly as
 * the brain gave it, and the **studio** strips the extension when it joins. The lossy step happens
 * once, on the side that can see both halves.
 */

/** The piece of work a document was read for. */
export interface WorkRef {
  /**
   * What kind of work read it.
   *
   * `ticket` — the lane's RESEARCH step, planning a specific ticket.
   * `conversation` — the composer, answering the founder.
   */
  kind: 'ticket' | 'conversation';
  /** The ticket id, or a conversation's own reference. Shown when there is no title. */
  id: string;
  /** What the work was, in words. */
  title: string;
  /** Where the founder can go and look at it. Null when the work has no page yet. */
  url: string | null;
}

/** One document's most recent reading. */
export interface Reading {
  at: string;
  /** Null when the box recorded a reading it could not attribute to a piece of work. */
  work: WorkRef | null;
}

/** The record as it sits on the state ref: slug → most recent reading. */
export type ReadingsLog = ReadonlyMap<string, Reading>;

export interface ReadingsRecord {
  log: ReadingsLog;
  /**
   * Whether this surface has a record at all.
   *
   * The distinction the whole ticket turns on. A venture whose box has never written `readings.json`
   * and a venture whose box has written one that does not mention this document are different facts,
   * and `Last used` must not print the same dash for both without saying which it is.
   */
  present: boolean;
  /** Non-null when the read failed — which is a third thing again, and never rendered as "never". */
  error: string | null;
}

/** Where the box keeps it, on the `foundry-state` ref beside `runreports/` and `routines/`. */
export const READINGS_PATH = 'readings.json';

/** One repo's readings. Injected like every other read model, so the UI gate runs offline. */
export type ReadingsSource = (repo: string) => Promise<ReadingsRecord>;

/** An empty record for a surface that has none. Not an error — just nothing written yet. */
export const NO_READINGS: ReadingsRecord = { log: new Map(), present: false, error: null };

/**
 * `context/sell/brand.md` → `context/sell/brand`.
 *
 * Only a real extension is dropped — a trailing dot, or a dot inside a directory name, leaves the
 * path alone. A document named `2026.09.plan.md` keeps everything up to `.md`.
 */
export function readingKey(path: string): string {
  return path.replace(/\.[A-Za-z0-9]+$/, '');
}

/** Parse the record the box wrote. Never throws: a malformed file reads as no record, loudly above. */
export function parseReadings(raw: unknown): ReadingsLog {
  const log = new Map<string, Reading>();
  if (!raw || typeof raw !== 'object') return log;
  const readings = (raw as { readings?: unknown }).readings;
  if (!readings || typeof readings !== 'object') return log;

  for (const [slug, value] of Object.entries(readings as Record<string, unknown>)) {
    if (!slug || !value || typeof value !== 'object') continue;
    const at = (value as { at?: unknown }).at;
    if (typeof at !== 'string' || !at.trim()) continue;
    log.set(slug, { at, work: parseWork((value as { work?: unknown }).work) });
  }
  return log;
}

function parseWork(raw: unknown): WorkRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind === 'conversation' ? 'conversation' : 'ticket';
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  // A work reference with neither a name nor an id cannot be shown as a link to anything, and
  // rendering an empty link is worse than rendering the date alone.
  if (!id && !title) return null;
  const url = typeof o.url === 'string' && /^https?:\/\//.test(o.url) ? o.url : null;
  return { kind, id: id || title, title: title || id, url };
}

/**
 * What the `Last used` cell knows about one document.
 *
 * Three states, not two, and the middle one is the point of the ticket. "Nothing records this" and
 * "nothing has read this one yet" are different facts about the venture, and the moment they render
 * as the same dash the column is back to meaning nothing.
 */
export type LastUse =
  /** Read, and we know when — and usually what for. */
  | { kind: 'used'; at: string; work: WorkRef | null }
  /** There is a record for this surface, and this document is not in it. Nothing has read it. */
  | { kind: 'never' }
  /** No record for this surface at all — the box does not write one yet, or the read failed. */
  | { kind: 'unrecorded' };

export function lastUse(record: ReadingsRecord, path: string): LastUse {
  if (record.error || !record.present) return { kind: 'unrecorded' };
  const reading = record.log.get(readingKey(path));
  return reading ? { kind: 'used', at: reading.at, work: reading.work } : { kind: 'never' };
}

/**
 * Where the founder goes to see the work a document was read for.
 *
 * The box records what the work WAS; the studio decides where it lives. A lane cannot know the
 * studio's routes — and a URL baked into a record on a git ref would be wrong the first time a route
 * changed, on a screen whose entire job is to be believed. So a ticket links to this studio's own
 * ticket view, and anything the box gave an explicit URL for uses that.
 *
 * Null means there is nowhere honest to send them: the cell then names the work without a link,
 * which is still more than a bare date.
 */
export function workHref(work: WorkRef, ventureId: string): string | null {
  if (work.kind === 'ticket' && work.id) {
    return `/venture/${encodeURIComponent(ventureId)}/tickets?t=${encodeURIComponent(work.id)}`;
  }
  return work.url;
}

/**
 * The sentence under the table.
 *
 * It changes with what is actually known, because the FB-133 note — *"nothing yet records which
 * documents your team read"* — becomes false the moment one surface starts recording, and a stale
 * explanation on this screen is the same class of failure as a stale number.
 *
 * `records` must be the surfaces that actually put a row on the screen, and nothing else. A venture
 * whose second repository holds no corpus at all has no dashes from it to explain, and counting it
 * printed "some of your surfaces do not record what they read" over a table where every row came
 * from the one surface that does.
 */
export function readingsNote(records: readonly ReadingsRecord[]): string | null {
  if (records.length === 0) return null;
  const recording = records.filter((r) => r.present && !r.error).length;
  if (recording === 0) {
    return 'Last used is empty because nothing on this venture records which documents your team '
      + 'read while it worked yet. It stays empty rather than showing you a number nobody measured.';
  }
  if (recording < records.length) {
    return 'Some of your surfaces do not record what they read yet, so a dash on those rows means '
      + 'nobody is keeping the record — not that the document has gone unread.';
  }
  return 'A dash here means nothing has read that document yet. Your team records what it reads '
    + 'each time it works.';
}
