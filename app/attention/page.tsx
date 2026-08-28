import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadAccessibleAttention, type PrApproval } from '@/lib/attention';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { ticketsByRepo } from '@/lib/venture-tickets-index';
import { APPROVAL_REASSURANCE } from '@/lib/glossary';
import { prCiTone, toneColor } from '@/lib/status';
import { groupFailures, needsAction } from '@/lib/read-failures';
import { CHECK_LABEL } from '@/lib/glossary';
import { howLong } from '@/lib/when';

// The attention queue (FB-007): open PRs across every accessible venture, awaiting the human gate.
// Scoping runs server-side in loadAccessibleAttention.
export default async function AttentionPage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const { refresh } = await searchParams;
  // FB-129: absorbed as the Tickets screen's "Needs you" filter. A founder with one venture is sent
  // there, because that screen shows the same work AND lets them decide on it without leaving —
  // which is the whole point of absorbing it. A bookmark must never 404 (its own acceptance
  // criterion), so this is a redirect and not a deletion.
  //
  // Someone who can see more than one venture keeps this page: it is the only cross-venture view of
  // what is waiting, and sending John to one venture's list would quietly lose the other ventures.
  const email = session.user.email;
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const mine = ventures.filter((v) => canAccessVenture(access, v.id));
  if (mine.length === 1) redirect(`/venture/${mine[0].id}/tickets?filter=needs`);

  // FB-099: the queue names work the way the board does. Without the tickets it showed the lane's
  // own branch-speak — "build: bulk-daily-price-feed-plan (Foundry lane)" — for the same items the
  // board listed under their human titles, and a founder had no way to connect the two lists.

  const { approvals, ventureNames, errors } = await loadAccessibleAttention(session.user.email, {
    refresh: refresh === '1',
    ticketsFor: (venture) => ticketsByRepo(venture, { refresh: refresh === '1' }),
  });

  return (
    <section>
      <p className="eyebrow"><span className="eyebrow-id">Attention</span> — Foundry Studio</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
        {/* FB-076: one name for one thing. The nav said "Attention", the heading said "Awaiting
            review" and the introduction said "waiting on your OK" — three phrasings, and "review"
            in particular means something specific and different in engineering. */}
        <h1 style={{ margin: 0 }}>Needs you</h1>
        <span className="tag" data-testid="attention-count">{approvals.length}</span>
      </div>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)' }}>
        Everything across your ventures waiting on your OK. {APPROVAL_REASSURANCE} Oldest first.{' '}
        <Link href="/attention?refresh=1" className="mono" data-testid="attention-refresh">refresh</Link>
      </p>
      <hr className="hr" />

      {approvals.length === 0 ? (
        <p className="card muted" data-testid="attention-empty">Nothing is waiting for you.</p>
      ) : (
        <>
          {/* FB-100's item 5: every card carried the identical badge "This work has no automatic
              checks" — fifteen copies of one fact about the repository, which is how a founder
              learns to stop reading badges. When they all say the same thing, say it once; the
              per-card badge comes back the moment items DIFFER, which is when it means something. */}
          {sharedCheckState(approvals) ? (
            <p className="muted" data-testid="attention-checks-shared" style={{ fontSize: 'var(--fs-body-sm)', marginTop: '-0.25rem' }}>
              {CHECK_LABEL[sharedCheckState(approvals) as string] ?? CHECK_LABEL.unknown} — the same for everything below.
            </p>
          ) : null}
          <div className="stack" data-testid="attention-queue" style={{ gap: '0.75rem' }}>
            {approvals.map((a) => (
              <ApprovalRow
                key={a.id}
                approval={a}
                ventureName={ventureNames[a.ventureId] ?? a.ventureId}
                showChecks={!sharedCheckState(approvals)}
              />
            ))}
          </div>
        </>
      )}

      {/* FB-076: BELOW the work, not above it. A founder came here to answer something; a degraded
          read is context for what they are seeing, not the headline. Grouped by cause, because the
          cause is what decides whether they should do anything — and the version this replaced ran
          five failures and two causes into one sentence with `·` separators. */}
      <ReadFailures messages={errors} />
    </section>
  );
}

