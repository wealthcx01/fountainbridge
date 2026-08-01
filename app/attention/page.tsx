import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadAccessibleAttention, type PrApproval } from '@/lib/attention';
import { APPROVAL_REASSURANCE } from '@/lib/glossary';
import { prCiTone, toneColor } from '@/lib/status';
import { groupFailures, needsAction } from '@/lib/read-failures';
import { CHECK_LABEL } from '@/lib/glossary';

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
  const { approvals, ventureNames, errors } = await loadAccessibleAttention(session.user.email, {
    refresh: refresh === '1',
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
        <div className="stack" data-testid="attention-queue" style={{ gap: '0.75rem' }}>
          {approvals.map((a) => (
            <ApprovalRow key={a.id} approval={a} ventureName={ventureNames[a.ventureId] ?? a.ventureId} />
          ))}
        </div>
      )}

      {/* FB-076: BELOW the work, not above it. A founder came here to answer something; a degraded
          read is context for what they are seeing, not the headline. Grouped by cause, because the
          cause is what decides whether they should do anything — and the version this replaced ran
          five failures and two causes into one sentence with `·` separators. */}
      <ReadFailures messages={errors} />
    </section>
  );
}

function ApprovalRow({ approval, ventureName }: { approval: PrApproval; ventureName: string }) {
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
          {approval.title}
        </Link>
        <CiDot status={approval.ciStatus} />
        {approval.previewUrl ? (
          <a href={approval.previewUrl} target="_blank" rel="noreferrer" className="tag tag-accent" data-testid={`approval-preview-${approval.id}`}>
            see it running
          </a>
        ) : null}
      </div>
      <div className="muted" style={{ fontSize: 'var(--fs-meta)', marginTop: '0.35rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span>{ventureName}</span>
        {approval.linkedTicketId ? <span>· {approval.linkedTicketId}</span> : null}
        <span>· {formatAge(approval.ageMs)} old</span>
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

function formatAge(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / 60_000);
  return `${mins}m`;
}
