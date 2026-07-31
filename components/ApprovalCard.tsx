'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { toneColor } from '@/lib/status';
import { approveExternalAction } from '@/app/actions/approvals';

// FB-046: the founder-grade approve card for an external action (E1). Plain-language summary + the
// policy checks[] (a "policy engine clear / N failing" read) + Approve. The founder never touches
// github.com — Approve calls the server action, which signs the grant the executor verifies.
/** Plain-language state names — the founder never sees the contract enum (FB-024). */
const STATE_LABEL: Record<string, string> = {
  proposed: 'waiting for you',
  granted: 'approved',
  executing: 'going out now',
  executed: 'sent',
  failed: 'failed to send',
  rejected: 'refused',
  'unverified-action': 'went out without a verified approval',
};

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
      {/* FB-051 (narrowed): what the studio can PROVE about this approval, and what to DO about it.
          Every lane read-failure on the board carries an explicit next step; this is the highest-
          stakes surface in the product and it had none. See lib/provenance.ts on why an
          agent-writable log could never do this job. */}
      {approval.provenance ? (
        <p
          data-testid={`approval-${approval.id}-provenance`}
          data-grant-provenance={approval.grantProvenance}
          style={{
            fontSize: 'var(--fs-body-sm)',
            margin: '0.5rem 0 0',
            maxWidth: 'var(--content-narrow)',
            color: approval.grantProvenance === 'unattested' ? toneColor('blocked') : undefined,
            fontWeight: approval.grantProvenance === 'unattested' ? 600 : undefined,
          }}
        >
          {approval.grantProvenance === 'unattested' ? (
            <>
              <span aria-hidden="true">⚠ </span>
              <span className="sr-only">Warning: </span>
            </>
          ) : null}
          {approval.provenance.text}
          {approval.provenance.nextStep ? (
            <> <strong>Next step:</strong> {approval.provenance.nextStep}</>
          ) : null}
        </p>
      ) : null}
      {approval.checks.length > 0 ? (
        <p className="muted" data-testid={`approval-${approval.id}-checks`} style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.35rem 0 0' }}>
          {failing === 0 ? '✓ policy checks clear' : `⚠ ${failing} policy check${failing === 1 ? '' : 's'} need a look`} ·{' '}
          {approval.checks.map((c) => `${c.passed ? '✓' : '✗'} ${c.name}`).join(' · ')}
        </p>
      ) : null}
      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {done ? (
          <span
            className={`tag ${approval.status === 'failed' || approval.status === 'unverified-action' ? '' : 'tag-accent'}`}
            data-testid={`approval-${approval.id}-state`}
            style={approval.status === 'failed' || approval.status === 'unverified-action'
              ? { color: toneColor('blocked') }
              : undefined}
          >
            {result?.ok ? 'approved' : STATE_LABEL[approval.status] ?? approval.status}
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
        {approval.outcome ? (
          <span className="muted" data-testid={`approval-${approval.id}-outcome`} style={{ fontSize: 'var(--fs-meta)' }}>
            {approval.outcome}
          </span>
        ) : null}
        {result ? (
          <span className={result.ok ? 'muted' : ''} data-testid={`approval-${approval.id}-msg`} style={{ fontSize: 'var(--fs-meta-lg)', color: result.ok ? undefined : toneColor('attention') }}>
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
