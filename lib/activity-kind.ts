/**
 * What actually happened, in the founder's terms (FB-096).
 *
 * ## The moment that broke trust
 *
 * The activity feed said, three days ago: **MERGED — Replace Bloomberg/Pokemon tagline on sign-in
 * page.** The founder opened their product. The sign-in page still said *"The Bloomberg Terminal for
 * Pokemon Cards."*
 *
 * Both facts were true. What merged was the **ticket file** — the *request* to do the work — and the
 * work itself was later tried three times, failed its own review, and was parked. But the feed had
 * one word for both events, and to a founder "merged" beside a change they asked for means *my
 * product now does this*. The one page whose whole job is "what has been happening" taught them, on
 * first contact with reality, that it could not be trusted. FB-070's lesson applies verbatim: a
 * founder who catches the board lying once stops believing the rest of it.
 *
 * ## It reads what changed, not what it was called
 *
 * A title is a sentence someone wrote; the paths are what happened. "Replace Bloomberg/Pokemon
 * tagline" is the same title whether the change is the request or the work, and only the paths tell
 * them apart. Where no paths are known the classifier says so (`unknown`) rather than guessing —
 * an event the studio cannot classify is shown as the plain fact it is, never as shipped work.
 */

export type ActivityMeaning = 'ticket-filed' | 'work-shipped' | 'knowledge-added' | 'plumbing' | 'unknown';

/** Anything under here is the studio's own housekeeping, not the venture's product. */
const PLUMBING_PATH = /^(\.github\/|scripts\/|deploy\/|tools\/|e2e\/|prps\/)|(^|\/)(README|CHANGELOG)\.md$/i;

/**
 * Titles that are plumbing whatever they touch.
 *
 * The exception to "read the paths, not the title", and a narrow one: a seed, a test artifact and a
 * cleanup are events the venture's own machinery made about itself. The walkthrough met
 * "cleanup: FB-043 test artifact", "test: sensitive Todo ticket" and "seed: arca-ops — the queue,
 * the context…" in a founder's feed.
 */
const PLUMBING_TITLE = /^\s*(seed|test|cleanup|chore|ci|revert|bump|merge branch)\b/i;

export interface ClassifiableEvent {
  title: string;
  /** Every path the change touched. Empty/undefined means the studio does not know. */
  paths?: readonly string[];
}

export function classifyActivity(event: ClassifiableEvent): ActivityMeaning {
  if (PLUMBING_TITLE.test(event.title)) return 'plumbing';

  const paths = event.paths ?? [];
  if (paths.length === 0) return 'unknown';

  const product = paths.filter((p) => !PLUMBING_PATH.test(p));
  if (product.length === 0) return 'plumbing';

  // Only ticket files ⇒ a request entering the queue, not work leaving it. This is the whole ticket.
  if (product.every((p) => /^docs\/tickets\//.test(p))) return 'ticket-filed';
  // Only the founder's own deposits ⇒ the venture learned something.
  if (product.every((p) => /^(context|library)\//.test(p))) return 'knowledge-added';
  return 'work-shipped';
}

/** The founder's word for each meaning. `unknown` deliberately claims nothing. */
export const MEANING_LABEL: Record<ActivityMeaning, string> = {
  'ticket-filed': 'asked for',
  'work-shipped': 'shipped',
  'knowledge-added': 'learned',
  plumbing: 'housekeeping',
  unknown: 'changed',
};

/**
 * Is this something a founder should see at all?
 *
 * Plumbing is real and Bruntsfield needs it; it is not a founder's business. The activity page
 * already splits admin from founder (FB-080), and this is the same split one level down.
 */
export const isFounderVisible = (meaning: ActivityMeaning): boolean => meaning !== 'plumbing';

/**
 * Collapse the merge/commit pair into one event.
 *
 * Every merged change appeared twice — once as the merge and once as the commit it produced, with
 * the same words. One human event, one row. Keyed on the title within a short window rather than on
 * the commit sha, because the feed reads the two from different endpoints that do not name each
 * other.
 */
export function dedupeActivity<T extends { kind: string; title: string; at: string }>(events: readonly T[]): T[] {
  const PAIR_WINDOW_MS = 10 * 60_000;
  const kept: T[] = [];
  for (const e of events) {
    const twin = kept.find(
      (k) =>
        normaliseTitle(k.title) === normaliseTitle(e.title) &&
        Math.abs(Date.parse(k.at) - Date.parse(e.at)) <= PAIR_WINDOW_MS,
    );
    // The merge is the human event; the commit is its shadow. Whichever arrived first stays unless
    // the newcomer is the merge, in which case it replaces the shadow.
    if (!twin) kept.push(e);
    else if (twin.kind === 'commit' && e.kind === 'pr-merged') kept[kept.indexOf(twin)] = e;
  }
  return kept;
}

/** A merge commit repeats the PR's own title, sometimes with git's wrapping around it. */
function normaliseTitle(title: string): string {
  return title
    .replace(/^Merge pull request #\d+ from \S+\s*/i, '')
    .replace(/\s*\(#\d+\)\s*$/, '')
    .trim()
    .toLowerCase();
}

/**
 * The ticket a filing filed, read off the path it touched.
 *
 * `docs/tickets/ARCA-58-replace-tagline.md` → `ARCA-58`. Only the id, and only from a ticket path:
 * this exists so a filing row can be told whether that ticket's work later stopped, and a wrong id
 * here would put "parked" on the wrong row — worse than putting it on none.
 */
export function filedTicketId(event: ClassifiableEvent): string | null {
  for (const path of event.paths ?? []) {
    const m = path.match(/^docs\/tickets\/([A-Za-z]{2,}-\d+[a-z]?)\b/);
    if (m) return `${m[1].split('-')[0].toUpperCase()}-${m[1].split('-').slice(1).join('-').toLowerCase()}`;
  }
  return null;
}
