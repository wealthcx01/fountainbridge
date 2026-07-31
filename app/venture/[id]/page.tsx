import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, ventureChatUrl } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference } from '@/lib/tickets';
import { loadVentureAttention } from '@/lib/attention';
import { loadVentureHealth, defaultNow } from '@/lib/health';
import { loadApprovals, attachBudgetDisclosure, toSpends, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from '@/lib/approvals';
import { departmentBudgets, type BudgetDisclosure } from '@/lib/budgets';
import { loadRunReports, engineState, githubRunReportSource, fixtureRunReportSource, type RunReport } from '@/lib/runreports';
import { composeBrief, bucketRuns, type Brief } from '@/lib/brief';
import { loadEnvelopes } from '@/lib/budgets-load';
import { GitHubClient } from '@/lib/github';
import { VentureBoard } from '@/components/VentureBoard';
import { VentureForbidden } from '@/components/VentureForbidden';

// Venture lanes & tickets (FB-006). Scoping is enforced HERE, server-side: a session that can't
// access this venture never triggers a ticket fetch (CLAUDE.md #6 — isolation is not UI-only).
export default async function VenturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ refresh?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const { id } = await params;
  const { refresh } = await searchParams;

  const ventures = loadVentures();
  const access = authorizeVentures(
    session.user.email,
    ventures,
    parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS),
  );

  const venture = ventures.find((v) => v.id === id);
  // Deny BEFORE any data fetch. A signed-in but unauthorized user sees the refusal, not the data.
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const data = await loadVentureTickets(venture, { refresh: refresh === '1' });
  // Overlay PR-derived status (FB-007): open PR → pr-open, merged → done. Shared per-venture cache.
  const attention = await loadVentureAttention(venture, { refresh: refresh === '1' });
  const lanes = data.lanes.map((lane) => applyStatusInference(lane, attention.ticketStatus));
  // Staleness (FB-008): flag a lane whose repo has had no activity in N days — surfaced on the board.
  const health = await loadVentureHealth(venture, { refresh: refresh === '1' });
  const staleRepos = health.repos.filter((r) => r.stale).map((r) => r.repo);
  const org = process.env.GITHUB_ORG ?? 'wealthcx01';

  // FB-046: external-action approvals (the ActiveGraph gate). Most ventures have no foundry-approvals
  // ref yet — a read failure must never blank the board, so degrade to none.
  let approvals: ActiveGraphApproval[] = [];
  try {
    // Fixture source for the UI gate + offline dev. Gated on E2E_TEST_LOGIN, not on the presence of
    // the directory alone: this is the external-action gate, and a stray env var must not be able to
    // swap a founder's real approval queue for files on disk. Keying off the same switch that
    // already enables test login means there is ONE well-known flag that turns the studio into a
    // test rig, rather than several — and a deployment with it set has bigger problems than this.
    // (NODE_ENV is not usable here: `next start` sets it to production for the UI gate too.)
    const source =
      process.env.APPROVALS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
        ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
        : githubApprovalSource(new GitHubClient());
    approvals = await loadApprovals(venture, source);
  } catch {
    approvals = [];
  }

  // FB-054: limits come from the STUDIO repo (ventures/budgets/<id>.yaml), never from the venture ref
  // the proposing lane can write. Read once and threaded through, so the board and the cards are
  // computed from the same bytes.
  const { envelopes, error: budgetsError } = loadEnvelopes(venture.id);
  const knownDepartments = new Set(venture.departments.map((d) => d.id));
  // The repo's existing test clock seam (FB-032). Period windowing makes "now" load-bearing.
  const now = new Date(defaultNow());
  approvals = attachBudgetDisclosure(approvals, envelopes, knownDepartments, now);

  // FB-042: what the engine actually did. The lanes have written a RunReport after every wake since
  // FB-040 and nothing has ever rendered one — a founder could not tell a lane that gave up three
  // attempts ago from one that was never installed.
  //
  // `degraded` is tracked separately from "no reports": an unreadable state ref and a genuinely idle
  // venture look identical from here, and the brief must not compose a calm summary out of the first.
  let runs: { reports: RunReport[]; heartbeats: RunReport[]; total: number } = { reports: [], heartbeats: [], total: 0 };
  let runsDegraded = false;
  try {
    const runSource =
      process.env.RUNREPORTS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
        ? fixtureRunReportSource(process.env.RUNREPORTS_FIXTURE_DIR)
        : githubRunReportSource(new GitHubClient());
    runs = await loadRunReports(venture, runSource);
  } catch {
    runsDegraded = true;
  }
  const engine = engineState(runs.heartbeats, now);

  // Pure, unit-tested, and shared with the cards — the previous version lived inline here and was
  // reachable only through Playwright.
  const { budgets, orphanEnvelopes } = departmentBudgets(
    venture.departments.map((d) => d.id),
    envelopes,
    toSpends(approvals),
    now,
  );

  const brief: Brief = composeBrief({
    ventureName: venture.name,
    awaitingApproval: approvals.filter((a) => a.status === 'proposed').length,
    openPrs: attention.approvals.length,
    ...bucketRuns(runs.reports),
    engine,
    overBudget: venture.departments
      .map((d, i) => (budgets[i]?.overLimit ? d.name : null))
      .filter((n): n is string => !!n),
    // Any read that failed leaves the brief working from an incomplete picture, and it says so
    // rather than reassuring the founder from a partial one.
    degraded: runsDegraded || attention.errors.length > 0 || !!budgetsError,
  });

  return (
    <VentureBoard
      venture={{ id: venture.id, name: venture.name, status: venture.status, founderName: venture.founderName, chatUrl: ventureChatUrl(venture.vpsHost) }}
      lanes={lanes}
      departments={venture.departments}
      approvals={approvals}
      budgets={budgets}
      budgetsError={budgetsError}
      orphanEnvelopes={orphanEnvelopes}
      staleRepos={staleRepos}
      totalWarnings={data.totalWarnings}
      fetchedAt={data.fetchedAt}
      org={org}
      brief={brief}
      runs={runs.reports}
      runsTotal={runs.total}
      engine={engine}
    />
  );
}
