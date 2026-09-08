/**
 * Founder-facing glossary (FB-024). One place for the plain-English words a non-technical founder
 * reads, so the same concept always shows the same words. The engineering reality underneath (pull
 * requests, merges, lanes) is UNCHANGED — these are labels only. Internal ids, routes, test ids and
 * bcap-contracts field names keep their technical names; only visible copy comes from here.
 *
 * FB-103 made this a contract rather than a convenience. `VOCABULARY` below is the whole list of
 * words the studio is allowed to teach a founder; `scripts/copy-lint.mjs` fails CI on the
 * engineering words it replaces; and the Handbook chapter "Using your studio" teaches exactly this
 * list (pinned by lib/__tests__/glossary.test.ts, so the two cannot drift apart).
 */

import type { TicketStatusGroup } from './tickets';

/**
 * Plain-English label for each ticket status, shown to founders (board columns + the ticket drawer).
 * "pr-open" — a change proposed and waiting on the human approval gate — reads as "Needs your OK"
 * rather than the git term "PR open".
 */
export const STATUS_LABEL: Record<TicketStatusGroup, string> = {
  // Not "on a branch" and not "PR open". What a founder did was file it; what has not happened yet
  // is anyone agreeing to start. FB-120.
  filed: 'Just filed',
  todo: 'To do',
  'in-progress': 'In progress',
  'pr-open': 'Needs your OK',
  done: 'Done',
};

/** Founder-facing term for an agent "lane" (the URL /lanes and the `lane` contract field stay). */
export const WORKSTREAM = 'Workstream';
export const WORKSTREAMS = 'Workstreams';

/**
 * The one name for the thing that does the work (FB-103).
 *
 * It had four: "the lane", "the agent", "the engine", and — in a couple of places — its product
 * name. A founder meeting four names for one actor cannot tell whether four things are happening,
 * and every surface added since inherited whichever name its author happened to have in mind. One
 * name, introduced once, used everywhere.
 */
export const TEAM_TITLE = 'Your team';

/**
 * The introduction, shown where the founder first meets the name (the board's activity panel).
 * Word for word the Handbook's opening, because a founder who read the chapter should recognise the
 * sentence, and one who never will should not need it.
 */
export const TEAM_INTRO = 'AI working on this venture’s own machine, around the clock.';

/**
 * The machinery's own names for itself, and the one name a founder reads (FB-103).
 *
 * `inFounderWords` below is for text the studio did NOT write: a stopped run's reason comes off the
 * venture's own machine, in the machine's vocabulary, and the brief quotes it verbatim — so the
 * board says "Your team — AI working on this venture's own machine" at the top and "The lane tried
 * this 3 times" four lines below it. A linter cannot catch that: the words arrive at runtime.
 *
 * Deliberately only the actor's names. Rewriting a machine's account of what it did any further
 * would be putting words in its mouth, and the founder is reading it precisely because it is the
 * machine's own account.
 */
/**
 * Whole phrases the box has already written, before the bare names are touched (FB-205).
 *
 * ## Why a phrase table and not a cleverer rule
 *
 * Substituting a noun phrase ("your team") for a bare noun ("lane") breaks grammar in three
 * positions, and all three are on ARCA's desk today:
 *
 *   - **Attributive.** *"Daily lane budget reached"* became **"Daily your team budget reached"** —
 *     the most repeated line in ARCA's history, on a venture that has written 3,461 of them, so very
 *     likely the sentence a founder has read more often than any other in this studio.
 *   - **After an indefinite article.** *"a lane cannot forge it"* became "a your team cannot forge
 *     it", in the executor's account of a grant that failed its attestation.
 *   - **As a telegraphic subject.** *"Lane awake — nothing to work right now"* became "Your team
 *     awake", which is not a sentence.
 *
 * No regular expression can tell *"lane budget"* (a lane describing a budget) from *"lane
 * arca-build stopped"* (a lane that acted) — the difference is what part of speech the next word is,
 * and a rewriter that guessed would be wrong on a venture whose repository happens to be called
 * `budget`. So this is an explicit table rather than a rule, and that is honest here for a reason
 * the general case does not have: **we write the box.** These are not sentences from a stranger;
 * they are the five summaries `deploy/lane/run-once.sh` writes and one from the executor, and they
 * are enumerable because we wrote them.
 *
 * The box no longer writes any of them — FB-205 fixed the source too, so a new report needs no
 * rewriting at all. This table is for the history, which never changes: ARCA has 3,461 reports on
 * its state ref saying the old words, and they will still be there in a year.
 *
 * Anything not listed falls through to the name rules below, which is what happens today.
 */
