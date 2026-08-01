/**
 * Day one, and what an empty panel should say (FB-066).
 *
 * ## The problem this exists to fix
 *
 * A founder signs in for the first time and meets four empty boxes: "no agent lane running yet", a
 * greyed composer note, "No runs recorded yet", and two repositories with "No tickets on the default
 * branch". Every sentence is well written. Together they offer nothing to do, which teaches the
 * founder in the first ten seconds that the product does nothing.
 *
 * That is the same criticism the composer and I both levelled at ARCA's own Overview — nine empty
 * panels and no way forward — pointed at our own front door.
 *
 * ## The distinction everything here turns on
 *
 * **"Nothing has happened yet" and "we could not find out" are different facts**, and a first-run
 * welcome shown for the second one is a lie: it tells a founder their venture is a blank page when
 * really the studio could not read it. So a welcome is only ever shown when every read succeeded and
 * genuinely came back empty. Any read failure — an unreachable repo, an unreadable state ref, a
 * budgets file that would not parse — takes the welcome off the table, whatever else is true.
 */

/** What the board should be, before any of it is rendered. */
export type BoardState =
  /** Everything read cleanly and there is nothing yet. One action, no panels. */
  | { kind: 'first-run' }
  /** Nothing to show AND something could not be read. Never a welcome — say what failed. */
  | { kind: 'unreadable'; reasons: string[] }
  /** There is something to show. */
  | { kind: 'board' };

export interface BoardSignals {
  /** Tickets found across every lane. */
  ticketCount: number;
  /** RunReports the lanes have written. */
  runCount: number;
  /** Approvals in any state. */
  approvalCount: number;
  /**
   * Things the venture's repositories have already done — a commit, a merged PR, a CI run, however
   * long ago.
   *
   * This exists because leaving it out was a live bug. THE RESET's platform repo has a **failing
   * build from January** and nothing else: no tickets, no runs, no approvals. Without this signal the
   * board decided the venture was brand new and greeted the founder with "nothing has happened yet,
   * which is exactly right for day one" — over a red build. A venture with a broken build is not a
   * blank page, and comforting someone about a problem they have is the exact failure this ticket
   * was written to fix, committed on the screen that fixes it.
   */
  historyCount: number;
  /**
   * Human-readable reasons a read failed — an unreachable repo, an unreadable state ref, a budgets
   * file that would not parse. Non-empty means the picture is incomplete, whatever else is true.
   */
  readFailures: string[];
}

export function boardState(s: BoardSignals): BoardState {
  const empty = s.ticketCount === 0 && s.runCount === 0 && s.approvalCount === 0 && s.historyCount === 0;
  if (!empty) return { kind: 'board' };
  // Empty AND something failed: the emptiness may be the failure. Saying "welcome, nothing here yet"
  // would be inventing a fact out of a missing one.
  if (s.readFailures.length > 0) return { kind: 'unreadable', reasons: s.readFailures };
  return { kind: 'first-run' };
}

/**
 * What an empty panel should say.
 *
 * Two sentences, always in the same shape: **what would fill this**, then **how it starts**. "No runs
 * recorded yet" is true and useless; a founder cannot tell from it whether they are waiting for
 * something, whether something is broken, or whether they were supposed to do something first.
 *
 * `hasComposer` matters because the answer to "how does this start" is usually *tell the studio what
 * you want* — and a venture without a box has no composer to be told. Offering an action that does
 * not exist yet is worse than offering none.
 */
export interface EmptyPanel {
  /** What this panel would contain, once there is something. */
  what: string;
  /** The step that begins it — or null when there is nothing the founder can do yet. */
  how: string | null;
}

export function emptyPanel(panel: 'tickets' | 'runs' | 'approvals' | 'activity', hasComposer: boolean): EmptyPanel {
  const tellIt = hasComposer
    ? 'Tell the studio what you want and it becomes work here.'
    : null;
  const waiting = 'This starts once your venture’s box is set up — nothing for you to do yet.';

  switch (panel) {
    case 'tickets':
      return {
        what: 'The work your venture is doing, and what it is waiting on.',
        how: tellIt ?? waiting,
      };
    case 'runs':
      return {
        what: 'What your team did each time it woke up — what it built, and anything it got stuck on.',
        how: hasComposer ? 'The first run happens after there is a piece of work to do.' : waiting,
      };
    case 'approvals':
      return {
        // Nothing to do here is the GOOD state, and it should read that way rather than as a gap.
        what: 'Anything about to go outside your company — an email, a post, a payment.',
        how: 'Nothing is waiting for you. Anything that needs your OK will appear here first.',
      };
    case 'activity':
      return {
        what: 'A running account of what changed, newest first.',
        how: tellIt ?? waiting,
      };
    default: {
      const _exhaustive: never = panel;
      return _exhaustive;
    }
  }
}

/**
 * The welcome a founder meets on day one.
 *
 * Deliberately one action. The ticket's own words: *nothing else competes with it.* A second button
 * on this screen is a choice, and a choice on an empty product is a way of asking someone who has
 * just arrived to guess what the thing is for.
 */
export function welcome(ventureName: string, founderFirstName: string | null, hasComposer: boolean): {
  greeting: string;
  body: string;
  action: { label: string; href: (ventureId: string) => string } | null;
  waiting: string | null;
  /** What this page will hold. Shown when there is no action, so the page explains itself. */
  coming: string[];
} {
  const greeting = founderFirstName ? `Welcome, ${founderFirstName}.` : `Welcome to ${ventureName}.`;
  if (!hasComposer) {
    return {
      greeting,
      body: `${ventureName} is set up, but its own machine is still being built. That is where your `
        + 'work gets done, and it is being handled — you do not need to do anything.',
      action: null,
      waiting: 'This page will fill up on its own once it is ready.',
      // A page with nothing to do on it and nothing to read is indistinguishable from a broken one.
      // If a founder cannot act, they should at least leave knowing what this page is for.
      coming: [
        'The work your venture is doing, and what it is waiting on.',
        'What your team did each time it woke up.',
        'Anything about to go outside your company, waiting for your OK.',
      ],
    };
  }
  return {
    greeting,
    body: 'Nothing has happened yet, which is exactly right for day one. Start by telling the studio '
      + 'what you want — in plain English, the way you would tell a person. It will ask a question '
      + 'or two, read the work back to you, and build nothing until you say yes.',
    action: { label: 'Tell the studio what you want', href: (id) => `/venture/${id}/composer` },
    waiting: null,
    // Nothing listed: there IS one thing to do, and a list beside it would compete with it.
    coming: [],
  };
}

/** The first name, for a greeting. Falls back to the whole string rather than to nothing. */
export function firstName(founderName: string | null): string | null {
  const trimmed = founderName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}
