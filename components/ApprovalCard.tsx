'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { approveExternalAction } from '@/app/actions/approvals';

// FB-046: the founder-grade approve card for an external action (E1). Plain-language summary + the
// policy checks[] (a "policy engine clear / N failing" read) + Approve. The founder never touches
// github.com — Approve calls the server action, which signs the grant the executor verifies.
export function ApprovalCard({ ventureId, approval }: { ventureId: string; approval: ActiveGraphApproval }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const failing = approval.checks.filter((c) => !c.passed).length;
  const done = result?.ok || approval.status !== 'proposed';


  return (
    <div className="card" data-testid={`approval-${approval.id}`} style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '15px' }}>{approval.summary}</strong>
        <span className="tag" data-testid={`approval-${approval.id}-dept`}>{approval.department ?? 'general'}</span>
      </div>
      {/* FB-051 (narrowed): what the studio can PROVE about this approval. An attested grant names
          the human who issued it; anything else says plainly that it is recorded but unverified and
          that the executor will refuse it. The studio does not adjudicate beyond the attestation —
          see lib/provenance.ts on why an agent-writable log could never do that job. */}
      {approval.provenanceNote ? (
        <p
          data-testid={`approval-${approval.id}-provenance`}
          data-grant-provenance={approval.grantProvenance}
          style={{
            fontSize: 'var(--fs-body-sm)',
            margin: '0.5rem 0 0',
            color: approval.grantProvenance === 'unattested' ? 'var(--color-error)' : undefined,
            fontWeight: approval.grantProvenance === 'unattested' ? 600 : undefined,
          }}
        >
          {approval.provenanceNote}
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
