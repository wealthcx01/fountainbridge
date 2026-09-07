/**
 * What the venture has been given (FB-106).
 *
 * John: *"nothing that allows the founder to see what docs have been uploaded either to the composer
 * or the studio?"*
 *
 * Documents go in through the composer, land in the venture's `context/` and `library/` on git
 * (FB-078/FB-084) — and then vanish from the founder's view. The corpus is real and growing; the
 * walkthrough's own brand-positioning note is in there. The only way to see it was GitHub, which is
 * the product this studio exists to replace.
 *
 * Uploading into something you cannot then look at is posting into a void, and a founder who feels
 * that stops uploading — which quietly starves the thing that makes next month's work better.
 *
 * ## The shape on disk (D8)
 *
 *   context/<department>/<slug>.md    durable background — decisions, positioning, constraints
 *   library/<department>/<slug>.md    artifacts and outputs
 *
 * Pure, with the read injected, like every other read model — so the UI gate runs offline.
 */

import type { LastUse } from './readings';

export type KnowledgeArea = 'context' | 'library';

export interface KnowledgeDoc {
  /** Full repo path, and the identity of the document. */
  path: string;
  area: KnowledgeArea;
  /** The surface it was filed under. `general` when it was deposited without one. */
  department: string;
  /** The document's own title if it states one, else a readable form of its filename. */
  title: string;
  /** Bytes on disk — the honest size, whatever the studio can render of it. */
  bytes: number;
  /** The text, when the studio could read it. Null for something it cannot show as prose. */
  text: string | null;
}

export interface KnowledgeCorpus {
  docs: KnowledgeDoc[];
  /** Non-null when the read failed — never rendered as "you have given it nothing" (FB-021). */
  error: string | null;
}

/** One repo's corpus. Injected, so tests and the UI gate never reach the network. */
export type KnowledgeSource = (repo: string) => Promise<KnowledgeCorpus>;

/**
 * A readable title.
 *
 * The document's own first heading when it has one — a founder named it, and that name is better
 * than anything derived. Otherwise the filename, de-slugged: `brand-positioning.md` reads as "Brand
 * positioning", which is what they called it when they uploaded it anyway.
 */
export function titleOf(path: string, text: string | null): string {
  const heading = text?.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  const base = (path.split('/').pop() ?? path).replace(/\.[a-z0-9]+$/i, '');
  const words = base.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : path;
}

/**
 * The directory's own readme is scaffolding, not knowledge (FB-181).
 *
 * `context/README.md` and `library/README.md` are the files committed when the corpus directories
 * were created. On ARCA they were **six of eleven rows** on a screen whose own sentence is
 * *"Everything you have handed over or your team has learned"* — a founder handed over none of them,
 * and they are the same file repeated once per repository.
 *
 * Excluded rather than marked, which is what the ticket asks for and is the right call: a founder
 * does not need to be told the directory has a readme. Nothing is lost — the file is still in the
 * repository, where the person who wrote it put it.
 */
export const isScaffolding = (path: string): boolean =>
  /^(context|library)\/README\.md$/i.test(path.trim());

/** `context/sell/brand-positioning.md` → area `context`, department `sell`. */
export function placeOf(path: string): { area: KnowledgeArea; department: string } | null {
  const m = path.match(/^(context|library)\/(?:([^/]+)\/)?[^/]+$/);
  if (!m) return null;
  return { area: m[1] as KnowledgeArea, department: m[2] ?? 'general' };
}

/** Build one document from a path and whatever text the read produced. */
export function toDoc(path: string, text: string | null, bytes: number): KnowledgeDoc | null {
  // Dropped HERE rather than in the view, so every reader of the corpus agrees on what is in it —
  // the count in "11 documents" is composed from the same list the rows come from, and excluding a
  // row in one place and not the other is how a screen starts contradicting its own heading.
  if (isScaffolding(path)) return null;
  const place = placeOf(path);
  if (!place) return null;
  return { path, area: place.area, department: place.department, title: titleOf(path, text), bytes, text };
}

/**
 * Group for display: by area, then department, then title.
 *
 * Grouped rather than one long list because the two areas mean different things — background the
 * team reads before it works, and artifacts it produced or was handed — and a founder scanning for
 * "did my price list land?" is looking inside one of them, not both.
 */
export function byArea(docs: readonly KnowledgeDoc[]): Array<{ area: KnowledgeArea; docs: KnowledgeDoc[] }> {
  const order: KnowledgeArea[] = ['context', 'library'];
  return order
    .map((area) => ({
      area,
      docs: docs
        .filter((d) => d.area === area)
        .sort((a, b) => a.department.localeCompare(b.department) || a.title.localeCompare(b.title)),
    }))
    .filter((g) => g.docs.length > 0);
}

