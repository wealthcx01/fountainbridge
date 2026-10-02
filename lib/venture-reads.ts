import 'server-only';

/**
 * The venture reads that more than one part of a page needs (FB-157).
 *
 * ## The duplicate nobody had counted
 *
 * Measured against production data, one load of the desk:
 *
 *   desk: what your team did   4,447 ms
 *   rail: what your team did   3,300 ms
 *   desk: your approvals       1,712 ms
 *   rail: your approvals       1,707 ms
 *
 * Those are not two things. They are the same two reads, done twice — once by
 * `app/venture/[id]/layout.tsx` for the rail and once by the page inside it — because a layout and
 * its page render independently and each built its own source. Every screen under a venture was
 * paying for both.
 *
 * It matters more than the wasted requests suggest. `GITHUB_MAX_CONCURRENT` is 8, so the duplicates
 * do not run beside the originals — they queue against them, and the slowest read on the page is
 * slow partly because half the budget is spent fetching what the other half already has.
 *
 * ## Why the accessors take an id
 *
 * React's `cache()` keys on argument identity, and `loadVentures()` parses the manifests fresh on
 * every call — so the layout's `venture` object and the page's are different objects describing the
 * same venture, and a cache keyed on them would miss every time. Keying on the id and resolving the
 * manifest inside is what makes the two calls one.
 *
 * This is `loadRailData`'s trick (FB-124) one level down. It worked there only because nothing else
 * called it.
 */

import { cache } from 'react';
import { loadVentures, type VentureSummary } from './ventures';
import { GitHubClient } from './github';
import { loadApprovals, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from './approvals';
import { loadRunReports, loadLiveness, type RunReport } from './runreports';
import { cachedRunReportSource } from './runreports-cache';
import { githubRunReportSource, fixtureRunReportSource } from './runreports-load';

/**
 * The fixture sources, in one place rather than copied into every page.
 *
 * Gated on `E2E_TEST_LOGIN` and not on the directory alone — the same discipline every call site
 * had separately, which is exactly the sort of rule that survives being written once and drifts
 * when it is written five times.
 */
function approvalSource() {
  return process.env.APPROVALS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
    : githubApprovalSource(new GitHubClient());
}

/**
 * Where run reports come from, and what remembers them (FB-170).
 *
 * The fixture source is untouched: the UI gate must exercise the studio, not a cache, and a gate
 * whose answers depend on what a previous test warmed is a gate that reports different things on
 * different days.
 *
 * In production the GitHub source is wrapped. `cachedRunReportSource` hands the origin straight back
 * when no database is configured, so a studio without one behaves exactly as it did — this is a
 * saving, never a dependency.
 */
function runReportSource(ventureId: string) {
  if (process.env.RUNREPORTS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1') {
    return fixtureRunReportSource(process.env.RUNREPORTS_FIXTURE_DIR);
  }
  return cachedRunReportSource(ventureId, githubRunReportSource(new GitHubClient()));
}

/** The manifest for an id, or null. Cheap — the manifests are files in this repo. */
function ventureFor(ventureId: string): VentureSummary | null {
  return loadVentures().find((v) => v.id === ventureId) ?? null;
}

/**
 * What one venture's run history read back as. `earliest` is the start of the history, taken from
 * the listing rather than from what was opened (FB-242) — the screens need to say how far back the
 * record goes, and only `total` and `earliest` know that.
 */
export type Runs = {
  reports: RunReport[];
  heartbeats: RunReport[];
  checkIns: RunReport[];
  total: number;
  earliest: string | null;
  busiest: { ticket: string; count: number } | null;
  /** How many stretches of work the whole record holds — only from `ventureStory` (FB-180). */
  stretches?: number | null;
};
const NO_RUNS: Runs = { reports: [], heartbeats: [], checkIns: [], total: 0, earliest: null, busiest: null };

const runsById = cache(async (ventureId: string): Promise<Runs> => {
  const venture = ventureFor(ventureId);
  return venture ? loadRunReports(venture, runReportSource(ventureId)) : NO_RUNS;
});

const approvalsById = cache(async (ventureId: string): Promise<ActiveGraphApproval[]> => {
  const venture = ventureFor(ventureId);
  return venture ? loadApprovals(venture, approvalSource()) : [];
});

/**
 * What this venture's team did, once per request however many parts of the page ask.
 *
 * Rejections are shared along with successes, which is right: two callers asking the same question
 * of the same records in the same request must not get different answers, and every caller already
 * degrades rather than throwing.
 */
export const ventureRuns = (venture: VentureSummary): Promise<Runs> => runsById(venture.id);

const storyById = cache(async (ventureId: string): Promise<Runs> => {
  const venture = ventureFor(ventureId);
  return venture ? loadRunReports(venture, runReportSource(ventureId), undefined, 'stretches') : NO_RUNS;
});

/**
 * What this venture's team did, told as one line per stretch of work — for "What happened" (FB-180).
 *
 * `ventureRuns` opens the newest reports, which is right for the desk ("what is happening now") and
 * wrong for a history: on ARCA the newest sixty are all one ticket re-parked every five minutes, so
 * the record showed one line and five weeks of work were behind it. This opens the newest report of
 * each stretch instead, for the same number of files.
 */
export const ventureStory = (venture: VentureSummary): Promise<Runs> => storyById(venture.id);

/** The external actions waiting on this founder, once per request. */
export const ventureApprovals = (venture: VentureSummary): Promise<ActiveGraphApproval[]> =>
  approvalsById(venture.id);

const livenessById = cache(async (ventureId: string): Promise<{ at: string | null; degraded: boolean }> => {
  const venture = ventureFor(ventureId);
  return venture ? loadLiveness(venture, runReportSource(ventureId)) : { at: null, degraded: false };
});

/**
 * When this venture's machine last checked in, once per request (FB-164).
 *
 * The rail's whole interest in run reports is this one instant, and `ventureRuns` was opening sixty
 * files per repository to derive it. Separate accessor, separate cost: the desk still calls
 * `ventureRuns` because it renders the reports, and the rail no longer pays for a list it does not
 * show.
 */
export const ventureLiveness = (venture: VentureSummary) => livenessById(venture.id);
