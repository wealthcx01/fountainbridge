/**
 * RunReports (FB-042) — what the engine actually did, in the founder's language.
 *
 * The lanes have written a RunReport after every wake since FB-040, to a `foundry-state` ref, and
 * until now nothing in the studio has read one. A founder could not see that their venture's lane
 * ran at all, let alone that it gave up on a ticket three attempts ago. That is the gap this closes,
 * and it is the plainest possible violation of non-negotiable 10 while it stands open.
 *
 * ## Two shapes, one type
 *
 * The record on the ref is the lane's own: `{ticket, lane, status, summary, started, finished}`.
 * The shared contract (bcap-contracts `RunReport`, extended in FB-059) is
 * `{lane_id, started_at, trigger, outcome, …}`. Everything here normalises to the contract, and
 * `fromLaneRecord` accepts either — the reader learns the contract shape before the writer starts
 * emitting it, so the migration can happen on the box without a flag day and without the studio
 * going blind to the reports already on the ref.
 *
 * ## Why the outcome vocabulary is six words and not three
 *
 * The contract's first cut had `progress | no-useful-work | error`. A lane that could not get a
 * ticket past its own review, a lane waiting for the founder to approve a send, and a lane that
 * crashed are three different situations calling for three different responses, and collapsing them
 * into `error` is exactly the silent failure this surface exists to prevent. FB-059 extended the
 * enum rather than teaching every consumer to guess.
 */

import type { VentureSummary } from './ventures';
import { approvalRepos } from './venture-repos';
import { inFounderWords } from './glossary';

export const STATE_REF = 'foundry-state';

/** How a run ENDED. Terminal states only — an in-flight run has `outcome: null`. */
export type RunOutcome = 'progress' | 'opened-pr' | 'no-useful-work' | 'blocked' | 'awaiting-approval' | 'error';

export type RunTrigger = 'manual' | 'scheduled';

/** A normalised RunReport — the bcap-contracts shape, plus where the studio read it from. */
export interface RunReport {
  laneId: string;
  startedAt: string;
  /** null while the run is still in flight. */
  endedAt: string | null;
  trigger: RunTrigger;
  /** null while the run is still in flight; see the invariant in the contract. */
  outcome: RunOutcome | null;
  summaryMd: string;
  ticketsTouched: string[];
  /** Why, for the outcomes that owe the founder a reason — `error` and `blocked`. */
  errorDetail: string | null;
  prUrl: string | null;
  /** Which repo's state ref this came from. Not part of the contract — provenance for the UI. */
  repo: string;
  /** True for the single overwritten liveness beacon, which is not run history. */
  isHeartbeat: boolean;
}

/**
 * The lane's `status` vocabulary → the contract's `outcome`.
 *
 * `working` is deliberately absent: it is not an outcome, it is the absence of one, and it maps to
 * `null` alongside a null `endedAt`.
 */
const OUTCOME_OF_STATUS: Record<string, RunOutcome> = {
  idle: 'no-useful-work',
  opened_pr: 'opened-pr',
  blocked: 'blocked',
  awaiting_founder: 'awaiting-approval',
  failed: 'error',
  progress: 'progress',
};

/** Outcomes that owe the founder a reason rather than just a status word. */
const OWES_A_REASON = new Set<RunOutcome>(['blocked', 'error']);

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Normalise one record — the lane's shape or the contract's — into a RunReport.
 *
 * Returns null for anything it cannot place. A record it cannot read is NOT rendered as an empty or
 * default run: an invented "progress" would be worse than an absence, because the founder would be
 * told something happened.
 */
export function fromLaneRecord(raw: unknown, repo: string): RunReport | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  const laneId = str(r.lane_id) ?? str(r.lane);
  const startedAt = str(r.started_at) ?? str(r.started);
  if (!laneId || !startedAt) return null; // the contract's two required fields

  const endedAt = str(r.ended_at) ?? str(r.finished);
  const ticket = str(r.ticket);
  const isHeartbeat = ticket === 'heartbeat';

  // A contract-shaped record states its outcome; a lane-shaped one states a status we translate.
  const declared = str(r.outcome);
  const status = str(r.status)?.toLowerCase();
  let outcome: RunOutcome | null = null;
  if (declared && (Object.values(OUTCOME_OF_STATUS) as string[]).includes(declared)) {
    outcome = declared as RunOutcome;
  } else if (status && status !== 'working') {
    outcome = OUTCOME_OF_STATUS[status] ?? null;
    // A status the studio does not recognise is surfaced as blocked-with-a-reason rather than
    // dropped. A lane that grows a new state should show up as "something happened I can't explain",
    // not as nothing at all.
    if (!outcome) outcome = 'blocked';
  }

  // The contract's invariant, enforced on the way in: ended and outcome travel together. A lane
  // supervisor writes them at different moments, so a record can arrive with one and not the other,
  // and both halves of that would be rendered as something untrue.
  const inFlight = outcome === null || endedAt === null;

  const summaryMd = str(r.summary_md) ?? str(r.summary) ?? '';
  const ticketsRaw = Array.isArray(r.tickets_touched) ? r.tickets_touched.filter((t): t is string => typeof t === 'string') : null;

  return {
    laneId,
    startedAt,
    endedAt: inFlight ? null : endedAt,
    trigger: str(r.trigger) === 'manual' ? 'manual' : 'scheduled',
    outcome: inFlight ? null : outcome,
    summaryMd,
    ticketsTouched: ticketsRaw ?? (ticket && !isHeartbeat ? [ticket] : []),
    // The lane puts its reason in the summary; the contract has a field for it. Copying rather than
    // moving keeps the summary readable on its own.
    errorDetail: str(r.error_detail) ?? (outcome && OWES_A_REASON.has(outcome) ? summaryMd || null : null),
    prUrl: str(r.pr_url),
    repo,
    isHeartbeat,
  };
}

