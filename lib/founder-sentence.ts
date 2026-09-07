/**
 * Turning what a repository recorded into a sentence about the venture (FB-180).
 *
 * "What happened" is the screen a founder opens to find out whether the thing they asked for is
 * happening. It was printing the engineering record verbatim:
 *
 *     build: ARCA-062-arca-brand-redesign (Foundry lane)
 *     ARCA: ARCA-062-arca-brand-redesign (worked by the Foundry lane) (#80)
 *
 * Those are two rows about one piece of work, written for whoever pushed them, naming a branch
 * prefix, a slug, a lane and a pull request number. Every row in the design is a sentence about the
 * venture: *"ARCA-14, bulk daily price feed, filed from your conversation"*.
 *
 * `copy-lint` cannot catch any of this, because these strings are **data, not source** — a rule that
 * inspects the repository's own words cannot see a slug a lane wrote at two in the morning.
 */

/**
 * `build:`, `feat(scope):`, `ARCA:` — who pushed it, not what happened.
 *
 * A **named** list, not "any word before a colon". The greedy version ate `Research:` and `QA:`,
 * which are the founder's own words for what a piece of work is, and left the sentence starting
 * mid-thought in lower case. Conventional-commit types and an ALL-CAPS repository prefix are
 * engineering; everything else is the venture talking.
 */
const PREFIX =
  /^\s*(?:(?:build|chore|ci|docs?|feat|fix|perf|refactor|revert|style|test|seed|cleanup|bump)(?:\([^)]*\))?|[A-Z][A-Z0-9-]{1,})\s*:\s*/;

/** `(#80)`, `#80` — a pull request number is an engineering address. */
const PR_NUMBER = /\s*\(?#\d+\)?\s*/g;

/** `(Foundry lane)`, `(worked by the Foundry lane)` — the machinery naming itself. */
const LANE_ASIDE = /\s*\((?:[^()]*\b)?lane\)/gi;

/** Anything still saying "lane" after the asides have gone. */
const LANE_WORD = /\s*\b(?:worked by the\s+)?[A-Z][\w-]*\s+lane\b/gi;

/** A ticket slug: `ARCA-062-arca-brand-redesign`, `SELL-001-write-the-one-pager`. */
const SLUG = /\b([A-Za-z]{2,}-\d+[a-z]?)((?:-[a-z0-9]+)+)\b/g;

/**
 * A ticket reference a founder can read.
 *
 * `ARCA-062-arca-brand-redesign` → `ARCA-062, arca brand redesign`, which is the design's own form
 * (*"ARCA-8, onboarding flow"*).
 *
 * The words come out of the slug rather than out of the ticket file on purpose. This screen already
 * costs three reads and took 5,986 ms before FB-158; opening every ticket a run touched to recover a
 * title it was built from would put that back. The slug is **derived from** the title, so this
 * recovers it rather than inventing one — and it never claims more than it has.
 */
export function readableTicketRef(slug: string): string {
  const m = /^([A-Za-z]{2,}-\d+[a-z]?)((?:-[A-Za-z0-9]+)+)$/.exec(slug.trim());
  if (!m) return slug.trim();
  const id = m[1].toUpperCase();
  const words = m[2].replace(/^-/, '').replace(/-/g, ' ').trim();
  return words ? `${id}, ${words}` : id;
}

/**
 * The same, applied wherever a slug appears inside a longer sentence.
 *
 * Used on run reports, whose text is composed elsewhere (`describeRun`) and carries the slug in the
 * middle of a sentence a founder otherwise reads fine.
 */
export const readableSlugs = (text: string): string =>
  text.replace(SLUG, (_all, id: string, tail: string) => readableTicketRef(`${id}${tail}`));

/**
 * Strip the engineering scaffolding from a recorded title.
 *
 * Order matters: the prefix goes first so `ARCA: ARCA-062-…` does not lose the wrong half, and the
 * lane asides go before the bare lane words so `(worked by the Foundry lane)` is removed whole
 * rather than leaving an empty pair of brackets.
 */
export function plainTitle(title: string): string {
  const cleaned = readableSlugs(
    title
      .replace(PREFIX, '')
      .replace(LANE_ASIDE, '')
      .replace(PR_NUMBER, ' ')
      .replace(LANE_WORD, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .trim(),
  ).replace(/[\s,;:—-]+$/, '');
  // A sentence starts with a capital. Stripping `fix: ` off the front leaves one that does not, and
  // a column of lower-case openings reads as broken rather than as terse. Left alone when the first
  // word is already a name or an id, which upper-casing would not improve.
  return /^[a-z]/.test(cleaned) ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned;
}

/** The ticket a title is about, if it names one. */
export function ticketRefIn(title: string): string | null {
  SLUG.lastIndex = 0;
  const m = SLUG.exec(title);
  return m ? `${m[1]}${m[2]}` : null;
}

/**
 * One sentence about the venture, built from what the event MEANS rather than from what was typed
 * into the commit.
 *
 * `unknown` is the honest case and is treated as one: the studio does not know what the change was,
 * so the row says what it has — the title, cleaned — and claims nothing about it. An event the
 * studio cannot classify must never be dressed up as shipped work.
 */
export function founderSentence(
  meaning: 'ticket-filed' | 'work-shipped' | 'knowledge-added' | 'plumbing' | 'unknown',
  title: string,
): string {
  const plain = plainTitle(title);
  const subject = plain || 'a change with no description';
  switch (meaning) {
    // Short on purpose. These clauses run down the whole column, and every word in them is a word
    // in twenty rows: "and now in your queue" says what "filed" already means, and "by your team"
    // says what every row on this page means unless it names the founder. Eleven of twenty rows
    // wrapped onto a second line carrying them.
    case 'ticket-filed':
      return `${subject} — filed`;
    case 'work-shipped':
      return `${subject} — finished`;
    case 'knowledge-added':
      return `${subject} — added to what your venture knows`;
    case 'plumbing':
    case 'unknown':
    default:
      return subject;
  }
}
