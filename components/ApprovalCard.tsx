'use client';

import { useState, useTransition } from 'react';
import type { ActiveGraphApproval } from '@/lib/approvals';
import { formatMoney } from '@/lib/budgets';
import { toneColor } from '@/lib/status';
import { approveExternalAction, refuseExternalAction } from '@/app/actions/approvals';

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

/**
 * The story of this approval, already turned into sentences server-side (FB-071).
 *
 * Narrated on the server, not here, because verifying an event needs the signing secret and that
 * must never reach a browser. What crosses the boundary is prose a founder can read.
 */
export interface ApprovalHistory {
  lines: string[];
  faults: string[];
  refused: number;
}

export function ApprovalCard({
  ventureId,
  approval,
  history,
  decide = false,
}: {
  ventureId: string;
  approval: ActiveGraphApproval;
  history?: ApprovalHistory;
  /**
   * May this rendering of the approval SIGN (FB-183)?
   *
   * Default false, and only `/venture/<id>/approvals/<repo>/<id>` passes true — so there is exactly
   * one surface in the studio that can grant or refuse an external send, and every other place that
   * shows one is a pointer to it.
   *
   * A default of false rather than true is the whole safety of this prop. A new screen that renders
   * an approval and forgets to think about it gets a read-only card, which is the harmless mistake;
   * the other default would silently add a second signing surface and nothing would fail.
   */
  decide?: boolean;
}) {
  // Test ids are repo-qualified (FB-058). Since FB-045 an approval id is unique only WITHIN its
  // department's repo, so two departments with an identically-named ticket produced duplicate ids —
  // which Playwright's strict mode treats as an error and which made the UI gate's coverage of this
  // surface quietly conditional on no venture ever having that collision. Same key as the React one.
  const tid = `${approval.repo}/${approval.id}`;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [refusing, setRefusing] = useState(false);
  const [note, setNote] = useState('');
  const failing = approval.checks.filter((c) => !c.passed).length;
  const done = result?.ok || approval.status !== 'proposed';
  // Read-only unless this rendering is the decision surface. `done` still applies on top: a decided
  // approval shows its state, here as everywhere else.
  const canDecide = decide && !done;

  return (
    <div className="card" data-testid={`approval-${tid}`} style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>
        {/* min-width:0 so a long summary shrinks; flex-shrink:0 so the tag keeps its size and stays
            inside. A flex item will not shrink below its content without the first, which is what
            pushed these tags off a phone screen and made the board scroll sideways. */}
        <strong style={{ fontSize: 'var(--fs-subhead)', minWidth: 0 }}>{approval.summary}</strong>
        <span className="tag" style={{ flexShrink: 0 }} data-testid={`approval-${tid}-dept`}>
          {approval.department ?? 'general'}
        </span>
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
      {/* FB-068: what THIS action costs — not the department's whole budget position.
          Four approval cards each carried the identical budget paragraph in red: one fact about a
          department, repeated as though it were four facts about four actions. It flattened the
          hierarchy, so a grant the studio could not verify read no louder than a routine spend.
          The department states its position once (VentureBoard); a card states only its own cost,
          and red is kept for what is genuinely alarming.
          FB-054's reasoning stands and is unchanged — the studio owns the limit, does not own the
          spend, and says so where the position is stated. */}
      {approval.amountMinor !== null && approval.currency ? (
        <p
          data-testid={`approval-${tid}-budget`}
          data-budget-over={approval.budget?.overLimit ? 'true' : 'false'}
          className="muted"
          style={{ fontSize: 'var(--fs-body-sm)', margin: '0.5rem 0 0' }}
        >
          This one costs {formatMoney(approval.amountMinor, approval.currency)}.
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
        {!canDecide ? (
          <span
            className={`tag ${approval.status === 'failed' || approval.status === 'unverified-action' ? '' : 'tag-accent'}`}
            data-testid={`approval-${tid}-state`}
            style={approval.status === 'failed' || approval.status === 'unverified-action'
              ? { color: toneColor('blocked') }
              : undefined}
          >
            {result?.ok ? (result.message.startsWith('Refused') ? 'refused' : 'approved') : STATE_LABEL[approval.status] ?? approval.status}
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
        {/* FB-183: the other answer. A founder could approve a send and could not refuse one — the
            only way to say no was to leave it in the queue for ever, which reads on every screen as
            a decision not yet made rather than one that has been. */}
        {canDecide && !refusing ? (
          <button
            type="button"
            className="btn"
            data-testid={`approval-${tid}-refuse`}
            disabled={pending}
            onClick={() => setRefusing(true)}
          >
            Refuse, and say why
          </button>
        ) : null}
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

      {/* The note is required, and the button stays disabled until there is one. A refusal with no
          reason gives the lane nothing to come back with — the rule pull requests have followed
          since FB-064, applied to the decision that actually stops something leaving the company. */}
      {canDecide && refusing ? (
        <div data-testid={`approval-${tid}-refuse-form`} style={{ marginTop: '0.75rem' }}>
          <label htmlFor={`refuse-note-${tid}`} style={{ fontSize: 'var(--fs-body-sm)', display: 'block', marginBottom: '0.3rem' }}>
            Why are you refusing this? Your team reads this and comes back with a revision.
          </label>
          <textarea
            id={`refuse-note-${tid}`}
            data-testid={`approval-${tid}-refuse-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            style={{
              width: '100%', maxWidth: 'var(--content-narrow)', fontSize: 'var(--fs-body-sm)',
              border: '1px solid var(--color-border)', borderRadius: '0.25rem', padding: '0.4rem',
            }}
          />
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              data-testid={`approval-${tid}-refuse-send`}
              disabled={pending || note.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  setResult(await refuseExternalAction(
                    ventureId, approval.id, approval.repo, approval.proposalSha ?? undefined, note,
                  ));
                })
              }
            >
              {pending ? 'Sending it back…' : 'Send it back'}
            </button>
            <button
              type="button"
              className="btn"
              data-testid={`approval-${tid}-refuse-cancel`}
              disabled={pending}
              onClick={() => { setRefusing(false); setNote(''); }}
            >
              Never mind
            </button>
          </div>
        </div>
      ) : null}

      {/* A refusal that has been made says who made it and why, wherever the approval is shown. */}
      {approval.refusal ? (
        <p data-testid={`approval-${tid}-refusal`} className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.6rem 0 0', maxWidth: 'var(--content-narrow)' }}>
          Refused by {approval.refusal.refusedBy}. Nothing went out.
          {approval.refusal.note ? <> They said: &ldquo;{approval.refusal.note}&rdquo;</> : null}
        </p>
      ) : null}

      {/* FB-071: the whole story, in order. Not an event dump — sentences. This is the thing a
          founder can point at and say "a person agreed to this, and here is what followed". */}
      {history && (history.lines.length > 0 || history.faults.length > 0) ? (
        <div data-testid={`approval-${tid}-history`} style={{ marginTop: '0.75rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.3rem' }}>What happened</p>
          <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 'var(--fs-meta-lg)' }}>
            {history.lines.map((line, i) => (
              <li key={i} data-testid={`approval-${tid}-history-line`}>{line}</li>
            ))}
          </ol>
          {history.faults.map((fault, i) => (
            <p
              key={i}
              data-testid={`approval-${tid}-history-fault`}
              style={{ fontSize: 'var(--fs-meta-lg)', color: toneColor('attention'), margin: '0.4rem 0 0' }}
            >
              <span aria-hidden="true">⚠ </span>
              <span className="sr-only">Warning: </span>
              {fault}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
