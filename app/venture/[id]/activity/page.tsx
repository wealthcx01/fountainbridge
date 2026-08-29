import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureHealth } from '@/lib/health';
import { loadRunReports } from '@/lib/runreports';
import { githubRunReportSource, fixtureRunReportSource } from '@/lib/runreports-load';
import { loadApprovals, githubApprovalSource, fixtureApprovalSource, type ActiveGraphApproval } from '@/lib/approvals';
import { GitHubClient } from '@/lib/github';
import { buildFeed } from '@/lib/activity-feed';
import { composeActivitySummary } from '@/lib/activity-summary';
import { classifyActivity, isFounderVisible } from '@/lib/activity-kind';
import { groupFailures } from '@/lib/read-failures';
import { VentureForbidden } from '@/components/VentureForbidden';
import { ActivityFeed } from '@/components/ActivityFeed';

/**
 * What happened (FB-132) — everything this venture did, newest first.
 *
 * ## Venture-scoped, which is a narrowing
 *
 * This route was a shim over `/activity`, which spans **every venture the viewer can reach**. The
 * design puts this screen inside one venture's rail showing that venture's events, so it is scoped
 * now — enforced here, server-side, before any read (CLAUDE.md #6).
 *
 * For an admin that is a loss: the all-ventures feed is how John saw the portfolio at a glance. It
 * still exists at `/activity` and becomes the admin ledger's job in FB-136. Narrowing this screen
 * without leaving that one standing would have taken something away and replaced it with nothing.
 *
 * ## The founder's own decisions are here, and were not
 *
 * A founder could not see their own yes in the record. Approvals and refusals come from the same
 * `loadApprovals` the desk reads — no per-row read, no second source of truth about what was
 * decided.
 */
export default async function VentureActivityPage({
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
  const access = authorizeVentures(session.user.email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const refreshing = refresh === '1';
  const testRig = process.env.E2E_TEST_LOGIN === '1';

  // Three reads, in parallel, each already bounded by its own loader (FB-123). This screen adds no
  // per-row read: the decisions come out of the approvals the desk already loads, not from walking
  // each one's event history.
  const [health, runs, approvals] = await Promise.all([
    loadVentureHealth(venture, { refresh: refreshing }),
    loadRunReports(
      venture,
      process.env.RUNREPORTS_FIXTURE_DIR && testRig
        ? fixtureRunReportSource(process.env.RUNREPORTS_FIXTURE_DIR)
        : githubRunReportSource(new GitHubClient()),
    ).catch(() => ({ reports: [], heartbeats: [], total: 0 })),
    loadApprovals(
      venture,
      process.env.APPROVALS_FIXTURE_DIR && testRig
        ? fixtureApprovalSource(process.env.APPROVALS_FIXTURE_DIR)
        : githubApprovalSource(new GitHubClient()),
    ).catch((): ActiveGraphApproval[] => []),
  ]);

  // FB-108's filter: the studio's own housekeeping is not the venture's history. Kept here rather
  // than in `buildFeed` because it is an editorial choice about this screen, and the feed is also
  // what the desk would use.
  const activity = health.activity.filter((e) => isFounderVisible(classifyActivity(e)));

  const feed = buildFeed({ activity, runs: runs.reports.filter((r) => !r.isHeartbeat), approvals, limit: FEED_LIMIT });
  const summary = composeActivitySummary({ events: activity, windowDays: 14, openAreas: [] });

  const failures = health.repos.filter((r) => r.error).map((r) => r.error as string);

  return (
    <section data-testid="venture-activity">
      <p className="eyebrow"><span className="eyebrow-id">{venture.name}</span> — What happened</p>
      <h1 style={{ margin: '0 0 0.5rem' }}>What happened</h1>

      <div data-testid="activity-summary" style={{ maxWidth: 'var(--content-narrow)' }}>
        {summary.sentences.map((s, i) => (
          <p key={i} style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.3rem' }}>{s}</p>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Everything {venture.name} did, newest first. Sent, failed, refused: it stays here with its
        state. Your decisions appear the moment you make them.
      </p>

      <ActivityFeed items={feed} />

      {feed.length >= FEED_LIMIT ? (
        <p className="muted" data-testid="activity-capped" style={{ fontSize: 'var(--fs-meta-lg)' }}>
          Showing the {FEED_LIMIT} most recent. Older entries are still in your venture’s records.
        </p>
      ) : null}

      {failures.length ? (
        <div data-testid="activity-failures" style={{ marginTop: '1.25rem' }}>
          {groupFailures(failures).map((g, i) => (
            <p key={i} className="card muted" style={{ fontSize: 'var(--fs-body-sm)' }}>
              <span aria-hidden="true">⚠ </span>{g.text}
              {/* What happens next, including "this one will not clear on its own" — the half a
                  founder can act on, and the reason these are grouped by cause at all. */}
              {g.nextStep ? <> {g.nextStep}</> : null}
            </p>
          ))}
        </div>
      ) : null}

      {access.isAdmin ? (
        // Only Bruntsfield. A founder has one venture and the cross-venture feed would be a door to
        // a room with their own furniture in it.
        <p className="muted" data-testid="activity-all-ventures" style={{ fontSize: 'var(--fs-meta-lg)', marginTop: '1.25rem' }}>
          <Link href="/activity">Every venture at once →</Link>
        </p>
      ) : null}
    </section>
  );
}

/** Bounded because the page is, not because the truth is — and it says so when it caps. */
const FEED_LIMIT = 40;