/** What each area is for, in the founder's words — shown as the section's own explanation. */
export const AREA_LABEL: Record<KnowledgeArea, string> = {
  context: 'Background your team reads before it works',
  library: 'Things your venture has produced or been handed',
};

/** "12 KB" / "1.2 MB" — a size a person can judge, not a byte count. */
export function describeSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- where a document came from, and when (FB-133) -------------------------------------------

/**
 * A document's provenance, as far as git can be made to say it.
 *
 * The Memory screen's job is to state what the machine actually read, so this is a discriminated
 * union rather than two nullable fields: a row is in exactly one of these states, and "we know who
 * added it" and "we know who last touched it" are different claims that must not be rendered as the
 * same sentence.
 *
 * - `added`   — the path has exactly one commit behind it, so that commit *is* the moment it arrived.
 * - `changed` — it has more than one. We know when it was last touched and by whom; we do **not**
 *               know when it was added without walking the whole history, so we do not say.
 * - `unknown` — the history could not be read. Absent, never guessed (CLAUDE.md #10).
 */
export type DocOrigin =
  | { kind: 'added'; who: string; at: string }
  | { kind: 'changed'; who: string; at: string }
  | { kind: 'unknown' };

/** One commit's worth of what git will tell us about a path. */
export interface DocCommit {
  committedDate: string;
  messageHeadline: string;
  authorName: string | null;
  /** How many commits have touched this path. 1 means the commit we have is the one that added it. */
  totalCount: number;
}

/**
 * Who handed this over, read off the commit that wrote it.
 *
 * The two ways in leave different fingerprints, and they are the two the founder cares about
 * distinguishing: `app/actions/knowledge.ts` commits `knowledge: <filename>` when they use the Add
 * control, and `deploy/librechat/deposit-mcp` commits `context: <title>` when the composer files
 * something mid-conversation. Anything else was written by a lane or by hand, and the commit's own
 * author is the honest answer for those.
 *
 * The prefixes live here beside the words they produce, because a founder reading "You" needs it to
 * still be true after someone changes a commit message on the other side.
 */
export const STUDIO_DEPOSIT_PREFIX = 'knowledge:';
export const COMPOSER_DEPOSIT_PREFIX = 'context:';

export function whoAdded(
  commit: Pick<DocCommit, 'messageHeadline' | 'authorName'>,
  /**
   * The GitHub organisation this venture lives in (FB-181).
   *
   * `wealthcx01` was appearing in a column headed **From**, beside "John Gallagher" — a company
   * rendered where a person's name goes. The existing `|| 'Your team'` fallback never fired, because
   * the author name is present and IS the organisation.
   *
   * Passed in from the manifest rather than pattern-matched, so this is a comparison and not a guess
   * about which logins look like companies.
   */
  org?: string | null,
): string {
  const headline = commit.messageHeadline.trim();
  if (headline.startsWith(STUDIO_DEPOSIT_PREFIX)) return 'You';
  // Not "You": the composer's deposit tool is called by the agent during a founder's conversation,
  // and attributing the agent's judgement to the founder is the kind of small lie this screen exists
  // to avoid.
  if (headline.startsWith(COMPOSER_DEPOSIT_PREFIX)) return 'Your composer';
  const author = commit.authorName?.trim() ?? '';
  if (!author) return 'Your team';
  // The organisation is not a person. "Your team" is what the column already says for anything the
  // studio cannot attribute to one.
  if (org && author.toLowerCase() === org.trim().toLowerCase()) return 'Your team';
  return author;
}

/** Fold one path's commit into the union above. Null in — `unknown` out, never a default date. */
export function originOf(commit: DocCommit | null, org?: string | null): DocOrigin {
  if (!commit || !commit.committedDate) return { kind: 'unknown' };
  const who = whoAdded(commit, org);
  return commit.totalCount === 1
    ? { kind: 'added', who, at: commit.committedDate }
    : { kind: 'changed', who, at: commit.committedDate };
}

/**
 * The "Added" cell, in words that stay true.
 *
 * A document with a history says *Updated*, because the date we hold is the last change and not the
 * arrival. Saying "Added" over the date of an edit is exactly the invented number this screen must
 * not print.
 */
export function describeOrigin(origin: DocOrigin, day: (iso: string) => string | null): string | null {
  switch (origin.kind) {
    case 'added': { const d = day(origin.at); return d && `Added ${d}`; }
    case 'changed': { const d = day(origin.at); return d && `Updated ${d}`; }
    case 'unknown': return null;
    default: {
      const unhandled: never = origin;
      return unhandled;
    }
  }
}

