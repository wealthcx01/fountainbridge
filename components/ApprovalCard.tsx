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
      {/* The STUDIO's own checks, kept visually apart from the proposer's. Rendering both in one
          undifferentiated list let a proposal write its own "sell budget envelope — passed" entry
          that the founder could not tell from the one the studio computed. Each check is its own
          element, so a delimiter inside a lane-authored string cannot fabricate extra entries. */}
      {approval.studioChecks.length > 0 ? (
        <ul
          data-testid={`approval-${approval.id}-studio-checks`}
          style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', fontSize: 'var(--fs-body-sm)' }}
        >
          {approval.studioChecks.map((c, i) => (
            <li key={i} style={{ color: c.passed ? undefined : 'var(--color-warn)' }}>
              {c.passed ? '✓' : '✗'} {c.name}
              {c.detail ? <> — <span className="mono">{c.detail}</span></> : null}
              <span className="muted"> · checked by the studio</span>
            </li>
          ))}
        </ul>
      ) : null}
      {approval.checks.length > 0 ? (
        <ul
          className="muted"
          data-testid={`approval-${approval.id}-checks`}
          style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0', fontSize: 'var(--fs-meta-lg)' }}
        >
          <li>
            {failing === 0 ? '✓ stated by the proposer' : `⚠ ${failing} check${failing === 1 ? '' : 's'} the proposer flagged`}
          </li>
          {approval.checks.map((c, i) => (
            <li key={i}>
              {c.passed ? '✓' : '✗'} {c.name}
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
