'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { acceptWork, sendBackWork, type AcceptResult } from '@/app/actions/work';
import { noteDecision } from '@/lib/decided';
import { toneColor } from '@/lib/status';
import { Mark } from './Mark';

/**
 * Accept and Send back: the decision on a piece of work, drawn once (FB-273).
 *
 * The same two buttons were written out three times, on the work page (`WorkDetail.tsx`), the
 * Tickets screen (`TicketsView.tsx`) and the ticket drawer (`TicketDrawer.tsx`). Each called
 * `acceptWork` and `sendBackWork` its own way, and the Review screen (FB-274) and the factory's
 * cards (FB-277) would have made five. Now every screen draws this component, and every press goes
 * through `press` below: the server action, then `noteDecision`, then a result that says which of
 * the two was pressed.
 *
 * ## Why each screen keeps its own words
 *
 * The three screens say it differently today ("Accept this work", "Make it part of my product") and
 * lay it out differently. FB-273 changed no words and no layout, so each screen picks its `look`,
 * and the look decides only the words, the test ids and where things sit. What a press does is the
 * same for all of them.
 *
 * ## What a founder's Accept says
 *
 * Since FB-272 a founder's Accept is their sign-off and merges nothing. The server says so with
 * `signedOff: true`, and every look shows "signed off" rather than "accepted" when it is set.
 */

/** Which of the two buttons was pressed. */
export type Decided = 'accept' | 'send-back';

/** What the server said, and which button it answered. */
export interface DecisionResult extends AcceptResult {
  decided: Decided;
}

/** The piece of work being decided. `headSha` is the commit the founder was shown, when there is one. */
export interface DecisionWork {
  repo: string;
  number: number;
  headSha?: string | null;
}

/**
 * Press one of the two buttons. The only place any screen calls `acceptWork` or `sendBackWork`.
 *
 * A press that went through counts as a decision (`noteDecision`, FB-141), whichever screen it was on.
 */
export async function press(ventureId: string, work: DecisionWork, decided: Decided, note = ''): Promise<DecisionResult> {
  const r = decided === 'accept'
    // The commit they were shown, when the screen showed one. `acceptWork` refuses if something
    // has been pushed since, so nobody accepts a change that landed after they looked.
    ? noteDecision(await acceptWork(ventureId, work.repo, work.number, work.headSha ?? undefined))
    : noteDecision(await sendBackWork(ventureId, work.repo, work.number, note));
  return { ...r, decided };
}

/**
 * What the Tickets screen says once a decision went through. Its heading and its sentence.
 *
 * Kept here, beside the buttons, so the words for "what happened" live in one file with the words
 * for "what to press".
 */
export function decisionOutcome(result: DecisionResult): { heading: string; text: string } {
  if (result.decided === 'send-back') {
    return {
      heading: 'Sent back with your note',
      text: 'Nothing went out. Your team re-opens it, reads your note, and comes back with a revision.',
    };
  }
  // FB-272: a founder's yes is their sign-off; only John's merges.
  return { heading: result.signedOff ? 'Signed off, waiting for John' : 'Approved and verified', text: result.message };
}

/**
 * The label on the work page once it is decided.
 *
 * FB-281: a Send back also says "accepted" here today. That is kept as it is for now (FB-273 changes
 * no words); `result.decided` is what the fix reads.
 */
function stateLabel(result: DecisionResult | null): string {
  return result?.signedOff ? 'signed off' : 'accepted';
}

type Look = 'work' | 'tickets' | 'drawer';