/** Reads the raw run-report files off one repo's state ref. Injectable, like every other read model. */
export interface RunReportSource {
  list(repo: string): Promise<string[]>;
  read(repo: string, name: string): Promise<unknown | null>;
}

/**
 * Load a venture's run history, newest first, across every department repo.
 *
 * `limit` bounds the render, not the truth — `total` says how many there were, so a capped list
 * never reads as the whole story.
 */
export async function loadRunReports(
  venture: VentureSummary,
  source: RunReportSource,
  limit = 20,
): Promise<{ reports: RunReport[]; heartbeats: RunReport[]; total: number }> {
  const all: RunReport[] = [];
  for (const repo of approvalRepos(venture)) {
    const names = await source.list(repo);
    for (const name of names) {
      const parsed = fromLaneRecord(await source.read(repo, name), repo);
      if (parsed) all.push(parsed);
    }
  }
  // Newest first by start time. Ties broken by lane so the order is stable between renders.
  const byRecency = (a: RunReport, b: RunReport) =>
    b.startedAt.localeCompare(a.startedAt) || a.laneId.localeCompare(b.laneId);

  const heartbeats = all.filter((r) => r.isHeartbeat).sort(byRecency);
  const reports = all.filter((r) => !r.isHeartbeat).sort(byRecency);
  return { reports: reports.slice(0, limit), heartbeats, total: reports.length };
}

/**
 * Is the engine running, and how would we know?
 *
 * The heartbeat is the only positive evidence a lane is alive: it is overwritten on every wake,
 * including the wakes where there was nothing to do. Its ABSENCE is the interesting case, and it is
 * reported as "we cannot tell" rather than as "offline" — a venture whose box was never provisioned
 * has no lane to be offline.
 */
export type EngineState = 'running' | 'quiet' | 'stalled' | 'unknown';

export function engineState(
  heartbeats: RunReport[],
  now: Date,
  /** How long without a wake before a lane that should be waking counts as stalled. */
  stalledAfterMinutes = 30,
): { state: EngineState; lastSeen: string | null; text: string } {
  const latest = heartbeats
    .map((h) => h.endedAt ?? h.startedAt)
    .filter((t): t is string => !!t)
    .sort()
    .pop() ?? null;

  if (!latest) {
    return {
      state: 'unknown',
      lastSeen: null,
      text: 'Your team is not working on this venture yet — it starts with this venture’s own machine.',
    };
  }
  const ageMs = now.getTime() - new Date(latest).getTime();
  if (Number.isNaN(ageMs)) {
    return { state: 'unknown', lastSeen: latest, text: 'Your team reported a time the studio could not read.' };
  }
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes > stalledAfterMinutes) {
    return {
      state: 'stalled',
      lastSeen: latest,
      text: `Your team has not checked in for ${describeGap(minutes)}. It wakes every few minutes when all is well, so something is wrong with this venture’s machine.`,
    };
  }
  return {
    state: 'running',
    lastSeen: latest,
    text: minutes <= 1 ? 'Your team checked in just now.' : `Your team checked in ${describeGap(minutes)} ago.`,
  };
}

function describeGap(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The founder-facing sentence for one run. One owner for these words, so they cannot drift.
 *
 * The reason a run stopped is written by the machine that stopped, in its own vocabulary, and the
 * brief quotes it verbatim — so FB-103 passes exactly those quoted parts through `inFounderWords`.
 * The studio's own half of each sentence is already in the founder's words; only the borrowed half
 * needs translating, and it is translated rather than dropped because the reason IS the point
 * (non-negotiable 10).
 */
export function describeRun(report: RunReport): string {
  const ticket = report.ticketsTouched[0];
  const on = ticket ? ` on ${ticket}` : '';
  const said = (fallback: string) => inFounderWords(report.errorDetail || report.summaryMd || fallback);
  switch (report.outcome) {
    case null:
      return `Working${on} now.`;
    case 'opened-pr':
      return `Finished${on}. It needs your OK before it becomes part of your product.`;
    case 'awaiting-approval':
      return `Finished${on} and is waiting for your approval before anything happens.`;
    case 'blocked':
      return `Stopped${on} and needs you: ${said('no reason was recorded.')}`;
    case 'error':
      return `Failed${on}: ${said('no detail was recorded.')}`;
    case 'no-useful-work':
      return 'Woke up, found nothing ready to work, and went back to sleep.';
    case 'progress':
    default:
      return report.summaryMd ? inFounderWords(report.summaryMd) : `Worked${on}.`;
  }
}
