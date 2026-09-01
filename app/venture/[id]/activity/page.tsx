import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadVentureHealth } from '@/lib/health';
import { ventureApprovals, ventureRuns } from '@/lib/venture-reads';
import { type ActiveGraphApproval } from '@/lib/approvals';
import { GitHubClient } from '@/lib/github';
import { buildFeed } from '@/lib/activity-feed';
import { composeActivitySummary } from '@/lib/activity-summary';
import { classifyActivity, dedupeActivity, isFounderVisible } from '@/lib/activity-kind';
import { groupFailures } from '@/lib/read-failures';
import { onDate } from '@/lib/when';
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

  return (
    <Suspense fallback={<ActivityWaiting ventureName={venture.name} />}>
      <Record venture={venture} isAdmin={access.isAdmin} refreshing={refresh === '1'} />
    </Suspense>
  );
}

/**
 * The screen before its records are in (FB-158).
 *
 * Every other screen under a venture answers in about 230 ms; this one took **5,986 ms**, because it
 * awaited three reads before rendering anything — and `ventureRuns` alone is the most expensive read
 * in the studio (~4.3s, measured in FB-157).
 *
 * The heading is true before any of them return, so it renders now.
 *
 * **No summary sentence, no skeleton rows, and no controls.** The summary counts changes in a
 * fourteen-day window: a greyed-out one is still a claim about the venture. And a control in a
 * Suspense fallback is not hydrated — FB-157 shipped one, and while the boundary resolved there were
 * two of it in the document, one of them dead.
 */
function ActivityWaiting({ ventureName }: { ventureName: string }) {
  return (
    <section data-testid="activity-waiting">
      <p className="eyebrow"><span className="eyebrow-id">{ventureName}</span> — What happened</p>
      <h1 style={{ margin: '0 0 0.5rem' }}>What happened</h1>
      <p className="muted" data-testid="activity-waiting-line"
         style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Reading what {ventureName} has been doing&hellip;
      </p>
    </section>
  );
}

/** The record once it is read. Everything below here costs a round trip. */
async function Record({
  venture,
  isAdmin,
  refreshing,
}: {
  venture: VentureSummary;
  isAdmin: boolean;
  refreshing: boolean;
}) {
  // Three reads, in parallel, each already bounded by its own loader (FB-123). This screen adds no
  // per-row read: the decisions come out of the approvals the desk already loads, not from walking
  // each one's event history.
  //
  // A source that could not be read is SAID, never swallowed. Both of these degraded silently, and
  // the consequence was specific: a mis-scoped token 403s the approvals read, every decision
  // disappears, and the page goes on promising "your decisions appear the moment you make them"
  // with nothing to show it could not see (CLAUDE.md #10). A log that quietly drops failures is
  // worse than no log — including when what it drops is its own.
  const unreadable: string[] = [];
  const [health, runs, approvals] = await Promise.all([
    loadVentureHealth(venture, { refresh: refreshing }),
    // Shared with the rail around this page (FB-157), which reads both of these too.
    ventureRuns(venture).catch(() => {
      unreadable.push('what your team has been doing');
      return { reports: [], heartbeats: [], total: 0 };
    }),
    ventureApprovals(venture).catch((): ActiveGraphApproval[] => {
      unreadable.push('the decisions you have made');
      return [];
    }),
  ]);

  // Dedupe, THEN filter. `health.activity` carries a merged pull request with its paths and a paired
  // commit without them: filtering first drops the pull request as housekeeping and leaves its twin,
  // which classifies as `unknown` and is founder-visible — so a `.github/workflows/` change that
  // `/activity` correctly hides reappeared here as "changed".
  const activity = dedupeActivity(health.activity).filter((e) => isFounderVisible(classifyActivity(e)));

  // `loadRunReports` already partitions heartbeats out; they arrive in their own field.
  const { items: feed, truncated } = buildFeed({ activity, runs: runs.reports, approvals, limit: FEED_LIMIT });
  // Composed from the SAME list the rows come from. `lib/activity-summary.ts` states that invariant
  // in its own header — "there is no second pass that could drift" — and composing it from the
  // undeduplicated events made the paragraph count changes the list below did not show.
  const summary = composeActivitySummary({ events: activity, windowDays: 14, openAreas: [] });

  const failures = health.repos.filter((r) => r.error).map((r) => r.error as string);
  // How far back the list actually reaches, from the list itself rather than from any window.
  const oldest = feed.length ? onDate(feed[feed.length - 1].at) : null;

  return (
    <section data-testid="venture-activity">
      <p className="eyebrow"><span className="eyebrow-id">{venture.name}</span> — What happened</p>
      <h1 style={{ margin: '0 0 0.5rem' }}>What happened</h1>

      {/* The summary counts CHANGES in a fourteen-day window; the record below also carries runs
          and decisions, which have no window at all. A founder read "in the last 14 days" directly
          above a decision from June and reasonably took the paragraph as describing the list. So the
          paragraph says what it counts, and the list says how far back it goes. */}
      <div data-testid="activity-summary" style={{ maxWidth: 'var(--content-narrow)' }}>
        {summary.sentences.map((s, i) => (
          <p key={i} style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.3rem' }}>
            {i === 0 ? <>Changes to your product: {s.charAt(0).toLowerCase()}{s.slice(1)}</> : s}
          </p>
        ))}
      </div>

      <p className="muted" data-testid="activity-scope" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Everything {venture.name} did{oldest ? <> since {oldest}</> : null}, newest first. Sent,
        failed, refused: it stays here with its state. Decisions appear the moment they are made.
      </p>

      <ActivityFeed items={feed} couldNotRead={unreadable.length > 0 || failures.length > 0} />

      {truncated ? (
        <p className="muted" data-testid="activity-capped" style={{ fontSize: 'var(--fs-meta-lg)' }}>
          Showing the {FEED_LIMIT} most recent. Older entries are still in your venture’s records.
        </p>
      ) : null}

      {unreadable.length ? (
        <p className="card" data-testid="activity-unreadable" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
          <span aria-hidden="true">⚠ </span>
          The studio could not read {unreadable.join(' or ')}, so this record is incomplete. It is not
          that nothing happened — it is that the studio could not see it. Bruntsfield can look into why.
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

      {isAdmin ? (
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
