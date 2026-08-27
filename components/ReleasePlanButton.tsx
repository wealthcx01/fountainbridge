'use client';

import { useState, useTransition } from 'react';
import { releasePlan } from '@/app/actions/release-plan';
import { toneColor } from '@/lib/status';

/**
 * The way out of the sensitive gate (FB-122).
 *
 * When the lane meets a ticket that looks high-impact it writes a plan, shows it, and stops. Until
 * this control existed there was nothing anywhere that could let it continue — not the studio, not a
 * command, not editing the ticket. A plan the lane paused to show someone could be read and never
 * answered.
 *
 * Deliberately not called "Approve". Approve is the word this product uses for the gate on things
 * that leave the building, which is signed and verified and means something much stronger. This
 * releases a lane to *start*, and every real check still happens afterwards — the pull request is
 * still reviewed, and anything external still needs the signed approval. Using the same word for
 * both would flatten that difference exactly where a founder needs to feel it.
 */
export function ReleasePlanButton({
  ventureId,
  repo,
  ticket,
  testId,
}: {
  ventureId: string;
  repo: string;
  ticket: string;
  testId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Once released, the button is gone rather than disabled-and-lying: a second press does nothing
  // useful, and a control that stays put after it has worked reads as one that did not.
  if (result?.ok) {
    return (
      <p
        className="muted"
        data-testid={`${testId}-released`}
        style={{ fontSize: 'var(--fs-meta)', margin: '0.4rem 0 0', color: toneColor('ok') }}
      >
        {result.message}
      </p>
    );
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        className="btn"
        data-testid={testId}
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            setResult(await releasePlan(ventureId, repo, ticket));
          });
        }}
      >
        {pending ? 'Telling your team…' : 'Go ahead with this'}
      </button>
      {result && !result.ok ? (
        <p
          data-testid={`${testId}-error`}
          style={{ fontSize: 'var(--fs-meta)', margin: '0.4rem 0 0', color: toneColor('blocked') }}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