/** A corpus row as the Memory table renders it: the document, plus what its records say about it. */
export interface KnowledgeRow {
  /**
   * Which of the venture's repositories this came from.
   *
   * The path alone is NOT an identity. A venture has several surfaces (Build, Sell, Scale) and the
   * corpus is read from each of them, so two of them can both hold `context/general/price-list.md` —
   * at which point a path-keyed table renders duplicate React keys and two elements answering to one
   * test id, and clicking one document opens the other. Same lesson as `rowKey` in tickets-view.ts.
   */
  repo: string;
  doc: KnowledgeDoc;
  origin: DocOrigin;
  /**
   * Whether anything has read this document, and for what (FB-156).
   *
   * Three states rather than a nullable date, because "nothing on this venture keeps the record" and
   * "the record is kept and this document is not in it" are different facts about the venture, and
   * the column was empty for a whole ticket precisely so that they would not be printed as one dash.
   */
  lastUse: LastUse;
}

/** The identity of a row: the surface it came from AND its path. Never the path alone. */
export const docKey = (row: Pick<KnowledgeRow, 'repo' | 'doc'>): string => `${row.repo}/${row.doc.path}`;

/**
 * Newest first, and everything git could not date last.
 *
 * A founder opening this screen is usually checking that the thing they handed over this morning
 * landed, so recency is the useful order. Undated rows sort to the bottom rather than to the top,
 * where a missing date would otherwise read as "just now".
 */
export function orderRows(rows: readonly KnowledgeRow[]): KnowledgeRow[] {
  // Parsed instants rather than a string compare: these timestamps come from a code host and from
  // fixtures, and `2026-06-20T09:00:00Z` sorts against `2026-06-20T10:00:00+01:00` correctly only
  // once both are numbers. The same two moments compared as text put the earlier one first.
  const when = (r: KnowledgeRow): number | null => {
    if (r.origin.kind === 'unknown') return null;
    const at = Date.parse(r.origin.at);
    return Number.isFinite(at) ? at : null;
  };
  return [...rows].sort((a, b) => {
    const [x, y] = [when(a), when(b)];
    if (x !== null && y !== null && x !== y) return y - x;
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
    return a.doc.title.localeCompare(b.doc.title) || docKey(a).localeCompare(docKey(b));
  });
}

/**
 * The sentence over the table.
 *
 * It counts what is on the screen and nothing else. A summary computed from a different list than
 * the one below it is the FB-149 badge/destination disagreement, and this page is the worst place to
 * repeat it — the whole screen is a claim about what the machine holds.
 */
export function memorySummary(rows: readonly KnowledgeRow[]): string {
  if (rows.length === 0) return 'Nothing handed over yet.';
  const docs = `${rows.length} document${rows.length === 1 ? '' : 's'}`;
  // Counted by area, and the sentence names the areas it counted. The first draft said "across N
  // areas" where N was the number of SURFACES and the words after the dash named the two corpus
  // areas — two different things in one clause, on the screen whose job is to be exact.
  const parts = (['context', 'library'] as KnowledgeArea[])
    .map((area) => ({ area, n: rows.filter((r) => r.doc.area === area).length }))
    .filter((p) => p.n > 0)
    .map((p) => `${p.n} ${p.n === 1 ? AREA_SHORT[p.area].one : AREA_SHORT[p.area].many}`);
  return `${docs} — ${parts.join(', ')}.`;
}

/**
 * The short form of each area, for a sentence rather than a section heading.
 *
 * Both forms spelled out rather than an `s` appended: "1 piece of backgrounds" is what appending one
 * produces, and a summary that cannot count to one is not a summary anybody trusts.
 */
export const AREA_SHORT: Record<KnowledgeArea, { one: string; many: string }> = {
  context: { one: 'piece of background', many: 'pieces of background' },
  library: { one: 'artifact', many: 'artifacts' },
};
/**
 * The surface to print on a document's row (FB-181).
 *
 * The path first: `context/sell/…` is a Sell document wherever it is stored. The repository's own
 * surface only when the path names no department, which is what `general` means. The slug itself is
 * the last resort, so a venture that declares no departments reads exactly as it did before.
 */
export function surfaceFor(
  department: string,
  repo: string,
  names?: Record<string, string>,
  surfaces?: Record<string, string>,
): string {
  if (department && department !== 'general') return names?.[department] ?? department;
  return surfaces?.[repo] ?? department;
}
