/**
 * Routines (FB-047) — recurring work the founder controls, not a timer they cannot see.
 *
 * FB-040 gave every venture a scheduler. It is invisible: it wakes, it works, and a founder has no
 * way to say "do this every Monday", "stop doing that", or "do it now". Cofounder's routines carry a
 * cadence, a last result, and pause/resume/run-once, and its agents *propose* them. This is that,
 * with one addition the parity list does not have and this studio cannot do without.
 *
 * ## A lane proposes. Only a founder approves.
 *
 * A routine is a standing instruction to an agent that runs unattended. If a lane could write its
 * own `approved_at`, it could grant itself permission to act on a schedule forever — the same
 * failure `deploy/lane/proposal-lib.mjs` exists to prevent for external actions, but worse, because
 * a routine is durable and nobody re-reads it after the first day.
 *
 * So the approval fields are not merely ignored on the way in, they are **stripped**:
 * `fromProposal()` builds a fresh object from known fields rather than spreading what the lane
 * wrote. A field nobody reads today is a field somebody trusts tomorrow, and the party writing this
 * record is the party being gated.
 *
 * ## Why the dispatch rules live here and not in the scheduler
 *
 * The box decides what to run; the studio has to show a founder what *will* run and why nothing is
 * running right now. Those are the same question, and answering it in two places is how they come to
 * disagree. The eligibility logic is pure, lives here, and both sides read it.
 */

import type { RunOutcome } from './runreports';
import type { VentureSummary } from './ventures';
import { approvalRepos } from './venture-repos';

/** How often a routine wants to run. Deliberately three words, not a cron expression. */
export type Cadence = 'hourly' | 'daily' | 'weekly';

/**
 * Where a routine is in its life.
 *
 * `proposed` is the only state a lane may write. A routine sitting in `proposed` does nothing at
 * all — an unapproved standing order is a suggestion, and it never runs on its own.
 */
export type RoutineState = 'proposed' | 'active' | 'paused';

export interface Routine {
  id: string;
  venture_id: string;
  /** What it is, in the founder's words: "each week, work the new sign-ups". */
  title: string;
  /** What the agent should actually do each time it runs. */
  standing_order: string;
  cadence: Cadence;
  /** The "is there useful work here?" test applied BEFORE doing anything, so a quiet week costs nothing. */
  criterion: string;
  state: RoutineState;
  /** The lane that suggested it. Never an authority — just provenance. */
  proposed_by: string;
  proposed_at: string;
  /** Set only by a founder's approval, through the studio. A lane writing these is a bug, not a grant. */
  approved_at?: string | null;
  approved_by?: string | null;
  last_run_at?: string | null;
  last_outcome?: RunOutcome | null;
}

/** The gap a routine must leave between runs. */
export const COOLDOWN_MS: Record<Cadence, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const CADENCES = new Set<string>(['hourly', 'daily', 'weekly']);

/** A cadence a lane actually sent, or null. Never a default — a routine with no cadence is not a routine. */
export function readCadence(value: unknown): Cadence | null {
  return typeof value === 'string' && CADENCES.has(value) ? (value as Cadence) : null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Read a lane's proposal into a routine, keeping only what a lane is allowed to say.
 *
 * Returns null when a required field is missing rather than filling in a default. A routine with a
 * guessed cadence or an empty standing order would run unattended forever doing something nobody
 * asked for, and "we defaulted it to daily" is not a thing to discover afterwards.
 */
export function fromProposal(raw: unknown, ventureId: string): Routine | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const id = text(r.id);
  const title = text(r.title);
  const standing_order = text(r.standing_order);
  const criterion = text(r.criterion);
  const proposed_by = text(r.proposed_by);
  const proposed_at = text(r.proposed_at);
  const cadence = readCadence(r.cadence);

  if (!id || !title || !standing_order || !criterion || !proposed_by || !proposed_at || !cadence) {
    return null;
  }

  // Built field by field, never spread. Anything the lane wrote about approval, state or history —
  // `approved_at`, `approved_by`, `state: 'active'`, a fabricated `last_outcome` — does not survive
  // this function, because it is not read from `r`.
  return {
    id,
    venture_id: ventureId,
    title,
    standing_order,
    cadence,
    criterion,
    state: 'proposed',
    proposed_by,
    proposed_at,
    approved_at: null,
    approved_by: null,
    last_run_at: null,
    last_outcome: null,
  };
}

/** Approve a proposed routine. The only way `state` becomes `active`, and it needs a named human. */
export function approve(routine: Routine, by: string, at: string): Routine {
  return { ...routine, state: 'active', approved_at: at, approved_by: by };
}

