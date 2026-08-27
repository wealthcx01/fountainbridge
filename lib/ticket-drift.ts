/**
 * When a ticket file disagrees with what actually shipped (FB-070).
 *
 * ## Why this exists
 *
 * The board is the answer to "what is happening in my company". On 2026-07-31, **eight tickets said
 * "In review" or "In progress" for work that was merged and deployed** — including everything shipped
 * that day. A board that says work is still in progress days after it went live is worse than no
 * board, because a founder who catches it once stops believing the rest of it and goes to look
 * somewhere else.
 *
 * Nothing marks a ticket as shipped. The lane flips `Todo` → `In progress` when it claims one, and
 * then nothing ever moves it on: a human merging a pull request does not touch the ticket file, so
 * the last recorded truth is whatever someone last thought to type.
 *
 * The eight were corrected by hand. Correcting them by hand is not a fix — it is the reason to build
 * one, and this is the one that fails loudly in CI rather than waiting to be noticed again.
 *
 * ## Telling a shipping commit from a ticket-filing commit
 *
 * The obvious rule — "a commit whose subject starts with the ticket id" — misses real cases. FB-064's
 * code shipped under `docs: the founder's journey, and the five tickets that deliver it (#67)`,
 * because several tickets landed alongside it. The obvious rule would have called that ticket
 * unshipped, which is the same failure in the other direction.
 *
 * What separates them reliably is **what the commit touched**. A commit that files a ticket changes
 * `docs/tickets/` and nothing else; a commit that ships one changes code, scripts or deploy recipes.
 *
 * ## Why "mentions the id anywhere" is the wrong rule
 *
 * The first version counted any shipping commit whose message contained the id, and it produced
 * confident nonsense: FB-034 was reported shipped on the evidence of *"FB-050: the venture brain"*,
 * which merely referenced it in passing, and FB-039 on the evidence of an FB-044 commit. A check that
 * cites the wrong reason is one a developer learns to skim, and a check people skim is worse than no
 * check at all.
 *
 * ## The one rule, and the two that were tried and thrown away
 *
 * Evidence is: **a commit that changed code, whose SUBJECT names the ticket.**
 * `FB-065: bring the composer inside the studio (#68)`. Someone wrote that id into the title of the
 * thing they were shipping. That is deliberate, and it is the repository's own convention — one
 * ticket, one branch, one pull request (CLAUDE.md #1).
 *
 * Two looser rules were tried against the real history and thrown away:
 *
 *  - **"the message mentions the id anywhere"** reported FB-034 shipped on the evidence of
 *    *"FB-050: the venture brain"*, which merely referenced it in passing. A check that cites the
 *    wrong reason is one a developer learns to skim.
 *  - **"the ticket's own file changed in a commit that also changed code"** looked stronger and was
 *    worse. When one pull request ships one ticket and *files five more* — which is exactly what
 *    `docs: the founder's journey…` did — every newly-filed ticket is created by a code-changing
 *    commit, so all five were reported as already shipped. Filing a ticket is not shipping it, and
 *    no file-based signal can tell the two apart.
 *
 * The cost of the strict rule is honest and small: work that ships under a subject which does not
 * name its ticket is not caught. The alternative was a check that cries wolf, and a gate people
 * switch off protects nothing.
 */

/**
 * Words that mean the work is concluded, matched on the status's FIRST word.
 *
 * First-word matching rather than whole-string equality, because a status carries a qualifier as
 * often as not — "Closed — not a defect", "Done (partly reverted)". Requiring an exact match makes
 * the check demand that a perfectly honest status be flattened into one word, which is the opposite
 * of what it is for. "In review" and "In progress (design)" both start with "in" and stay flagged.
 */
const FINISHED = new Set(['done', 'shipped', 'merged', 'closed', 'withdrawn', 'superseded']);

const firstWord = (status: string): string =>
  status.trim().toLowerCase().split(/[\s—–-]+/)[0] ?? '';

/** Statuses that mean nobody has started, so shipping evidence is even more clearly wrong. */
const NOT_STARTED = new Set(['todo', 'planned', 'open', 'backlog']);

/**
 * The way a ticket says "yes, some of this shipped, and here is what has not".
 *
 * Without an escape hatch a genuinely part-finished ticket could never pass the gate, and the only
 * way out would be to mark it Done — which is the lie this check exists to prevent, arrived at by a
 * different route. So the exemption is deliberately a **visible line in the ticket**, not a hidden
 * comment: a founder reading the ticket sees the same explanation the build does.
 *
 *     **Shipped in part:** the executor is built and tested, but not deployed anywhere yet.
 */
const PART_SHIPPED = /^\s*\*\*Shipped in part:\*\*\s*(\S.*)$/m;

