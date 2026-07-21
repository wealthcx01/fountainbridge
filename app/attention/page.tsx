import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadAccessibleAttention, type PrApproval } from '@/lib/attention';

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
        <h1 style={{ margin: 0 }}>Awaiting review</h1>
        <span className="tag" data-testid="attention-count">{approvals.length}</span>
      </div>
      <p className="muted" style={{ fontSize: '14px' }}>
        Every open PR across your ventures — the workshop never merges, so each one needs a human.
        Oldest first. <Link href="/attention?refresh=1" className="mono" data-testid="attention-refresh">refresh</Link>
      </p>
      <hr className="hr" />

      {errors.length > 0 ? (
        <p className="card muted" data-testid="attention-errors" style={{ borderColor: 'var(--color-warn)', fontSize: '13px' }}>
          Some repos couldn’t be read: {errors.join(' · ')}
        </p>
      ) : null}

      {approvals.length === 0 ? (
        <p className="card muted" data-testid="attention-empty">Nothing awaiting review. Inbox zero.</p>
      ) : (
        <div className="stack" data-testid="attention-queue" style={{ gap: '0.75rem' }}>
          {approvals.map((a) => (
            <ApprovalRow key={a.id} approval={a} ventureName={ventureNames[a.ventureId] ?? a.ventureId} />
          ))}
        </div>
      )}
    </section>
  );
}

function ApprovalRow({ approval, ventureName }: { approval: PrApproval; ventureName: string }) {
  const primary = approval.previewUrl ?? approval.url; // preview is the power path (parity §3)
  return (
    <article className="card card-link" data-testid={`approval-${approval.id}`} style={{ padding: '0.85rem 1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <a href={primary} target="_blank" rel="noreferrer" style={{ fontWeight: 500 }} data-testid={`approval-primary-${approval.id}`}>
          {approval.title}
        </a>
        <CiDot status={approval.ciStatus} />
        {approval.previewUrl ? <span className="tag tag-accent">preview</span> : null}
      </div>
      <div className="muted mono" style={{ fontSize: '12px', marginTop: '0.35rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span>{approval.repo}</span>
        <span>· {ventureName}</span>
        {approval.linkedTicketId ? <span>· {approval.linkedTicketId}</span> : null}
        {approval.author ? <span>· @{approval.author}</span> : null}
        <span>· {formatAge(approval.ageMs)} old</span>
        <a href={approval.url} target="_blank" rel="noreferrer" data-testid={`approval-pr-${approval.id}`}>· PR #{approval.number} ↗</a>
      </div>
    </article>
  );
}

function CiDot({ status }: { status: PrApproval['ciStatus'] }) {
  const color =
    status === 'success' ? 'var(--color-ok)' : status === 'failure' ? 'var(--color-error)' : 'var(--color-ink-muted)';
  return (
    <span className="tag mono" title={`CI: ${status}`} style={{ color }} data-testid="approval-ci">
      CI {status}
    </span>
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
