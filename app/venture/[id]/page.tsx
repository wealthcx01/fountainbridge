import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, ventureChatUrl } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference } from '@/lib/tickets';
import { loadVentureAttention } from '@/lib/attention';
import { loadVentureHealth, defaultNow } from '@/lib/health';
import { loadApprovals, attachEnvelopeChecks, toSpends, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from '@/lib/approvals';
import { loadEnvelopes, envelopeStatus, queuedSpend, type EnvelopeStatus } from '@/lib/budgets';
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

  // FB-054: envelopes come from the STUDIO repo (ventures/budgets/<id>.yaml), never from the venture
  // ref the proposing lane can write. Read ONCE here and threaded through, so the board and the
  // cards are computed from the same bytes rather than from two reads that can disagree.
  const { envelopes, error: budgetsError } = loadEnvelopes(venture.id);
  const knownDepartments = new Set(venture.departments.map((d) => d.id));
  // The repo's existing test clock seam (FB-032). Period windowing makes "now" load-bearing, so the
  // UI gate needs a pinned instant or its assertions rot the moment the calendar moves.
  const now = new Date(defaultNow());
  approvals = attachEnvelopeChecks(approvals, envelopes, knownDepartments, now, budgetsError);

  const spends = toSpends(approvals);
  // A status for every DECLARED department, not only those with an envelope — a department with no
  // budget must read "no budget set" rather than silently rendering nothing, which was
  // indistinguishable from a budget that had been removed or failed to parse.
  const budgets: EnvelopeStatus[] = venture.departments.map((d) => {
    const envelope = envelopes.find((e) => e.department === d.id);
    // ONE queued derivation, shared with the cards — currency-aware, and it does not swallow a
    // proposal whose price could not be read.
    const queued = envelope ? queuedSpend(spends, d.id, envelope.currency) : { countableMinor: 0, uncountable: 0 };
    return envelopeStatus(envelope, spends, d.id, now, 0, queued.countableMinor);
  });
  // An envelope keyed to a department the manifest does not declare is a founder typo that would
  // otherwise enforce nothing while looking configured.
  const orphanEnvelopes = envelopes.filter((e) => !knownDepartments.has(e.department)).map((e) => e.department);

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
    />
  );
}
