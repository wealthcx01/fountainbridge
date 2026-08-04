/**
 * Matching a piece of work to the ticket it came from (FB-099).
 *
 * ## The contradiction this exists to end
 *
 * On ARCA's board, at the same moment: the navigation badge said **"Needs you — 15"**, the brief
 * said fifteen pieces of work were waiting, and every lane's **"Needs your OK"** column said **0**.
 *
 * Both numbers were computed honestly, from different sources, and a founder had no way to know
 * that. The columns group TICKET FILES whose status was inferred from a matching piece of work; the
 * badge counts OPEN WORK from the GitHub API. The fifteen real ones were filed under branch names
 * like `foundry/bulk-daily-price-feed-plan`, which carry no ticket id — so nothing matched, the
 * columns stayed at zero, and the two numbers sat six centimetres apart telling different stories.
 *
 * A founder who trusts the columns concludes there is nothing to review and never opens the queue.
 * A founder who trusts the badge concludes the columns are broken. Either way the board loses, and
 * FB-068's one-fact-one-number rule was written about exactly this.
 *
 * ## What the lane actually produces
 *
 * Three shapes, all seen in `wealthcx01/arca`:
 *
 *   1. `arca-1-terminal-setup` / `ARCA-1: terminal card renderer`   — the id is right there.
 *   2. `foundry/bulk-daily-price-feed-plan`                          — the lane's own branch shape:
 *      no id, but the slug IS the ticket file's name.
 *   3. `build: bulk-daily-price-feed-plan (Foundry lane)`            — the same slug in the title.
 *
 * So the matcher tries the id first (unambiguous, cheap, already worked), then the slug against what
 * the studio knows about the venture's tickets. It never guesses: a slug that matches no ticket
 * stays unmatched, and unmatched work is shown as unmatched rather than quietly dropped — which is
 * the whole failure being fixed.
 *
 * FB-060's structured hand-off is the durable fix (the lane will one day state its ticket outright).
 * Until then the studio has to present today's history well.
 */

// Case-insensitive so a lowercase branch (`fb-007-x`, `grs-0147b-x`) matches; canonicalized to the
// contract form (uppercase prefix, lowercase suffix) so `FB-007` and `fb-007` resolve identically.
const TICKET_ID = /([A-Za-z]{2,})-(\d+)([A-Za-z]?)/;

const canonicalId = (m: RegExpMatchArray) => `${m[1].toUpperCase()}-${m[2]}${m[3].toLowerCase()}`;

/** The ticket id a piece of work states outright, in its branch (`fb-007-x`) or title (`FB-007: …`). */
export function linkedTicketId(work: { branch: string; title: string }): string | null {
  const fromBranch = work.branch.match(TICKET_ID);
  if (fromBranch) return canonicalId(fromBranch);
  const fromTitle = work.title.match(TICKET_ID);
  return fromTitle ? canonicalId(fromTitle) : null;
}

/** The little a match needs to know about a ticket. */
export interface MatchableTicket {
  id: string;
  title: string;
  /** `docs/tickets/ARCA-1-terminal-setup.md` */
  path: string;
  /** The ticket file's declared branch, when it has one. */
  branch: string | null;
}

export interface WorkRef {
  branch: string;
  title: string;
}

/** A ticket file's slug: the basename, minus the id prefix and the extension. */
export function ticketSlug(t: MatchableTicket): string {
  const base = t.path.split('/').pop() ?? t.path;
  return normalise(base.replace(/\.mdx?$/i, '').replace(new RegExp(`^${escapeRe(t.id)}[-_]?`, 'i'), ''));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One shape for comparison: lowercase, and every run of non-letters/digits is a single dash. */
export function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * The slugs a piece of work offers up, best first.
 *
 * The branch before the title, because a branch is a name the lane chose and a title is prose it
 * wrote — and prose picks up prefixes ("build:"), suffixes ("(Foundry lane)") and the occasional
 * sentence. Both are normalised, so `Bulk Daily Price Feed` and `bulk-daily-price-feed` are one
 * thing.
 */
export function candidateSlugs(work: WorkRef): string[] {
  const out: string[] = [];
  const branch = work.branch.replace(/^(foundry|feature|feat|fix|chore)\//i, '');
  if (branch) out.push(normalise(branch));

  // Strip the lane's conventional wrapping off the title before reading it as a slug.
  const title = work.title
    .replace(/\((?:the\s+)?foundry\s+lane\)\s*$/i, '')
    .replace(/^\s*(build|feat|feature|fix|chore|docs)\s*:\s*/i, '')
    .trim();
  if (title) out.push(normalise(title));
  return out.filter((s, i, all) => s && all.indexOf(s) === i);
}

/**
 * The ticket this piece of work belongs to, or null.
 *
 * Null is a real answer. Fifteen unmatched pieces of work is a fact about the venture — the lane is
 * not naming its tickets — and the surfaces are expected to SHOW that rather than let it vanish into
 * a column that then reads zero.
 */
export function matchWorkToTicket(work: WorkRef, tickets: readonly MatchableTicket[]): MatchableTicket | null {
  // 1. An id stated outright wins. Cheap, unambiguous, and how this worked when it worked.
  const id = linkedTicketId(work);
  if (id) {
    const byId = tickets.find((t) => t.id.toLowerCase() === id.toLowerCase());
    if (byId) return byId;
    // An id that names no ticket we can see is still not a licence to slug-guess: `ARCA-99` in a
    // title means the author meant ARCA-99, and matching it to something else would be worse than
    // matching nothing.
    return null;
  }

  const slugs = candidateSlugs(work);
  if (slugs.length === 0) return null;

  for (const slug of slugs) {
    // The ticket's own declared branch is the strongest slug evidence: the lane wrote both.
    const byBranch = tickets.find((t) => t.branch && normalise(t.branch) === slug);
    if (byBranch) return byBranch;
    const byPath = tickets.find((t) => ticketSlug(t) === slug);
    if (byPath) return byPath;
  }
  return null;
}

/** What a founder should see this piece of work called. */
export function workTitle(work: { title: string }, ticket: MatchableTicket | null): string {
  return ticket ? ticket.title : work.title;
}