const MACHINE_PHRASES: [RegExp, string][] = [
  // Longest first: "lane awake with nothing…" must not be eaten by "lane awake".
  [/\bdaily lane budget reached\b/gi, 'your team’s daily budget is used up'],
  [/\blane awake with nothing it may work\b/gi, 'your team is awake with nothing it may work'],
  [/\blane awake\b/gi, 'your team is awake'],
  [/\ban? (?:agent )?lane\b/gi, 'your team'],
  [/\b(?:the )?(?:agent )?lane’s\b/gi, 'your team’s'],
  [/\b(?:the )?(?:agent )?lane's\b/gi, 'your team’s'],
];

const MACHINE_NAMES: [RegExp, string][] = [
  [/\bthe (?:agent )?lanes?\b/gi, 'your team'],
  [/\bthe agents?\b/gi, 'your team'],
  [/\bthe engine\b/gi, 'your team'],
  [/\b(?:agent )?lanes?\b/gi, 'your team'],
];

/** Say a machine-authored sentence in the founder's vocabulary, keeping its meaning and its case. */
export function inFounderWords(text: string): string {
  return [...MACHINE_PHRASES, ...MACHINE_NAMES].reduce(
    (out, [pattern, plain]) =>
      out.replace(pattern, (match) =>
        /^[A-Z]/.test(match) ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain,
      ),
    text,
  );
}

/**
 * The vocabulary contract: every term the studio may teach a founder, with its plain meaning.
 *
 * This is not documentation of the code — it is the list of words allowed on a founder's screen.
 * Adding a concept to the product means adding its word here and to the Handbook chapter, in that
 * order. If a concept cannot be said in this vocabulary, it is not ready to be shown.
 */
export const VOCABULARY: { term: string; means: string }[] = [
  { term: 'your team', means: 'AI working on this venture’s own machine, around the clock. It never decides what your product should be, and never sends anything outside the company without your OK.' },
  { term: 'the composer', means: 'Where you tell the studio what you want, in plain English. It reads the work back to you before it files anything.' },
  { term: 'ticket', means: 'One written piece of work: what you asked for, what it covers, and what "done" means.' },
  { term: 'Needs you', means: 'The one list of decisions waiting on you. Nothing in it moves until you act.' },
  { term: 'accept', means: 'Your OK. The moment a piece of finished work becomes part of your product.' },
  { term: 'automatic checks', means: 'Tests your venture’s own code runs on itself. "No automatic checks" means there are none yet, so your read of the work is the only check.' },
  { term: 'stuck — needs a human', means: 'Your team tried, could not get past its own quality checks, and stopped rather than force something bad through.' },
  { term: 'What happened', means: 'The diary of everything that shipped, newest first.' },
  { term: 'What your venture knows', means: 'Every decision and document you have given the venture. Your team reads it before it works.' },
  { term: 'surface', means: 'One side of the venture — Build, Sell or Scale — with its own work and its own way of being approved.' },
];

/**
 * Plain reassurance that replaces the jargon "the workshop never merges, so each one needs a human".
 * Keeps the meaning — a human approves before anything goes live — without the git vocabulary.
 */
export const APPROVAL_REASSURANCE = 'Nothing goes live until you approve it.';


/**
 * What the automatic checks say, in the founder's words (FB-064, shared by FB-076).
 *
 * Here rather than in a component because two surfaces show the same fact and they drifted: the
 * work view said "This work has no automatic checks" while the attention queue said `CI UNKNOWN`
 * in monospace small-caps beside every item. Same underlying state, reassuring on one screen and
 * alarming on the other.
 *
 * `unknown` is the one that matters most: it means the repository has no automatic checks at all,
 * which is true of a young venture and completely fine. `unavailable` means the studio could not
 * find out — a different thing, and never presentable as a pass.
 */
export const CHECK_LABEL: Record<string, string> = {
  success: 'All automatic checks passed',
  failure: 'The automatic checks did not pass',
  pending: 'The automatic checks are still running',
  unknown: 'This work has no automatic checks',
  unavailable: 'The studio could not read the automatic checks',
};
