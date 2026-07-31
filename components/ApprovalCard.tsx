'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { describe as describeBudget } from '@/lib/budgets';
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
  // Test ids are repo-qualified (FB-058). Since FB-045 an approval id is unique only WITHIN its
  // department's repo, so two departments with an identically-named ticket produced duplicate ids —
  // which Playwright's strict mode treats as an error and which made the UI gate's coverage of this
  // surface quietly conditional on no venture ever having that collision. Same key as the React one.
  const tid = `${approval.repo}/${approval.id}`;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const failing = approval.checks.filter((c) => !c.passed).length;
  const done = result?.ok || approval.status !== 'proposed';

  return (
    <div className="card" data-testid={`approval-${tid}`} style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: 'var(--fs-subhead)' }}>{approval.summary}</strong>
        <span className="tag" data-testid={`approval-${tid}-dept`}>{approval.department ?? 'general'}</span>
      </div>
      {/* FB-051 (narrowed): what the studio can PROVE about this approval, and what to DO about it.
          Every lane read-failure on the board carries an explicit next step; this is the highest-
          stakes surface in the product and it had none. See lib/provenance.ts on why an
          agent-writable log could never do this job. */}
      {approval.provenance ? (
        <p
          data-testid={`approval-${tid}-provenance`}
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
      {/* What the STUDIO can say about the budget: the founder's own limit, and the spend the
          VENTURE reports. Deliberately not a pass/fail check — the studio owns the limit and does
          not own the total, and dressing an unverifiable figure as a verdict is what three review
          passes kept punishing. Rendered above the proposer's claims and attributed. */}
      {approval.budget ? (
        <p
          data-testid={`approval-${tid}-budget`}
          data-budget-over={approval.budget.overLimit ? 'true' : 'false'}
          style={{
            fontSize: 'var(--fs-body-sm)',
            margin: '0.5rem 0 0',
            color: approval.budget.overLimit ? toneColor('blocked') : undefined,
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
          data-testid={`approval-${tid}-checks`}
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
          <span
            className={`tag ${approval.status === 'failed' || approval.status === 'unverified-action' ? '' : 'tag-accent'}`}
            data-testid={`approval-${tid}-state`}
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
            data-testid={`approval-${tid}-approve`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                // Three things travel with the click, not one.
                //   repo — since FB-045 an approval id is unique only within its department's repo;
                //          the server checks it against the venture's own declared repos.
                //   proposalSha — the exact proposal these words were rendered from, so approving
                //          something that changed underneath is refused rather than merely noticed
                //          afterwards (FB-058).
                setResult(await approveExternalAction(ventureId, approval.id, approval.repo, approval.proposalSha ?? undefined));
              })
            }
          >
            {pending ? 'Approving…' : 'Approve'}
          </button>
        )}
        {approval.outcome ? (
          <span className="muted" data-testid={`approval-${tid}-outcome`} style={{ fontSize: 'var(--fs-meta)' }}>
            {approval.outcome}
          </span>
        ) : null}
        {result ? (
          <span className={result.ok ? 'muted' : ''} data-testid={`approval-${tid}-msg`} style={{ fontSize: 'var(--fs-meta-lg)', color: result.ok ? undefined : toneColor('attention') }}>
            {result.message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