/** Pause an active routine. It keeps its approval — resuming is not a fresh grant. */
export const pause = (routine: Routine): Routine => ({ ...routine, state: 'paused' });

/**
 * Resume a paused routine.
 *
 * Refuses a routine that was never approved: without this, pause-then-resume would be a path from
 * `proposed` straight to `active` that skips the founder entirely.
 */
export function resume(routine: Routine): Routine {
  if (!routine.approved_at) return routine;
  return { ...routine, state: 'active' };
}

/** Whether enough time has passed since this routine last ran. */
export function cooledDown(routine: Routine, now: Date): boolean {
  if (!routine.last_run_at) return true; // never run — nothing to wait for
  const last = Date.parse(routine.last_run_at);
  if (Number.isNaN(last)) return true; // an unreadable timestamp must not wedge a routine forever
  return now.getTime() - last >= COOLDOWN_MS[routine.cadence];
}

/** Why a routine is not going to run right now, in words a founder can act on. */
export function whyNotRunning(routine: Routine, now: Date): string | null {
  if (routine.state === 'proposed') return 'Waiting for your OK.';
  if (routine.state === 'paused') return 'Paused by you.';
  if (!cooledDown(routine, now)) return 'Ran recently — waiting for the next time it is due.';
  return null;
}

/** Every routine that could run right now. */
export function dueRoutines(routines: readonly Routine[], now: Date): Routine[] {
  return routines.filter((r) => r.state === 'active' && cooledDown(r, now));
}

/**
 * The one routine to run on this sweep — meridian's one-dispatch-per-sweep.
 *
 * One at a time keeps the queue shallow and the spend smooth; dispatching everything that came due
 * at once is how a quiet week turns into a bill. Longest-waiting first, so a weekly routine cannot
 * be starved by an hourly one that is due on every sweep. Ties break on id, so the choice is
 * reproducible rather than dependent on the order the files happened to be read in.
 */
export function nextToDispatch(routines: readonly Routine[], now: Date): Routine | null {
  const due = dueRoutines(routines, now);
  if (due.length === 0) return null;

  const waitingSince = (r: Routine) => (r.last_run_at ? Date.parse(r.last_run_at) : 0);
  return [...due].sort((a, b) => waitingSince(a) - waitingSince(b) || a.id.localeCompare(b.id))[0];
}

/**
 * Where routines live: beside the run reports, on the venture repo's own state ref.
 *
 * Same ref as FB-042 deliberately — a routine and the report of it running are one story, and a
 * founder asking "did the Monday routine do anything?" should not need two places to look.
 */
export const ROUTINES_DIR = 'routines';

export interface RoutineSource {
  list(repo: string): Promise<string[]>;
  read(repo: string, name: string): Promise<unknown | null>;
}

/**
 * Read a stored routine, keeping the approval fields a proposal is not allowed to carry.
 *
 * `fromProposal` strips them, which is right for something a lane just wrote and wrong for a record
 * the studio itself approved earlier. This is the reading half: the base is still rebuilt field by
 * field, and only a *plausible* approval is restored — a state of `active` with no `approved_at`
 * behind it is read back as `proposed`, so a hand-edited or lane-written file cannot promote itself
 * by asserting a state.
 */
export function fromStored(raw: unknown, ventureId: string): Routine | null {
  const base = fromProposal(raw, ventureId);
  if (!base) return null;

  const r = raw as Record<string, unknown>;
  const approved_at = text(r.approved_at) || null;
  const approved_by = text(r.approved_by) || null;
  if (!approved_at || !approved_by) return base; // never approved — whatever `state` claims

  const claimed = text(r.state);
  const state: RoutineState = claimed === 'paused' ? 'paused' : 'active';
  const last_run_at = text(r.last_run_at) || null;
  const outcome = text(r.last_outcome);

  return {
    ...base,
    state,
    approved_at,
    approved_by,
    last_run_at,
    last_outcome: outcome ? (outcome as RunOutcome) : null,
  };
}

/**
 * Every routine a venture has, across its department repos.
 *
 * Ordered so the founder's attention lands where it is needed: what is waiting on them first, then
 * what is running, then what they have paused.
 */
export async function loadRoutines(
  venture: VentureSummary,
  source: RoutineSource,
): Promise<Routine[]> {
  const all: Routine[] = [];
  for (const repo of approvalRepos(venture)) {
    for (const name of await source.list(repo)) {
      const parsed = fromStored(await source.read(repo, name), venture.id);
      if (parsed) all.push(parsed);
    }
  }

  const rank: Record<RoutineState, number> = { proposed: 0, active: 1, paused: 2 };
  return all.sort((a, b) => rank[a.state] - rank[b.state] || a.title.localeCompare(b.title));
}
