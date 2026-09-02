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
 * How ready a venture actually is to be told something (FB-143).
 *
 * Three states, not two. `hasComposer` only ever asked whether the venture had a **box**, and the
 * failure the admin ledger warns about is the other one: *"Caldera's composer key is not set; its
 * founder meets a dead button on day one. Fix before invite."* A venture can have a machine and
 * still have no key, and on the one screen a founder judges the studio by, the difference between
 * those is a control that works and a control that fails on press.
 */
export type VentureWiring = 'ready' | 'no-box' | 'no-key';

/**
 * What this page will hold, in the design's own words — with one change.
 *
 * The design writes *"your agents, live, at their desks"*. `copy-lint` refuses it, and rightly: the
 * founder vocabulary has said "your team" since FB-103, after the studio drifted back into
 * engineering words four separate times (FB-024, FB-063, FB-068, FB-100). "Agent" is the word that
 * rule exists for, and day one is the worst possible screen to introduce it on — a founder meets it
 * before they know what any of this is.
 *
 * The image is the design's; the word is the contract's.
 */
export const DAY_ONE_COMING: readonly string[] = [
  'The office: your team, live, at their desks.',
  'Tickets: everything you have asked for, each one followable to where it changed things.',
  'A queue that counts only what waits on you.',
];

/**
 * The welcome a founder meets on day one.
 *
 * Deliberately one action. The ticket's own words: *nothing else competes with it.* A second button
 * on this screen is a choice, and a choice on an empty product is a way of asking someone who has
 * just arrived to guess what the thing is for.
 *
 * ## "Arca is ready", and not "Good morning"
 *
 * The design's line is *"Good morning. Arca is ready."* The half that does the work is the second
 * one — it is what turns an empty screen from evidence of a broken product into evidence of a ready
 * one. The first half is a claim about the reader's local time that the studio cannot check: a
 * founder outside Edinburgh is greeted with the wrong time of day on the one screen whose entire job
 * is to be believed. So the readiness stays and the clock goes.
 *
 * ## The action is offered only when it would work
 *
 * A dead control is forbidden by the design contract, and this is the screen most likely to ship
 * one — the people building it never see it, because everyone works on a venture ten weeks in.
 */
export function welcome(ventureName: string, founderFirstName: string | null, wiring: VentureWiring): {
  greeting: string;
  body: string;
  action: { label: string; href: (ventureId: string) => string } | null;
  waiting: string | null;
  /** What this page will hold. Always — the design shows it beside the action, not instead of it. */
  coming: readonly string[];
} {
  const greeting = founderFirstName
    ? `Welcome, ${founderFirstName}. ${ventureName} is ready.`
    : `${ventureName} is ready.`;

  if (wiring === 'ready') {
    return {
      greeting,
      body: `Your team is set up and waiting for its first piece of work. Start with what you `
        + `already have: research, notes, a deck, exports from other conversations. Hand it over, `
        + `and it becomes what ${ventureName} knows.`,
      action: { label: 'Tell the studio what you want', href: (id) => `/venture/${id}/composer` },
      waiting: null,
      coming: DAY_ONE_COMING,
    };
  }

  // Not ready. Say which, say who fixes it, and offer NO control — the founder cannot act on either
  // of these, and a button that fails on press would teach them the product is broken on the first
  // screen they ever see.
  return {
    greeting: founderFirstName ? `Welcome, ${founderFirstName}.` : `Welcome to ${ventureName}.`,
    body:
      wiring === 'no-box'
        ? `${ventureName} is set up, but its own machine is still being built. That is where your `
          + 'work gets done, and Bruntsfield is handling it — there is nothing for you to do.'
        : `${ventureName} has its own machine, but the studio cannot reach it yet. Bruntsfield is `
          + 'finishing the connection — there is nothing for you to do, and nothing is lost.',
    action: null,
    waiting: 'This page fills up on its own once it is ready.',
    coming: DAY_ONE_COMING,
  };
}

/** The first name, for a greeting. Falls back to the whole string rather than to nothing. */
export function firstName(founderName: string | null): string | null {
  const trimmed = founderName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}
