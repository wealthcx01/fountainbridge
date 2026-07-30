import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures, ventureChatUrl } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureTickets, applyStatusInference } from '@/lib/tickets';
import { loadVentureAttention } from '@/lib/attention';
import { loadVentureHealth } from '@/lib/health';
import { loadApprovals, loadEnvelopes, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from '@/lib/approvals';
import { envelopeStatus, type EnvelopeStatus } from '@/lib/budgets';
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
  let budgets: EnvelopeStatus[] = [];
  try {
    // Fixture source for the UI gate + offline dev, matching the tickets/PRs/health pattern. FB-046
    // shipped the read model without this, so the approval card had no deterministic coverage; the
    // envelope check (FB-054) is a claim about what a founder SEES, so it needs a real render.
    const source = process.env.APPROVALS_FIXTURE_DIR
      ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
      : githubApprovalSource(new GitHubClient());
    approvals = await loadApprovals(venture, source);
    // FB-054: where each department stands against its envelope, from the same committed spend the
    // approval checks are computed from — so the card and the board can never disagree.
    const envelopes = await loadEnvelopes(venture, source);
    const spends = approvals.map((a) => ({
      department: a.department,
      amountMinor: a.amountMinor,
      currency: a.currency,
      status: a.status,
    }));
    budgets = envelopes.map((e) => envelopeStatus(e, spends, e.department));
  } catch {
    approvals = [];
    budgets = [];
  }

  return (
    <VentureBoard
      venture={{ id: venture.id, name: venture.name, status: venture.status, founderName: venture.founderName, chatUrl: ventureChatUrl(venture.vpsHost) }}
      lanes={lanes}
      departments={venture.departments}
      approvals={approvals}
      budgets={budgets}
      staleRepos={staleRepos}
      totalWarnings={data.totalWarnings}
      fetchedAt={data.fetchedAt}
      org={org}
    />
  );
}
