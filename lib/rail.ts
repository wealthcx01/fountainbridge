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
import { githubRunReportSource, fixtureRunReportSource } from './runreports-load';
import { GitHubClient } from './github';
import { timed } from './timing';

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
   * How much finished work is waiting on this founder — the one number the badge shows.
   *
   * **Open work only, deliberately.** The desk's summary and its amber banner count external actions
   * awaiting the gate as well, because the desk shows both. This badge's row goes to `/attention`,
   * which lists open work and nothing else — so counting more here would put a badge saying 8 over a
   * page whose own count says 4. That is the FB-099 badge/destination mismatch, one level up, and
   * introducing it while closing it below would be a poor trade.
   *
   * Unifying the two is FB-149, and it belongs with FB-129, where "Needs you" stops being a link to
   * a cross-venture page and becomes a filter that can show both kinds.
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
export const loadRailData = cache(async (venture: VentureSummary, nowMs: number): Promise<RailData> =>
  timed('rail: everything', () => railData(venture, nowMs), venture.id));

async function railData(venture: VentureSummary, nowMs: number): Promise<RailData> {
  let degraded = false;
  const fell = <T,>(fallback: T) => (): T => {
    degraded = true;
    return fallback;
  };

  // Timed individually (FB-151). The three run in parallel, so their sum is not the wall clock —
  // what these readings answer is WHICH of them the wall clock is waiting on, which is the question
  // two rounds of optimisation have now got wrong by reasoning instead of measuring.
  const [attention, approvals, runs] = await Promise.all([
    timed('rail: open work', () => loadVentureAttention(venture), venture.id)
      .catch(fell<Awaited<ReturnType<typeof loadVentureAttention>> | null>(null)),
    timed('rail: your approvals', () => loadApprovals(venture, approvalSource()), venture.id)
      .catch(fell<ActiveGraphApproval[]>([])),
    timed('rail: what your team did', () => loadRunReports(venture, runReportSource()), venture.id)
      .catch(fell<Awaited<ReturnType<typeof loadRunReports>> | null>(null)),
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
    needsYou: attention?.approvals.length ?? 0,
    budgets,
    engine: { state: engine.state, text: engine.text, ageMinutes: engine.ageMinutes },
    degraded,
  };
}

// --- what the rail says when it does not know yet (FB-151) -------------------------------------

/**
 * The rail's three facts, each either known or explicitly not.
 *
 * The rail's numbers stream, so there is now a moment on every screen where it is drawn and the
 * numbers are not in. That moment is exactly where an invented value would be born, and the rail is
 * the most-seen surface in the product — a zero here is believed everywhere (FB-124).
 *
 * So the "we do not know yet" state is a value with a type rather than a branch inside JSX. It can
 * be tested without a browser, and there is one place where "unknown" turns into words instead of
 * three places that could each decide differently.
 */
export interface RailWords {
  /** How much waits on the founder — `null` while it is still being counted. Never 0 for unknown. */
  needsYou: number | null;
  engine: { state: EngineState | 'checking'; text: string };
  /** Per-department budgets, or `null` for the whole list while it is still being read. */
  budgets: (BudgetDisclosure | null)[] | null;
}

export function railWords(data: RailData | null): RailWords {
  if (!data) {
    return {
      needsYou: null,
      // Not "quiet" and not "stalled": both are findings about the venture, and nothing has been
      // found yet.
      engine: { state: 'checking', text: 'Checking whether your team is running.' },
      budgets: null,
    };
  }
  return { needsYou: data.needsYou, engine: data.engine, budgets: data.budgets };
}
