import { cache } from 'react';
import type { VentureSummary } from './ventures';
import { loadVentureAttention } from './attention';
import { departmentBudgets, type BudgetDisclosure } from './budgets';
import { loadEnvelopes } from './budgets-load';
import {
  loadApprovals,
  toSpends,
  githubApprovalSource,
  fixtureApprovalSource,
  type ActiveGraphApproval,
} from './approvals';
import { loadRunReports, engineState, type EngineState } from './runreports';
import { waitingOnFounder } from './desk';
import { githubRunReportSource, fixtureRunReportSource } from './runreports-load';
import { GitHubClient } from './github';

/**
 * What the rail needs, loaded once per request (FB-124).
 *
 * ## Why this exists rather than the page passing its data down
 *
 * The rail is a layout (`app/venture/[id]/layout.tsx`) so every screen under a venture gets it without
 * re-declaring it. In the App Router a layout **cannot receive data from its page** — they render
 * independently — so the rail has to load its own.
 *
 * Which is the trap. Two independent loads of the same numbers is how the venture board came to take
 * forty seconds (FB-123): nothing was wrong with any single read, there were simply far more of them
 * than anyone had counted. A rail on every screen multiplies that by every screen.
 *
 * So this is wrapped in React's `cache()`, which dedupes **within one request**: the layout and the
 * page both call it and the second call is free. That is a different mechanism from the module-level
 * Maps in `attention.ts` and `health.ts`, which dedupe *across* requests on a TTL. Those help too, and
 * they do not help the case this exists for, which is one render asking twice.
 *
 * ## What it deliberately does not carry
 *
 * A link to the venture box's own chat. The first draft had one and `e2e/composer.spec.ts` caught it:
 * "nothing on the composer sends the founder to another product" — FB-065's whole point, and a rail
 * link would have put that hand-off on every screen.
 *
 * The office plate's live state. That is FB-139 (G6); until it exists the rail draws a placeholder
 * that says so in words. A rail polling a feed that does not exist would be the most expensive way to
 * render nothing.
 */
export interface RailData {
  /**
   * How much waits on this founder — the one number the badge shows.
   *
   * Computed by `waitingOnFounder` (FB-128), which is also what composes the desk's summary sentence
   * and its blocker banner. Three renderings of one number is how a badge comes to say 15 over
   * columns saying 0 (FB-099); one function is the mechanism that stops it.
   */
  needsYou: number;
  /** Per-department budgets. `null` where a department declares no envelope; the rail says so. */
  budgets: (BudgetDisclosure | null)[];
  engine: { state: EngineState; text: string; ageMinutes: number | null };
  /** True when any read above failed. The rail is quieter about what it could not load, not silent. */
  degraded: boolean;
}

function approvalSource() {
  // Same discipline as the venture page: the fixture source is gated on E2E_TEST_LOGIN, not on the
  // directory alone, so a stray env var cannot swap a founder's real approval queue for files on disk.
  return process.env.APPROVALS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
    : githubApprovalSource(new GitHubClient());
}

function runReportSource() {
  return process.env.RUNREPORTS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureRunReportSource(process.env.RUNREPORTS_FIXTURE_DIR)
    : githubRunReportSource(new GitHubClient());
}

/**
 * The rail's data for one venture, once per request.
 *
 * Every read degrades rather than throws. A rail that 500s takes every screen with it — and the
 * situation it would be reporting on, a venture whose reads are failing, is exactly when a founder
 * most needs the page to still render (CLAUDE.md #10).
 */
export const loadRailData = cache(async (venture: VentureSummary, nowMs: number): Promise<RailData> => {
  let degraded = false;
  const fell = <T,>(fallback: T) => (): T => {
    degraded = true;
    return fallback;
  };

  const [attention, approvals, runs] = await Promise.all([
    loadVentureAttention(venture).catch(fell<Awaited<ReturnType<typeof loadVentureAttention>> | null>(null)),
    loadApprovals(venture, approvalSource()).catch(fell<ActiveGraphApproval[]>([])),
    loadRunReports(venture, runReportSource()).catch(
      fell<Awaited<ReturnType<typeof loadRunReports>> | null>(null),
    ),
  ]);

  // Envelopes are read from disk in this repo, not over the network — cheap, and synchronous.
  const { envelopes } = loadEnvelopes(venture.id);
  const { budgets } = departmentBudgets(
    venture.departments.map((d) => d.id),
    envelopes,
    toSpends(approvals),
    new Date(nowMs),
  );

  const engine = engineState(runs?.heartbeats ?? [], new Date(nowMs));

  return {
    needsYou: waitingOnFounder({
      openWork: attention?.approvals.length ?? 0,
      // External actions proposed and waiting on a human. A badge that counted finished work and
      // quietly left out a proposed send would tell a founder they were clear while an email sat
      // waiting for their word (CLAUDE.md #4).
      awaitingApproval: approvals.filter((a) => a.status === 'proposed').length,
    }),
    budgets,
    engine: { state: engine.state, text: engine.text, ageMinutes: engine.ageMinutes },
    degraded,
  };
});
