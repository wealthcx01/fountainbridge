'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { describe as describeBudget } from '@/lib/budgets';
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
      {/* What the STUDIO can say about the budget: the founder's own limit, and the spend the
          VENTURE reports. Deliberately not a pass/fail check — the studio owns the limit and does
          not own the total, and dressing an unverifiable figure as a verdict is what three review
          passes kept punishing. Rendered above the proposer's claims and attributed. */}
      {approval.budget ? (
        <p
          data-testid={`approval-${approval.id}-budget`}
          data-budget-over={approval.budget.overLimit ? 'true' : 'false'}
          style={{
            fontSize: 'var(--fs-body-sm)',
            margin: '0.5rem 0 0',
            color: approval.budget.overLimit ? 'var(--color-error)' : undefined,
            fontWeight: approval.budget.overLimit ? 600 : undefined,
          }}
        >
          {describeBudget(approval.budget, approval.department ?? 'this surface')}{' '}
          <span className="muted">Limit set in the studio; spend as reported by the venture.</span>
        </p>
      ) : null}
      {approval.checks.length > 0 ? (
        <ul
          className="muted"
          data-testid={`approval-${approval.id}-checks`}
          style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0', fontSize: 'var(--fs-body-sm)' }}
        >
          <li>
            {failing === 0 ? '✓ stated by the proposer' : `⚠ ${failing} check${failing === 1 ? '' : 's'} the proposer flagged`}
          </li>
          {approval.checks.map((c, i) => (
            <li key={i}>
              <span aria-hidden="true">{c.passed ? '✓' : '✗'}</span>
              <span className="sr-only">{c.passed ? 'passed: ' : 'failed: '}</span>
              {c.name}
              {c.detail ? <> — {c.detail}</> : null}
            </li>
          ))}
        </ul>
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
