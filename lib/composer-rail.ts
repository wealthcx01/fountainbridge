/**
 * The composer's right-hand rail (FB-131).
 *
 * ## Why this exists
 *
 * The composer is a conversation with a filing tool at the end. The design gives it a rail showing
 * **the thing being made, while it is being made** — so a founder watches a ticket take shape out of
 * their own words and presses once, instead of reading a wall of markdown and hoping.
 *
 * ## The property this module exists to hold
 *
 * **Exactly one state, never two.** Five things can be on the table and a founder must be looking at
 * one of them: a ticket taking shape, a plan taking shape, the ticket they arrived to discuss, what
 * they just filed, or nothing yet. Two at once is two answers to "what am I about to press", which
 * is the one question this screen exists to answer.
 *
 * So the decision is a single function returning a discriminated union, tested on its own. The
 * component renders what it is given and chooses nothing.
 */

import { parseReply, type ReplyBlock } from './composer';
import { extractPlanDraft, type PlanDraft } from './plan-draft';

/** A ticket taking shape, in the four parts the design shows. */
export interface DraftSections {
  title: string;
  /** In the founder's own words, from this conversation. */
  why: string | null;
  /** What ships. Bullets, as written. */
  scope: string[];
  /** How they will know it is done. */
  doneWhen: string | null;
}

export type RailState =
  /** They pressed, and this is what happened next. */
  | { kind: 'filed'; what: string; href: string | null }
  /** Arrived from a ticket (`?about=`): the conversation revises that ticket. */
  | { kind: 'discussing'; ticketId: string }
  /** A document became a set (FB-127). */
  | { kind: 'plan'; plan: PlanDraft }
  /** One ticket, taking shape. `revises` is set when the founder arrived from a ticket. */
  | { kind: 'draft'; draft: DraftSections; revises: string | null }
  /** Nothing on the table yet, which is most of the time and is not an error. */
  | { kind: 'empty' };

export interface RailInput {
  /** The newest assistant message, or null when the founder has not been answered yet. */
  latestReply: string | null;
  /** `?about=` — the ticket this conversation is about. */
  aboutTicketId: string | null;
  /** What the founder filed in this session, if anything. */
  filed: { what: string; href: string | null } | null;
}

/**
 * Which one of the five.
 *
 * The order is the argument, and it changed once already:
 *
 * 1. **What they just filed** wins. A founder who has pressed needs to know what happened, and
 *    showing them the draft again invites a second press on work that already exists.
 * 2. **A plan**, then **a draft** — anything actually on the table.
 * 3. **The ticket they came to discuss**, when nothing is. That is exactly when it is useful:
 *    orientation before there is anything to press.
 * 4. **Nothing**, which is most turns.
 *
 * The first version put `discussing` above the draft, matching the design's tree — and that removed
 * the only way to file from the whole revision flow. A founder arriving from a ticket ("Ask for
 * changes to this"), talking it through and getting a draft back had **no button anywhere**, because
 * this returned `discussing` for the life of the page and that state renders no press. The design's
 * tree is about what to show; it was never about where the press lives.
 */
export function railState(input: RailInput): RailState {
  if (input.filed) return { kind: 'filed', what: input.filed.what, href: input.filed.href };

  const blocks = input.latestReply ? parseReply(input.latestReply) : [];
  const plan = extractPlanDraft(blocks);
  if (plan) return { kind: 'plan', plan };

  const draft = draftSections(blocks);
  if (draft) return { kind: 'draft', draft, revises: input.aboutTicketId };

  if (input.aboutTicketId) return { kind: 'discussing', ticketId: input.aboutTicketId };
  return { kind: 'empty' };
}

const HEADING = /^\s{0,3}#{1,6}\s+(.*\S)\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(?:\[[ xX]?\]\s*)?(.*\S)\s*$/;

/**
 * The four parts, read out of the ticket the composer drafted.
 *
 * Read rather than re-summarised. The rail's promise is *"every line came from the conversation"*,
 * and a rail that paraphrased the draft would be a third rendering of the same ticket — after the
 * markdown and the filed file — free to disagree with both.
 *
 * Returns null when there is no draft, which is not a failure: most turns have none.
 */
export function draftSections(blocks: ReplyBlock[]): DraftSections | null {
  const draft = blocks.find((b) => b.kind === 'draft');
  if (!draft) return null;

  const lines = draft.text.split('\n');
  let title = '';
  const sections = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of lines) {
    const heading = line.match(HEADING);
    if (heading) {
      const text = heading[1];
      // The first heading is the ticket's own title, with any id the filer has not yet replaced.
      if (!title) {
        title = text.replace(/^[A-Za-z]+-(?:NEW|\d+[a-z]?)\s*[—–-]\s*/, '').trim();
        current = null;
        continue;
      }
      current = text.toLowerCase();
      sections.set(current, []);
      continue;
    }
    if (current && line.trim()) sections.get(current)?.push(line);
  }

  const find = (...needles: string[]): string[] => {
    for (const [name, body] of sections) {
      if (needles.some((n) => name.includes(n))) return body;
    }
    return [];
  };

  const prose = (body: string[]): string | null => {
    const text = body.filter((l) => !BULLET.test(l)).join(' ').replace(/\s+/g, ' ').trim();
    return text || null;
  };
  const bullets = (body: string[]): string[] =>
    body.map((l) => l.match(BULLET)?.[1]).filter((b): b is string => Boolean(b));

  const scopeBody = find('scope');
  const doneBody = find('acceptance', 'done when', 'done');

  const sectioned: DraftSections = {
    title: title || 'Untitled',
    why: prose(find('why this matters', 'why')),
    scope: bullets(scopeBody).length ? bullets(scopeBody) : prose(scopeBody) ? [prose(scopeBody) as string] : [],
    doneWhen: bullets(doneBody)[0] ?? prose(doneBody),
  };

  // A fenced block with no heading at all is a code sample, not a ticket, and gets no press.
  //
  // But a block WITH a heading is fileable even when none of the sections parse. The composer's
  // prompt lives on a venture box, not in this repository, so the studio cannot assume the
  // `## Scope` / `## Acceptance criteria` shape holds — and the first version of this returned null
  // for anything else, which silently removed the founder's only way to file. A thin rail that
  // shows a title and an empty form is visibly thin; a missing button is invisible (CLAUDE.md #10).
  return title ? sectioned : null;
}
