'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { toneColor } from '@/lib/status';
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
        <strong style={{ fontSize: 'var(--fs-subhead)' }}>{approval.summary}</strong>
        <span className="tag" data-testid={`approval-${approval.id}-dept`}>{approval.department ?? 'general'}</span>
      </div>
      {approval.checks.length > 0 ? (
        <p className="muted" data-testid={`approval-${approval.id}-checks`} style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.35rem 0 0' }}>
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
          <span className={result.ok ? 'muted' : ''} data-testid={`approval-${approval.id}-msg`} style={{ fontSize: 'var(--fs-meta-lg)', color: result.ok ? undefined : toneColor('attention') }}>
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