export function partShippedReason(markdown: string): string | null {
  return markdown.match(PART_SHIPPED)?.[1]?.trim() ?? null;
}

export interface TicketRecord {
  id: string;
  /** The `**Status:**` line's value, as written in the file. */
  status: string;
  /** Where a reader would go to fix it. */
  file: string;
  /** The ticket's own explanation of what has not shipped, when it gives one. */
  partShipped?: string | null;
}

export interface ShippingEvidence {
  /** Ticket ids with a commit that mentions them AND changed something outside docs/tickets/. */
  shipped: Set<string>;
  /** For the message: which commit was the evidence. */
  commitFor: Map<string, string>;
}

export interface Drift {
  id: string;
  file: string;
  status: string;
  commit: string;
  /** What a reader should do about it, in one sentence. */
  message: string;
}

/**
 * Every ticket whose file contradicts the repository's own history.
 *
 * Deliberately one-directional: it reports a ticket that shipped but does not say so. The reverse —
 * a ticket marked done with no commit — is NOT flagged, because plenty of legitimate work leaves no
 * commit that names it (a decision, a ticket withdrawn, work folded into another). Flagging those
 * would produce noise, and a check people learn to ignore is worse than no check.
 */
export function findDrift(tickets: TicketRecord[], evidence: ShippingEvidence): Drift[] {
  const drift: Drift[] = [];
  for (const t of tickets) {
    if (!evidence.shipped.has(t.id)) continue;
    const status = t.status.trim().toLowerCase();
    if (FINISHED.has(firstWord(status))) continue;
    // The ticket has already answered this, in writing, where a reader will see it.
    if (t.partShipped) continue;

    const commit = evidence.commitFor.get(t.id) ?? '(unknown commit)';
    const verb = NOT_STARTED.has(firstWord(status))
      ? `says "${t.status}" but its work has already shipped`
      : `says "${t.status}" but its work has shipped`;
    drift.push({
      id: t.id,
      file: t.file,
      status: t.status,
      commit,
      message: `${t.id} ${verb} (${commit}). Set its Status to Done — or, if part of it genuinely has `
        + 'not shipped, add a line saying so: **Shipped in part:** <what is left>.',
    });
  }
  return drift.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** The `**Status:** X` value from a ticket's markdown, or null when it has none. */
export function statusFromMarkdown(markdown: string): string | null {
  // Bounded to the line, and stopping at the first separator, so "**Status:** Done · **Phase:** 3"
  // reads as "Done" rather than swallowing the rest of the header.
  const m = markdown.match(/^\s*\*\*Status:\*\*\s*([^·\n|]+)/m);
  return m ? m[1].trim() : null;
}

/** The ticket id a filename encodes: `FB-064-read-and-accept.md` → `FB-064`. */
export function idFromFilename(filename: string): string | null {
  const m = filename.match(/^([A-Z]{2,}-\d+[a-z]?)-/);
  return m ? m[1] : null;
}

/**
 * Does this commit prove its ticket shipped?
 *
 * A commit that only touches `docs/tickets/` filed a ticket; anything else did the work. `paths` is
 * the commit's changed files.
 */
export function isShippingCommit(paths: string[]): boolean {
  return paths.some((p) => p.trim() !== '' && !p.startsWith('docs/tickets/'));
}

const TICKET_ID = /\b[A-Z]{2,}-\d+[a-z]?\b/g;

/**
 * A range of ticket ids: `FB-124…FB-142`, `FB-124...FB-142`, `FB-124 – FB-142`.
 *
 * Matched so it can be REMOVED before ids are read (FB-145). A range names a set the string does not
 * enumerate — `FB-124…FB-142` is a claim about nineteen tickets, of which it spells two — so reading
 * its endpoints as "these shipped" is reading punctuation as evidence.
 *
 * `main` went red on exactly this: the planning commit for the desk redesign said
 * "…and FB-124…FB-142", and the checker demanded FB-142 be marked Done for work that had not started.
 */
const TICKET_ID_RANGE = /\b[A-Z]{2,}-\d+[a-z]?\s*(?:\.{2,3}|…|—|–|-{1,2}>?|\bto\b)\s*[A-Z]{2,}-\d+[a-z]?\b/g;

/**
 * Which tickets one commit is evidence for — the two precise signals, and nothing looser.
 *
 * Returns nothing for a commit that shipped no code, whatever its message says: a ticket-filing
 * commit naming five tickets is evidence about none of them.
 */
export function ticketsShippedBy(commit: { subject: string; paths: string[] }): string[] {
  if (!isShippingCommit(commit.paths)) return [];
  // FB-145: ranges out first. An id only counts when the subject names it on its own.
  const subject = commit.subject.replace(TICKET_ID_RANGE, ' ');
  return [...new Set(subject.match(TICKET_ID) ?? [])];
}
