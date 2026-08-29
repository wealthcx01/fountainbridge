'use client';

import Link from 'next/link';
import { PlanPanel } from './PlanPanel';
import type { RailState } from '@/lib/composer-rail';

/**
 * The composer's right-hand rail (FB-131) — the thing being made, while it is being made.
 *
 * Five states and never two. It chooses none of them: `railState` decides and this renders, so the
 * question "what am I about to press" has one answer computed in one place.
 *
 * The promise in the copy is load-bearing: *"Every line came from the conversation."* Nothing here
 * is generated — the sections are read out of the draft the composer wrote, so the rail, the
 * markdown and the filed file cannot disagree.
 */
export function ComposerRail({
  state,
  ventureId,
  onFile,
  onChange,
  filing = false,
}: {
  state: RailState;
  ventureId: string;
  /** The one press. Absent while a reply is still streaming, so it is never offered over half a draft. */
  onFile?: () => void;
  onChange?: () => void;
  filing?: boolean;
}) {
  if (state.kind === 'plan') {
    // FB-127 already owns this state whole, including its own press. Wrapping it rather than
    // re-implementing it is what stops two "file" buttons behaving differently.
    return <div data-testid="rail-plan"><PlanPanel plan={state.plan} /></div>;
  }

  if (state.kind === 'filed') {
    return (
      <aside className="card" data-testid="rail-filed">
        <p className="eyebrow" style={{ marginTop: 0 }}>After you pressed it</p>
        <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.75rem' }}>
          <strong>Filed: {state.what}</strong>, waiting to be picked up.
        </p>
        <Step label="next">Your team picks it up and starts. You can watch it on the desk.</Step>
        <Step label="later">
          Finished work waits on you, and the desk says how much — nothing goes out without your OK.
        </Step>
        {state.href ? (
          <p style={{ margin: '0.75rem 0 0', fontSize: 'var(--fs-body-sm)' }}>
            <Link href={state.href} data-testid="rail-filed-link">See it in Tickets →</Link>
          </p>
        ) : null}
      </aside>
    );
  }

  if (state.kind === 'discussing') {
    return (
      <aside className="card" data-testid="rail-discussing">
        <p className="eyebrow" style={{ marginTop: 0 }}>The ticket under discussion</p>
        <p className="mono" style={{ fontSize: 'var(--fs-meta)', margin: 0 }}>{state.ticketId}</p>
        <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0.5rem 0 0.75rem' }}>
          What you agree here files as a revision your team picks up, and the ticket’s own history
          records this conversation as where it came from.
        </p>
        <p style={{ margin: 0, fontSize: 'var(--fs-body-sm)' }}>
          <Link
            href={`/venture/${ventureId}/tickets?t=${encodeURIComponent(`${ventureId}/${state.ticketId}`)}`}
            data-testid="rail-back-to-ticket"
          >
            ← Back to the ticket and its history
          </Link>
        </p>
      </aside>
    );
  }

  if (state.kind === 'empty') {
    return (
      <aside className="card muted" data-testid="rail-empty">
        <p className="eyebrow" style={{ marginTop: 0 }}>Nothing on the table</p>
        <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
          As you talk, the ticket takes shape here: every line from the conversation, nothing added
          beyond it.
        </p>
      </aside>
    );
  }

  const { draft } = state;
  return (
    <aside className="card" data-testid="rail-draft">
      <p className="eyebrow" style={{ marginTop: 0 }}>The ticket, taking shape</p>
      <h2 data-testid="rail-draft-title" style={{ fontSize: 'var(--fs-h4)', margin: '0 0 0.75rem' }}>
        {draft.title}
      </h2>

      {draft.why ? <Part label="Why">{draft.why}</Part> : null}

      {draft.scope.length ? (
        <Part label="Scope">
          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
            {draft.scope.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </Part>
      ) : null}

      {draft.doneWhen ? <Part label="Done when">{draft.doneWhen}</Part> : null}

      <Part label="Approval">
        You review the finished work before anything becomes part of your product. Nothing goes
        outside your company and nothing is spent.
      </Part>

      <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.75rem 0 0' }}>
        Every line came from the conversation. Press <strong>File this</strong> and it lands in
        Tickets, waiting to be picked up.
      </p>

      {onFile ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary" data-testid="rail-file" disabled={filing} onClick={onFile}>
            {filing ? 'Filing…' : 'File this'}
          </button>
          {onChange ? (
            <button type="button" className="btn" data-testid="rail-change" onClick={onChange}>
              Change something
            </button>
          ) : null}
          <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>Nothing is built until you press it.</span>
        </div>
      ) : null}
    </aside>
  );
}

function Part({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 0 0.7rem' }}>
      <p className="eyebrow" style={{ margin: '0 0 0.2rem' }}>{label}</p>
      <div style={{ fontSize: 'var(--fs-body-sm)' }}>{children}</div>
    </div>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p style={{ display: 'flex', gap: '0.6rem', margin: '0 0 0.35rem', fontSize: 'var(--fs-body-sm)' }}>
      <span className="eyebrow" style={{ flex: '0 0 2.6rem' }}>{label}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </p>
  );
}
