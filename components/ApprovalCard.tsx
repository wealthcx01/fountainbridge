'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { blockingFaults } from '@/lib/activegraph';
import { approveExternalAction } from '@/app/actions/approvals';

// FB-046: the founder-grade approve card for an external action (E1). Plain-language summary + the
// policy checks[] (a "policy engine clear / N failing" read) + Approve. The founder never touches
// github.com — Approve calls the server action, which signs the grant the executor verifies.
export function ApprovalCard({ ventureId, approval }: { ventureId: string; approval: ActiveGraphApproval }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const failing = approval.checks.filter((c) => !c.passed).length;
  const done = result?.ok || approval.status !== 'proposed';
  // Only faults that impugn what the log SAYS withhold approval. Storage-order noise must never
  // block a founder from approving a sound record (FB-051 review).
  const blocking = blockingFaults(approval.faults);

  return (
    <div className="card" data-testid={`approval-${approval.id}`} style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '15px' }}>{approval.summary}</strong>
        <span className="tag" data-testid={`approval-${approval.id}-dept`}>{approval.department ?? 'general'}</span>
      </div>
      {/* FB-051: a record whose event log does not hold up must SAY SO, in front of the approve
          button. The whole promise of the gate is "we can prove exactly what happened" — rendering a
          confident status over a broken chain would quietly turn that into a lie. */}
      {blocking.length > 0 ? (
        <p
          className="card"
          data-testid={`approval-${approval.id}-faults`}
          style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)', padding: '0.5rem 0.75rem', margin: '0.5rem 0 0', fontSize: '13px' }}
        >
          ⚠ This record cannot be verified — {blocking.map((f) => f.message).join('; ')}. Its
          audit trail is incomplete, so treat what it says with caution.
        </p>
      ) : null}
      {approval.checks.length > 0 ? (
        <p className="muted" data-testid={`approval-${approval.id}-checks`} style={{ fontSize: '13px', margin: '0.35rem 0 0' }}>
          {failing === 0 ? '✓ policy checks clear' : `⚠ ${failing} policy check${failing === 1 ? '' : 's'} need a look`} ·{' '}
          {approval.checks.map((c) => `${c.passed ? '✓' : '✗'} ${c.name}`).join(' · ')}
        </p>
      ) : null}
      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {done ? (
          <span className="tag tag-accent" data-testid={`approval-${approval.id}-state`}>
            {result?.ok ? 'approved' : approval.status}
          </span>
        ) : blocking.length > 0 ? (
          // Deliberately no Approve button. Approving against a log we cannot verify would produce
          // exactly the record this ticket exists to make impossible — a grant whose provenance is
          // already in doubt. A human must sort the log out first.
          <span className="tag" data-testid={`approval-${approval.id}-blocked`}>needs a human to check the record</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            data-testid={`approval-${approval.id}-approve`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(await approveExternalAction(ventureId, approval.id));
              })
            }
          >
            {pending ? 'Approving…' : 'Approve'}
          </button>
        )}
        {result ? (
          <span className={result.ok ? 'muted' : ''} data-testid={`approval-${approval.id}-msg`} style={{ fontSize: '13px', color: result.ok ? undefined : 'var(--color-warn)' }}>
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
