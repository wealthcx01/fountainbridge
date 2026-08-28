import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, ventureChatUrl, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference } from '@/lib/tickets';
import { loadFiledForLanes, defaultBranchFileReader, type FiledTicket } from '@/lib/filed-tickets';
import { ticketsByRepo } from '@/lib/venture-tickets-index';
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
import { blockerLine, degradedGroups, deskSummary, type ReadFailure } from '@/lib/desk';
import { loadEnvelopes } from '@/lib/budgets-load';
import { GitHubClient } from '@/lib/github';
import { VentureBoard } from '@/components/VentureBoard';
import { VentureForbidden } from '@/components/VentureForbidden';
import { readiness } from '@/lib/readiness';

// Venture lanes & tickets (FB-006). Scoping is enforced HERE, server-side: a session that can't
// access this venture never triggers a ticket fetch (CLAUDE.md #6 — isolation is not UI-only).
/**
 * The signed history behind each approval, fanned out (FB-071, parallelised in FB-128).
 *
 * One read per approval, all at once rather than one after another. The secret verifies them here,
 * server-side, because the card that renders them is a client component and the verifying secret
 * must never reach a browser.
 *
 * An approval with no readable history is simply absent from the result. One unreadable history must
 * not take the board with it, and a venture that has never had an approval is not an error.
 */
