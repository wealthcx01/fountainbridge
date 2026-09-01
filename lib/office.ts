/**
 * The office (FB-139) — what each of a venture's agents is doing, right now.
 *
 * The design's answer to *"why would anyone keep this open all day"*, and its constraint is the
 * whole ticket:
 *
 * > The office is the feeling; this ledger is the record. **Same events, so they cannot disagree.**
 *
 * A pretty plate driven by different data from the table beside it would be a lie with a nice
 * picture on it. So this module produces **one array**, and both renderings map over it. The test
 * that asserts they cannot disagree is not a test of two code paths — there is only one.
 *
 * ## Where the feed comes from, and why it is not a new one
 *
 * The venture box already publishes exactly this, every wake, to its own `foundry-state` ref: a run
 * report with `endedAt: null` **is** "this agent is working right now, on this ticket", and the
 * heartbeat is "the machine is alive". The studio reads it the way it reads everything else.
 *
 * The alternative — a new `office.json` written by a new box-side script — would have needed a
 * delivery path this repo does not have (three merged box-side tickets are currently on no box), a
 * new failure mode, and a second source of truth about the same events. The design says the plate
 * and the ledger must agree; the surest way to make two things agree is for there to be one thing.
 *
 * The studio consumes and never writes. The box remains the authority on its own agents.
 *
 * ## Granularity, stated honestly
 *
 * The design says *"each character is 1 agent on Arca's machine"*. One character here is one
 * **surface** — Build, Sell, Scale — because that is what the box actually reports: one lane per
 * surface, one wake at a time. On ARCA those are the same thing. If a surface ever runs two agents
 * at once, this shows one character doing the newest thing, and that would be the moment to ask the
 * box for more detail rather than to guess at it here.
 */

import type { RunReport } from './runreports';
import type { PrApproval } from './attention';

/**
 * What one desk is doing.
 *
 * `not-live` is a state about the MACHINE, not the agent, and it is why the plate can never freeze
 * on a stale scene: a box that stops reporting turns every desk to `not-live` rather than leaving
 * them where they were, which would be the most convincing possible lie.
 */
export type DeskState = 'working' | 'waiting-on-you' | 'idle' | 'not-live';

export interface OfficeDesk {
  departmentId: string;
  name: string;
  state: DeskState;
  /** What it is doing, in the words the lane wrote. Null when it is not doing anything. */
  doing: string | null;
  /** The ticket it is on, when the report named one. */
  ticketId: string | null;
  /** When it started, so the ledger can say how long. */
  since: string | null;
  /** How many things this surface has waiting on the founder — the raised hand's reason. */
  waitingOnYou: number;
}

export interface Office {
  desks: OfficeDesk[];
  /** False when the machine is not reporting. The plate says so rather than drawing a still room. */
  live: boolean;
  /** The machine's own sentence — `engineState`'s, so the plate and the rail say one thing. */
  text: string;
}

export interface OfficeInput {
  departments: ReadonlyArray<{ id: string; name: string; repo: string | null; provisioned: boolean }>;
  /** Every run report the desk already holds. Heartbeats are excluded by the caller's loader. */
  runs: readonly RunReport[];
  /** Open work waiting on the founder, so a raised hand means the same thing the banner counts. */
  waiting: readonly PrApproval[];
  /** `engineState`'s verdict on the machine. */
  engine: { state: 'running' | 'quiet' | 'stalled' | 'unknown'; text: string };
}

/**
 * The newest report for a surface, in flight or finished.
 *
 * Newest by start time rather than by position: reports arrive per repository and the studio reads
 * them in whatever order the directory listed, and "what is this agent doing right now" must not
 * depend on that.
 */
function newestFor(runs: readonly RunReport[], repo: string | null): RunReport | null {
  if (!repo) return null;
  return runs
    .filter((r) => !r.isHeartbeat && r.repo === repo)
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0))
    .pop() ?? null;
}

/**
 * One list, from which both the plate and the ledger are drawn.
 *
 * Precedence per desk, and the order is the argument:
 *
 * 1. `not-live` — the machine is not reporting. Nothing else on the desk can be trusted, including
 *    its stillness.
 * 2. `working` — a report with no end time. The agent is mid-wake.
 * 3. `waiting-on-you` — the raised hand. Not idle: this surface has finished something and is
 *    blocked on a person, which is a different thing from having nothing to do.
 * 4. `idle` — nothing running and nothing waiting.
 *
 * A surface with no repository yet is `idle` with the design's own line about it, never a character
 * pretending to work.
 */
export function buildOffice(input: OfficeInput): Office {
  const live = input.engine.state === 'running' || input.engine.state === 'quiet';

  const desks: OfficeDesk[] = input.departments.map((d) => {
    const waitingOnYou = d.repo ? input.waiting.filter((w) => w.repo === d.repo).length : 0;
    const newest = newestFor(input.runs, d.repo);
    const inFlight = newest !== null && newest.endedAt === null;

    const state: DeskState = !live
      ? 'not-live'
      : inFlight
        ? 'working'
        : waitingOnYou > 0
          ? 'waiting-on-you'
          : 'idle';

    return {
      departmentId: d.id,
      name: d.name,
      state,
      // Only while it IS working. A finished report's summary describes what the agent did, not what
      // it is doing, and a ledger headed "Doing, right now" must not answer with the past tense.
      doing: state === 'working' ? firstLine(newest?.summaryMd) : null,
      ticketId: state === 'working' ? (newest?.ticketsTouched[0] ?? null) : null,
      since: state === 'working' ? (newest?.startedAt ?? null) : null,
      waitingOnYou,
    };
  });

  return { desks, live, text: input.engine.text };
}

/** The lane's first sentence. Reports are markdown; a plate is one line. */
function firstLine(md: string | undefined): string | null {
  if (!md) return null;
  const line = md.split('\n').map((l) => l.replace(/^#+\s*/, '').trim()).find((l) => l.length > 0);
  return line ? line.slice(0, 120) : null;
}

/** What a desk is doing, for the ledger's second column. One sentence per state, never a blank. */
export function deskDoing(desk: OfficeDesk): string {
  switch (desk.state) {
    case 'not-live':
      return 'Not reporting.';
    case 'working':
      return desk.doing ?? 'Working.';
    case 'waiting-on-you':
      return `Finished — ${desk.waitingOnYou} thing${desk.waitingOnYou === 1 ? '' : 's'} waiting on you.`;
    case 'idle':
      return 'Nothing on right now.';
    default: {
      const unhandled: never = desk.state;
      return unhandled;
    }
  }
}

/** The line under the plate: how many are working, how many have a hand up. */
export function officeSummary(office: Office): string {
  if (!office.live) return office.text;
  const working = office.desks.filter((d) => d.state === 'working').length;
  // THINGS waiting, not desks with a hand up.
  //
  // This counted desks and read "3 waiting on you" over a ledger whose rows added to six. Two
  // numbers on one screen that appear to disagree is the FB-099 defect, and here it was worse than
  // usual: the smaller number was the reassuring one, on the count a founder acts on. It is the
  // same total the blocker banner states, so the desk cannot say two things about one queue.
  const hands = office.desks.reduce((n, d) => n + (d.state === 'waiting-on-you' ? d.waitingOnYou : 0), 0);
  if (working === 0 && hands === 0) return 'Nobody is working and nobody is waiting on you.';
  const parts: string[] = [];
  if (working) parts.push(`${working} working`);
  if (hands) parts.push(`${hands} thing${hands === 1 ? '' : 's'} waiting on you`);
  return `${parts.join(', ')}.`;
}