/**
 * The one check state every item shares, or null when they differ (FB-100's item 5).
 *
 * Null for a single item too: "the same for everything below" over one card is a sentence about
 * nothing, and the card's own badge says it better.
 */
function sharedCheckState(approvals: PrApproval[]): PrApproval['ciStatus'] | null {
  if (approvals.length < 2) return null;
  const first = approvals[0].ciStatus;
  return approvals.every((a) => a.ciStatus === first) ? first : null;
}

function ApprovalRow({
  approval,
  ventureName,
  showChecks = true,
}: {
  approval: PrApproval;
  ventureName: string;
  /** False when the whole queue shares one check state and it has been said once above. */
  showChecks?: boolean;
}) {
  // FB-064: the title now opens the work INSIDE the studio. This page told a founder work was
  // waiting for their OK and then offered one link to github.com — the break in the loop.
  // `repo` is the short name; the venture's manifest resolves the owner, so no founder-facing URL
  // carries one.
  const shortRepo = approval.repo.includes('/') ? approval.repo.split('/')[1] : approval.repo;
  const here = `/venture/${approval.ventureId}/work/${shortRepo}/${approval.number}`;
  return (
    <article className="card card-link" data-testid={`approval-${approval.id}`} style={{ padding: '0.85rem 1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Link href={here} style={{ fontWeight: 500 }} data-testid={`approval-primary-${approval.id}`}>
          {approval.ticketTitle ?? approval.title}
        </Link>
        {showChecks ? <CiDot status={approval.ciStatus} /> : null}
        {approval.previewUrl ? (
          <a href={approval.previewUrl} target="_blank" rel="noreferrer" className="tag tag-accent" data-testid={`approval-preview-${approval.id}`}>
            see it running
          </a>
        ) : null}
      </div>
      <div className="muted" style={{ fontSize: 'var(--fs-meta)', marginTop: '0.35rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span>{ventureName}</span>
        {approval.linkedTicketId ? <span>· {approval.linkedTicketId}</span> : null}
        {/* FB-100's item 6: "waiting 3 days" — waiting on whom? The sentence FB-064's page already
            uses is the one that works. */}
        <span>· waiting {howLong(approval.createdAt) ?? 'a while'} for you</span>
        <Link href={here} data-testid={`approval-open-${approval.id}`}>· Read it and decide</Link>
      </div>
    </article>
  );
}

/**
 * FB-076: what the automatic checks say, in the same words the work view uses.
 *
 * This said `CI UNKNOWN` beside every item — small capitals, monospace — which means "this
 * repository has no automatic checks". That is true of ARCA and completely fine, and it read to a
 * founder as something being wrong. The work view learned to say it plainly in FB-064; the queue
 * had not, so the same fact was reassuring on one screen and alarming on another.
 */
function CiDot({ status }: { status: PrApproval['ciStatus'] }) {
  const color = toneColor(prCiTone(status));
  return (
    <span className="tag" style={{ color }} data-testid="approval-ci" data-checks={status}>
      {CHECK_LABEL[status] ?? CHECK_LABEL.unknown}
    </span>
  );
}

function ReadFailures({ messages }: { messages: string[] }) {
  const groups = groupFailures(messages);
  if (groups.length === 0) return null;
  return (
    <div data-testid="attention-errors" style={{ marginTop: '1.5rem' }}>
      <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>
        {needsAction(groups) ? 'Some of your work is not showing' : 'One workstream is catching up'}
      </p>
      {groups.map((g) => (
        <p
          key={g.cause}
          className="card"
          data-testid={`read-failure-${g.cause}`}
          data-transient={g.transient}
          style={{ fontSize: 'var(--fs-meta-lg)', marginBottom: '0.5rem',
                   borderColor: g.transient ? undefined : toneColor('attention') }}
        >
          {g.text}{' '}
          <span className="muted">{g.nextStep}</span>
        </p>
      ))}
    </div>
  );
}

