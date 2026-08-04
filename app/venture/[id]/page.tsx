import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, ventureChatUrl } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference } from '@/lib/tickets';
import { loadVentureAttention } from '@/lib/attention';
import { loadVentureHealth, defaultNow } from '@/lib/health';
import { loadApprovals, attachBudgetDisclosure, toSpends, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from '@/lib/approvals';
import { historyFor } from '@/lib/activegraph-log';
import { boardState } from '@/lib/firstrun';
import { FirstRun, BoardUnreadable } from '@/components/FirstRun';
import { narrate, narrateFault } from '@/lib/activegraph';
import type { ApprovalHistory } from '@/components/ApprovalCard';
import { departmentBudgets, type BudgetDisclosure } from '@/lib/budgets';
import { loadRunReports, engineState, type RunReport } from '@/lib/runreports';
import { githubRunReportSource, fixtureRunReportSource } from '@/lib/runreports-load';
import { composeBrief, bucketRuns, type Brief } from '@/lib/brief';
import { loadEnvelopes } from '@/lib/budgets-load';
import { GitHubClient } from '@/lib/github';
import { VentureBoard } from '@/components/VentureBoard';
import { VentureForbidden } from '@/components/VentureForbidden';
import { readiness } from '@/lib/readiness';

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

  // FB-071: the ActiveGraph record — who asked, who agreed, what happened next, in order, on ground
  // the proposing lane cannot author. Read here rather than in the card because the card is a client
  // component and the verifying secret must never reach a browser. A venture with no history yet
  // reads as none, never as an error, so an un-provisioned ref cannot blank the board.
  const histories: Record<string, ApprovalHistory> = {};
  {
    const secret = process.env.FOUNDRY_APPROVAL_SECRET ?? '';
    if (secret && !(process.env.APPROVALS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1')) {
      const client = new GitHubClient();
      for (const a of approvals) {
        try {
          const h = await historyFor(client, venture.id, a.repo, a.id, secret);
          if (h.applied.length > 0 || h.refused > 0) {
            histories[`${a.repo}/${a.id}`] = {
              lines: h.applied.map(narrate),
              faults: h.faults.map(narrateFault),
              refused: h.refused,
            };
          }
        } catch {
          // One unreadable history must not take the board with it.
        }
      }
    }
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

  // FB-104: a stuck ticket reads by its name, not its number. The titles are already on the board —
  // this is the same parse the columns render from, so the brief cannot name a ticket differently
  // from the card the founder then goes and opens.
  const ticketTitles: Record<string, string> = {};
  for (const lane of lanes) {
    for (const group of Object.values(lane.groups)) {
      for (const t of group) ticketTitles[t.ticket.id] = t.ticket.title;
    }
  }

  const brief: Brief = composeBrief({
    ventureName: venture.name,
    awaitingApproval: approvals.filter((a) => a.status === 'proposed').length,
    // The queue itself, not a count of it: the brief says how long the oldest has waited, and a
    // number cannot be asked that.
    openWork: attention.approvals.map((a) => ({ ticketId: a.linkedTicketId, ageMs: a.ageMs })),
    runs: runs.reports,
    engine,
    ticketTitles,
    overBudget: venture.departments
      .map((d, i) => (budgets[i]?.overLimit ? d.name : null))
      .filter((n): n is string => !!n),
    // Any read that failed leaves the brief working from an incomplete picture, and it says so
    // rather than reassuring the founder from a partial one.
    degraded: runsDegraded || attention.errors.length > 0 || !!budgetsError,
    now: now.getTime(),
  });

  // FB-066: day one. A founder whose venture has produced nothing meets a welcome and ONE action,
  // not four well-written empty boxes that between them argue the product does nothing.
  //
  // Every read failure is collected first, because a welcome shown over an unreadable venture states
  // a fact we do not have: it tells the founder their venture is a blank page when the truth is that
  // the studio could not see it.
  const readFailures = [
    ...lanes.filter((l) => l.error).map((l) => l.error as string),
    ...health.repos.filter((r) => r.error).map((r) => r.error as string),
    ...attention.errors,
    ...(runsDegraded ? ['The studio could not read what your team has been doing.'] : []),
    ...(budgetsError ? [budgetsError] : []),
  ];
  const state = boardState({
    ticketCount: lanes.reduce((n, l) => n + l.total, 0),
    runCount: runs.total,
    approvalCount: approvals.length,
    // Anything a repo has already done — a commit, a merged PR, a build. A venture with a failing
    // build and nothing else is not brand new, and must not be greeted as though it were.
    historyCount: health.repos.reduce((n, r) => n + r.activity.length + (r.latestRun ? 1 : 0), 0),
    readFailures,
  });
  const chatUrl = ventureChatUrl(venture.vpsHost);
  const hasComposer = chatUrl !== null;
  // FB-087: the composer key lives only in the environment, so only the running process can tell
  // whether it is there. Shown to Bruntsfield, never to the founder — it names a variable and a
  // script, which is a fix for an admin and noise for anyone else. Computed here because
  // `process.env` must not cross into a client component.
  const wiringWarning = access.isAdmin && !readiness([venture], process.env).ok
    ? readiness([venture], process.env).ventures[0].problem
    : null;

  if (state.kind === 'first-run') {
    return (
      <FirstRun
        ventureId={venture.id}
        ventureName={venture.name}
        founderName={venture.founderName}
        hasComposer={hasComposer}
      />
    );
  }
  if (state.kind === 'unreadable') {
    return <BoardUnreadable ventureId={venture.id} ventureName={venture.name} reasons={state.reasons} />;
  }

  return (
    <VentureBoard
      venture={{ id: venture.id, name: venture.name, status: venture.status, founderName: venture.founderName, hasComposer, chatUrl }}
      wiringWarning={wiringWarning}
      lanes={lanes}
      departments={venture.departments}
      approvals={approvals}
      histories={histories}
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
