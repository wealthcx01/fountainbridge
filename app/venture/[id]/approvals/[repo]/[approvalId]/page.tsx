import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { approvalRepos, attachBudgetDisclosure } from '@/lib/approvals';
import { ventureApprovals } from '@/lib/venture-reads';
import { loadEnvelopes } from '@/lib/budgets-load';
import { ApprovalCard } from '@/components/ApprovalCard';
import { VentureForbidden } from '@/components/VentureForbidden';
import { historyFor } from '@/lib/activegraph-log';
import { narrate, narrateFault } from '@/lib/activegraph';
import { GitHubClient } from '@/lib/github';

/**
 * One external send, and the only place a decision about it is made (FB-183).
 *
 * ## Why this page exists
 *
 * Claude Design's rule for the desk is *"one decision surface, everywhere else is a pointer to it"*.
 * The desk could not follow it, because the desk WAS the surface: `ApprovalCard` carried the only
 * approve control in the studio and it rendered in exactly one place. Turning the desk's cards into
 * rows before building somewhere for the rows to point would have deleted the only way a founder
 * can approve anything leaving their company — CLAUDE.md non-negotiable 4, and the mistake FB-178
 * made and had to correct mid-flight.
 *
 * So the page came first, and the desk became rows afterwards.
 *
 * ## Why a page rather than the Tickets detail pane
 *
 * The studio already answers this question for a pull request: `/venture/<id>/work/<repo>/<number>`
 * is one piece of work on its own page, reached from the same queue. An external send is the same
 * shape of thing — work waiting on the founder, with no ticket file of its own — so it gets the same
 * shape of route rather than a second pattern.
 *
 * ## Scoping
 *
 * Enforced here, server-side, before anything is fetched (non-negotiable 6), and the repo segment is
 * checked against the venture's own declared approval repos — a founder should never see an owner in
 * a URL, and a repo nobody scoped them to must not be readable by typing one.
 */
export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ id: string; repo: string; approvalId: string }>;
}) {
  const { id, repo, approvalId } = await params;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const admins = parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS);
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, admins);
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  // The repo must be one this venture declares. Without this, the id in the URL decides which
  // repository the studio reads — which is the same class of hole the approve action closes by
  // checking `repoParam` against `approvalRepos`.
  if (!approvalRepos(venture).includes(repo)) return <NotHere ventureId={id} />;

  const all = await ventureApprovals(venture).catch(() => null);
  if (all === null) return <CouldNotRead ventureId={id} />;

  const found = all.find((a) => a.repo === repo && a.id === approvalId);
  if (!found) return <NotHere ventureId={id} />;

  // The same budget disclosure the desk attaches, so the cost line reads identically wherever the
  // approval is seen. Composed here rather than trusted from elsewhere: this is the screen the
  // decision is made on, and it must not show a cheaper number than the desk did.
  const { envelopes } = loadEnvelopes(venture.id);
  const [approval] = attachBudgetDisclosure(
    [found],
    envelopes,
    new Set((venture.departments ?? []).map((d) => d.id)),
    new Date(),
  );

  // The signed history, narrated server-side. Verifying an event needs the signing secret, and that
  // must never reach a browser — what crosses the boundary is prose (FB-071).
  const history = await approvalHistory(venture.id, repo, approvalId);

  return (
    <section data-testid="approval-page">
      <p className="eyebrow">
        <span className="eyebrow-id">{venture.name}</span> — a decision
      </p>
      <h1 style={{ margin: '0 0 0.5rem' }}>Before this goes out</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        This is the only place this decision is made. Approving signs the grant your venture&rsquo;s
        executor verifies — nothing leaves your company without it, and nothing here happens on
        github.com.
      </p>

      {/* `decide` — the whole point of the route. Everywhere else that renders an approval renders
          it read-only, so there is exactly one surface in the studio that can sign a grant. */}
      <ApprovalCard ventureId={venture.id} approval={approval} history={history} decide />

      <p style={{ fontSize: 'var(--fs-body-sm)', marginTop: '1.25rem' }}>
        <Link href={`/venture/${venture.id}`}>← Back to the desk</Link>
      </p>
    </section>
  );
}

/** The story of this approval, or nothing when the studio cannot verify one. */
async function approvalHistory(ventureId: string, repo: string, approvalId: string) {
  const secret = process.env.FOUNDRY_APPROVAL_SECRET ?? '';
  if (!secret) return undefined;
  try {
    const h = await historyFor(new GitHubClient(), ventureId, repo, approvalId, secret);
    if (h.applied.length === 0 && h.refused === 0) return undefined;
    return { lines: h.applied.map(narrate), faults: h.faults.map(narrateFault), refused: h.refused };
  } catch {
    return undefined;
  }
}

function NotHere({ ventureId }: { ventureId: string }) {
  return (
    <section data-testid="approval-not-here">
      <h1 style={{ margin: '0 0 0.5rem' }}>That decision is not here</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Nothing in this venture matches that link. It may have been decided already, or the link may
        be wrong. Your desk lists everything still waiting on you.
      </p>
      <p style={{ fontSize: 'var(--fs-body-sm)' }}>
        <Link href={`/venture/${ventureId}`}>← Back to the desk</Link>
      </p>
    </section>
  );
}

/**
 * The read failed, which is NOT the same as "there is nothing here" (non-negotiable 10).
 *
 * A founder sent to this page by a row on their desk, arriving at "that decision is not here",
 * would reasonably conclude the decision had gone away. It has not; the studio could not look.
 */
function CouldNotRead({ ventureId }: { ventureId: string }) {
  return (
    <section data-testid="approval-unreadable">
      <h1 style={{ margin: '0 0 0.5rem' }}>The studio could not read this decision</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Nothing has been approved and nothing has gone out. This is the studio failing to look, not
        your venture&rsquo;s records changing. Try again in a moment.
      </p>
      <p style={{ fontSize: 'var(--fs-body-sm)' }}>
        <Link href={`/venture/${ventureId}`}>← Back to the desk</Link>
      </p>
    </section>
  );
}