async function loadApprovalHistories(
  venture: VentureSummary,
  approvals: ActiveGraphApproval[],
  testRig: boolean,
): Promise<Array<[string, ApprovalHistory]>> {
  const secret = process.env.FOUNDRY_APPROVAL_SECRET ?? '';
  if (!secret || (process.env.APPROVALS_FIXTURE_DIR && testRig)) return [];

  const client = new GitHubClient();
  const read = await Promise.all(
    approvals.map(async (a): Promise<[string, ApprovalHistory] | null> => {
      try {
        const h = await historyFor(client, venture.id, a.repo, a.id, secret);
        if (h.applied.length === 0 && h.refused === 0) return null;
        return [
          `${a.repo}/${a.id}`,
          { lines: h.applied.map(narrate), faults: h.faults.map(narrateFault), refused: h.refused },
        ];
      } catch {
        return null;
      }
    }),
  );
  return read.filter((e): e is [string, ApprovalHistory] => e !== null);
}

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

  // ---- The reads ---------------------------------------------------------------------------
  //
  // In three rounds, not nine (FB-128). This page took **9.1 seconds** on production, essentially
  // all of it before the first byte: every read was awaited on the line after the one before it,
  // although almost none of them depend on each other. FB-123 took it from ~41s by bounding the
  // run-report reads; this is the rest.
  //
  // The rounds are the real dependencies and nothing more:
  //
  //   1. everything that depends on nothing — tickets, the ticket index, health, approvals, runs;
  //   2. the attention queue (needs the ticket index) and the approval histories (need the
  //      approvals), which do not need each other;
  //   3. the filed tickets, which need the attention queue.
  //
  // `GITHUB_MAX_CONCURRENT` (8) still governs how many actually leave at once, so this is not a
  // burst — it is the difference between keeping that budget full and leaving it idle while one
  // request finishes.
  const refreshing = refresh === '1';

  // Fixture sources for the UI gate + offline dev. Gated on E2E_TEST_LOGIN, not on the presence of
  // the directory alone: this is the external-action gate, and a stray env var must not be able to
  // swap a founder's real approval queue for files on disk. Keying off the same switch that already
  // enables test login means there is ONE well-known flag that turns the studio into a test rig,
  // rather than several — and a deployment with it set has bigger problems than this.
  // (NODE_ENV is not usable here: `next start` sets it to production for the UI gate too.)
  const testRig = process.env.E2E_TEST_LOGIN === '1';
  const approvalSource =
    process.env.APPROVALS_FIXTURE_DIR && testRig
      ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
      : githubApprovalSource(new GitHubClient());
  const runSource =
    process.env.RUNREPORTS_FIXTURE_DIR && testRig
      ? fixtureRunReportSource(process.env.RUNREPORTS_FIXTURE_DIR)
      : githubRunReportSource(new GitHubClient());

  const noRuns: { reports: RunReport[]; heartbeats: RunReport[]; total: number } = { reports: [], heartbeats: [], total: 0 };

  // FB-046: external-action approvals (the ActiveGraph gate). Most ventures have no foundry-approvals
  // ref yet — a read failure must never blank the board, so degrade to none.
  //
  // `runsDegraded` is tracked separately from "no reports": an unreadable state ref and a genuinely
  // idle venture look identical from here, and the brief must not compose a calm summary out of the
  // first.
  const [data, ticketIndex, health, approvalsRead, runsRead] = await Promise.all([
    loadVentureTickets(venture, { refresh: refreshing }),
    ticketsByRepo(venture, { refresh: refreshing }),
    loadVentureHealth(venture, { refresh: refreshing }),
    loadApprovals(venture, approvalSource).catch((): ActiveGraphApproval[] => []),
    loadRunReports(venture, runSource)
      .then((r) => ({ runs: r, degraded: false }))
      .catch(() => ({ runs: noRuns, degraded: true })),
  ]);
  const runs = runsRead.runs;
  const runsDegraded = runsRead.degraded;

  // FB-099: the tickets go IN. Without them a piece of work is only tied to its ticket when it names
  // the id outright, which the lane's own branches (`foundry/<slug>`) never do — which is how the
  // badge came to say 15 while every column said 0.
  //
  // FB-071: the ActiveGraph record — who asked, who agreed, what happened next, in order, on ground
  // the proposing lane cannot author. Read here rather than in the card because the card is a client
  // component and the verifying secret must never reach a browser. A venture with no history yet
  // reads as none, never as an error, so an un-provisioned ref cannot blank the board. Fanned out
  // rather than walked: it was a `for` loop awaiting one approval at a time, which on a venture with
  // a real queue was most of this page's time on its own.
  const [attention, historyEntries] = await Promise.all([
    loadVentureAttention(venture, { refresh: refreshing, tickets: ticketIndex }),
    loadApprovalHistories(venture, approvalsRead, testRig),
  ]);
  const histories: Record<string, ApprovalHistory> = Object.fromEntries(historyEntries);

  const inferred = data.lanes.map((lane) => applyStatusInference(lane, attention.ticketStatus));
  // FB-120: the work the founder approved minutes ago, which is not on the default branch yet.
  //
  // AFTER inference, deliberately. A filed ticket's own pull request is open, so inference would move
  // it to "Needs your OK" — the wrong sentence about work nobody has started, and the loss of exactly
  // the distinction this exists to draw.
  //
  // A read failure must not blank a board that was fine a moment ago, so it degrades to none: the
  // pull requests stay in the attention queue either way, which is where the founder was before.
  const filedByRepo = await loadFiledForLanes(inferred, attention.perRepo, defaultBranchFileReader())
    .catch(() => new Map<string, FiledTicket[]>());

  const lanes = inferred.map((lane) => {
    const filed = filedByRepo.get(lane.repo);
    if (!filed?.length) return lane;
    return {
      ...lane,
      groups: { ...lane.groups, filed },
      total: lane.total + filed.length,
    };
  });
  // Staleness (FB-008): flag a lane whose repo has had no activity in N days — surfaced on the board.
  const staleRepos = health.repos.filter((r) => r.stale).map((r) => r.repo);
  const org = process.env.GITHUB_ORG ?? 'wealthcx01';

  // FB-054: limits come from the STUDIO repo (ventures/budgets/<id>.yaml), never from the venture ref
  // the proposing lane can write. Read once and threaded through, so the board and the cards are
  // computed from the same bytes.
  const { envelopes, error: budgetsError } = loadEnvelopes(venture.id);
  const knownDepartments = new Set(venture.departments.map((d) => d.id));
  // The repo's existing test clock seam (FB-032). Period windowing makes "now" load-bearing.
  const now = new Date(defaultNow());
  const approvals = attachBudgetDisclosure(approvalsRead, envelopes, knownDepartments, now);

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
  // FB-105: the work waiting on each ticket, keyed the same way the status inference is — so the
  // drawer's Accept button and the column the card sits in cannot disagree about the same ticket.
  const openWork: Record<string, { repo: string; number: number }> = {};
  for (const pr of attention.approvals) {
    if (pr.linkedTicketId) openWork[`${pr.repo} ${pr.linkedTicketId}`] = { repo: pr.repo, number: pr.number };
  }

  const ticketTitles: Record<string, string> = {};
  for (const lane of lanes) {
    for (const group of Object.values(lane.groups)) {
      for (const t of group) ticketTitles[t.ticket.id] = t.ticket.title;
    }
  }

  // FB-099: everything with no CARD on this board — which is not the same as "no ticket id". A piece
  // of work titled "ARCA-5: deck sharing" whose ticket file does not exist has an id, matches
  // nothing on screen, and fell through exactly the same gap the badge/column mismatch fell through.
  const onBoard = new Set(Object.keys(ticketTitles));
  // FB-120: a filing now HAS a card, so it must stop being listed as work with nowhere to go. It is
  // keyed by pull request rather than ticket id because that is what the filing is — the ticket it
  // carries is the card, and listing both would show the same thing twice under two names.
  // FB-120: where each filed ticket actually LIVES. The drawer builds a GitHub file link from the
  // lane's ref, which for these is the default branch — the one branch the file is provably not on.
  // Without this the card a founder opens to re-read what they approved links to a 404.
  const filedRefs: Record<string, { branch: string; prNumber: number; prUrl: string }> = {};
  for (const [repo, fs] of filedByRepo) {
    for (const f of fs) {
      filedRefs[`${repo} ${f.ticket.id}`] = { branch: f.branch, prNumber: f.prNumber, prUrl: f.prUrl };
    }
  }

  const filedPrs = new Set(
    [...filedByRepo].flatMap(([repo, fs]) => fs.map((f) => `${repo} ${f.prNumber}`)),
  );
  const unmatchedWork: Record<string, Array<{ number: number; title: string }>> = {};
  for (const pr of attention.approvals) {
    if (pr.linkedTicketId && onBoard.has(pr.linkedTicketId)) continue;
    if (filedPrs.has(`${pr.repo} ${pr.number}`)) continue;
    (unmatchedWork[pr.repo] ??= []).push({ number: pr.number, title: pr.title });
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
  //
  // Kept as structured entries as well as strings (FB-128). The desk's degraded strip groups by
  // cause and names which repository each affected, and reading the repository back out of a
  // sentence written somewhere else is a guess — so it travels as a field.
  const failures: ReadFailure[] = [
    ...lanes.filter((l) => l.error).map((l) => ({ where: l.repo, message: l.error as string })),
    ...health.repos.filter((r) => r.error).map((r) => ({ where: r.repo, message: r.error as string })),
    ...attention.errors.map((message) => ({ where: null, message })),
    ...(runsDegraded ? [{ where: null, message: 'The studio could not read what your team has been doing.' }] : []),
    ...(budgetsError ? [{ where: null, message: budgetsError }] : []),
  ];
  const readFailures = failures.map((f) => f.message);

  // FB-128: the desk's own sentence, the amber banner, and the strip of what could not be read.
  //
  // All three from ONE count of what waits on this founder — the same `waitingOnFounder` the rail's
  // badge uses. Three renderings of one number is how a badge comes to say 15 over columns saying 0
  // (FB-099), and the acceptance criterion for this ticket is that they cannot.
  const waiting = {
    openWork: attention.approvals.length,
    awaitingApproval: approvals.filter((a) => a.status === 'proposed').length,
  };
  const oldestMs = attention.approvals.length
    ? Math.max(...attention.approvals.map((a) => a.ageMs ?? 0))
    : null;
  // Work the engine is actually on, not work that has been filed. A ticket sitting in `todo` is not
  // a team "on" anything, and saying so would be the most flattering possible reading of an idle
  // venture.
  const movingTickets = lanes.reduce((n, l) => n + l.groups['in-progress'].length, 0);
  const money = budgets.reduce(
    (acc, b) => (b ? { spent: acc.spent + b.reportedMinor, limit: acc.limit + b.limitMinor, currency: acc.currency ?? b.currency } : acc),
    { spent: 0, limit: 0, currency: null as string | null },
  );
  const summarySentence = deskSummary({
    ...waiting,
    movingTickets,
    spentMinor: money.limit > 0 ? money.spent : null,
    limitMinor: money.limit > 0 ? money.limit : null,
    currency: money.currency,
    degraded: readFailures.length > 0,
  });
  const blocker = blockerLine({ ...waiting, oldestMs });
  const degraded = degradedGroups(failures);

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
      openWork={openWork}
      filedRefs={filedRefs}
      unmatchedWork={unmatchedWork}
      viewerIsFounder={
        !!venture.founderEmail && venture.founderEmail.toLowerCase() === session.user.email.toLowerCase()
      }
      fetchedAt={data.fetchedAt}
      org={org}
      brief={brief}
      summary={summarySentence}
      blocker={blocker}
      degraded={degraded}
      runs={runs.reports}
      runsTotal={runs.total}
      engine={engine}
    />
  );
}