export function Decision({
  look,
  ventureId,
  work,
  merged = false,
  blocked = null,
  suggestion = null,
  onDecided,
}: {
  /** Which screen this is on. Sets the words, the test ids and the layout; never what a press does. */
  look: Look;
  ventureId: string;
  work: DecisionWork;
  /** Work page: the work is already part of the product, so there is nothing left to press. */
  merged?: boolean;
  /** Work page: why it cannot be accepted yet, drawn where the Accept button would be. */
  blocked?: ReactNode;
  /** Work page: a first line of the note, already written, for when the page named what to ask. */
  suggestion?: string | null;
  /** Called once a press has gone through. The Tickets screen shows its outcome from this. */
  onDecided?: (result: DecisionResult) => void;
}) {
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(suggestion ?? '');
  const [pending, startTransition] = useTransition();
  // Which button is waiting on the server. The work page shows "Accepting…" only on Accept and
  // "Sending…" only on Send, so it needs to know which; the other two screens do not ask.
  const [pressing, setPressing] = useState<Decided | null>(null);

  const go = (decided: Decided) => {
    setPressing(decided);
    startTransition(async () => {
      setError(null);
      const r = await press(ventureId, work, decided, note);
      setResult(r);
      if (r.ok) onDecided?.(r);
      else setError(r.message);
    });
  };
  const busy = (decided: Decided) => pending && pressing === decided;

  if (look === 'work') {
    // Same shape as the approve card, on purpose: one pattern for agreeing to something.
    const done = result?.ok || merged;
    return (
      <div data-testid="work-decision"
           style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {done ? (
          // FB-272: a founder's Accept is their sign-off and merges nothing, so it must not say
          // "accepted" as if the work were already part of the product.
          <span className="tag tag-accent" data-testid="work-state">{stateLabel(result)}</span>
        ) : (
          <>
            {blocked ?? (
              <button
                type="button"
                className="btn btn-primary"
                data-testid="work-accept"
                disabled={busy('accept')}
                onClick={() => go('accept')}
              >
                {busy('accept') ? 'Accepting…' : 'Accept this work'}
              </button>
            )}
            {noteOpen ? (
              <div style={{ width: '100%', maxWidth: 'var(--content-narrow)' }}>
                <NoteBox id="work-note" label="What needs changing? Your team reads this on its next wake." note={note} setNote={setNote} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="work-sendback"
                    disabled={busy('send-back') || !note.trim()}
                    onClick={() => go('send-back')}
                  >
                    {busy('send-back') ? 'Sending…' : 'Send this back'}
                  </button>
                  <button type="button" className="btn" data-testid="work-sendback-cancel" onClick={() => setNoteOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn" data-testid="work-sendback-open" onClick={() => setNoteOpen(true)}>
                Send it back with a note
              </button>
            )}
          </>
        )}
        {result ? (
          <span
            data-testid="work-msg"
            style={{ fontSize: 'var(--fs-body-sm)', color: result.ok ? undefined : toneColor('attention') }}
          >
            {result.message}
          </span>
        ) : null}
      </div>
    );
  }

  if (look === 'tickets') {
    // A press that went through hands the screen its outcome and this is drawn no more. What stays
    // here is the press that did not: its reason, above the buttons.
    return (
      <>
        {error ? (
          <p data-testid="detail-error" style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention') }}>
            <Mark />{error}
          </p>
        ) : null}

        {noteOpen ? (
          <div>
            <NoteBox id="detail-note" label="What should change? Your team reads this." note={note} setNote={setNote} roomy />
            <p style={{ margin: '0.6rem 0 0', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="detail-send-back"
                disabled={pending || !note.trim()}
                onClick={() => go('send-back')}
              >
                Send it back
              </button>
              <button type="button" className="btn" data-testid="detail-never-mind" onClick={() => { setNoteOpen(false); setNote(''); }}>
                Never mind
              </button>
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="detail-approve"
              disabled={pending}
              onClick={() => go('accept')}
            >
              {pending ? 'Working…' : 'Make it part of my product'}
            </button>
            <button type="button" className="btn" data-testid="detail-refuse" onClick={() => setNoteOpen(true)}>
              Refuse, and say why
            </button>
          </p>
        )}
      </>
    );
  }

  // The drawer. It reads the ask, not the work, so it has no commit to bind an Accept to; the
  // server still re-reads the work and decides against what is true now.
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="drawer-accept"
          disabled={pending || result?.ok}
          onClick={() => go('accept')}
        >
          {pending ? 'Working…' : 'Accept this work'}
        </button>
        <button type="button" className="btn" data-testid="drawer-sendback-open" onClick={() => setNoteOpen((v) => !v)}>
          Send it back with a note
        </button>
      </div>
      {noteOpen ? (
        <div style={{ marginTop: '0.5rem' }}>
          <NoteBox id="drawer-note" label="What needs changing? Your team reads this on its next wake." note={note} setNote={setNote} />
          <button
            type="button"
            className="btn btn-primary"
            data-testid="drawer-sendback"
            disabled={pending || !note.trim()}
            style={{ marginTop: '0.4rem' }}
            onClick={() => go('send-back')}
          >
            {pending ? 'Sending…' : 'Send this back'}
          </button>
        </div>
      ) : null}
      {result ? (
        <p data-testid="drawer-msg"
           style={{ fontSize: 'var(--fs-body-sm)', marginTop: '0.5rem',
                    color: result.ok ? undefined : toneColor('attention') }}>
          {result.message}
        </p>
      ) : null}
    </>
  );
}

/** The note for Send back: its question and the box to answer it in. `roomy` is the Tickets screen's. */
function NoteBox({
  id, label, note, setNote, roomy = false,
}: {
  id: string;
  label: string;
  note: string;
  setNote: (note: string) => void;
  roomy?: boolean;
}) {
  return (
    <>
      <label htmlFor={id} style={{ fontSize: 'var(--fs-body-sm)', display: 'block', marginBottom: '0.3rem' }}>
        {label}
      </label>
      <textarea
        id={id}
        data-testid={id}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        style={roomy
          ? {
              width: '100%', maxWidth: 'var(--content-narrow)', padding: '0.6rem', fontFamily: 'inherit',
              fontSize: 'var(--fs-body-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-paper-raised)', color: 'var(--color-ink)',
            }
          : { width: '100%', fontFamily: 'inherit', fontSize: 'var(--fs-body-sm)', padding: '0.5rem',
              border: '1px solid var(--color-border)' }}
      />
    </>
  );
}
