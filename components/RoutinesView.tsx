'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideRoutine } from '@/app/actions/routines';
import { whyNotRunning, type Routine } from '@/lib/routines';
import { describeOutcome } from '@/lib/runreports';
import { toneColor, type Tone } from '@/lib/status';

/**
 * Routines, as a founder controls them (FB-047).
 *
 * The scheduler has been running since FB-040 and has been invisible the whole time: a founder could
 * not see what recurring work existed, could not stop it, and could not start it. This is that timer
 * turned into something with a name, a state, and two buttons.
 *
 * The row leads with what the founder must do — a proposed routine is waiting on them — and then
 * says, for everything else, *why it is not running right now*. "Nothing happening" and "paused by
 * you" and "ran an hour ago" look identical on a page that only shows a list.
 */

/** How often, said the way a person would. */
const CADENCE_LABEL: Record<Routine['cadence'], string> = {
  hourly: 'every hour',
  daily: 'every day',
  weekly: 'every week',
};

const STATE_LABEL: Record<Routine['state'], string> = {
  proposed: 'waiting for you',
  active: 'on',
  paused: 'paused',
};

/**
 * The shared tone vocabulary, not colours of this component's own (FB-057's contract).
 *
 * `proposed` is `attention` because it is a next step the founder must take; `paused` is `idle`
 * because nothing is happening and nobody needs to act.
 */
const STATE_TONE: Record<Routine['state'], Tone> = {
  proposed: 'attention',
  active: 'ok',
  paused: 'idle',
};

export function RoutinesView({
  ventureId,
  routines,
  errors = [],
}: {
  ventureId: string;
  routines: Routine[];
  errors?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const decide = (routine: Routine, decision: 'approve' | 'pause' | 'resume') => {
    setMessage(null);
    startTransition(async () => {
      const result = await decideRoutine(ventureId, routine.id, decision);
      setMessage({ ok: result.ok, text: result.message });
      // Re-read either way. On success the row is stale; on failure it is stale in a more
      // interesting way — something changed underneath, and the founder should see what.
      router.refresh();
    });
  };

  // `now` is read once per render rather than per row, so two routines in the same list cannot
  // disagree about whether a cooldown has passed.
  const now = new Date();

  return (
    <div className="stack" style={{ gap: '0.75rem' }}>
      {errors.length > 0 && (
        <p className="card" data-testid="routines-error">
          Some of this venture’s records could not be read, so this list may be incomplete:{' '}
          {errors.join(' ')}
        </p>
      )}

      {message && (
        <p className="card" data-testid="routine-message" style={{ margin: 0 }}>
          {message.text}
        </p>
      )}

      {routines.length === 0 ? (
        <p className="card muted" data-testid="routines-empty">
          No recurring work yet. When your team spots something worth doing on a schedule, it will
          suggest it here and wait for your OK.
        </p>
      ) : (
        routines.map((routine) => {
          const reason = whyNotRunning(routine, now);
          return (
            <div key={routine.id} className="card" data-testid={`routine-${routine.id}`}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                <strong>{routine.title}</strong>
                <span style={{ color: toneColor(STATE_TONE[routine.state]), fontSize: 'var(--fs-meta-lg)' }}>
                  {STATE_LABEL[routine.state]}
                </span>
                <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>
                  {CADENCE_LABEL[routine.cadence]}
                </span>
              </div>

              <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0' }}>
                {routine.standing_order}
              </p>

              <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.2rem 0' }}>
                Only when: {routine.criterion}
              </p>

              {/* What happened last time, in the founder's words — the half of a routine that tells
                  them whether it is worth keeping. */}
              {routine.last_run_at && (
                <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.2rem 0' }}>
                  Last time:{' '}
                  {routine.last_outcome ? describeOutcome(routine.last_outcome) : 'still going'}
                </p>
              )}

              {reason && (
                <p
                  className="muted"
                  data-testid={`routine-${routine.id}-why`}
                  style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.2rem 0' }}
                >
                  {reason}
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                {routine.state === 'proposed' && (
                  <button
                    type="button"
                    className="pill"
                    disabled={pending}
                    data-testid={`routine-${routine.id}-approve`}
                    onClick={() => decide(routine, 'approve')}
                  >
                    {pending ? 'Saving…' : 'Turn this on'}
                  </button>
                )}
                {routine.state === 'active' && (
                  <button
                    type="button"
                    className="pill"
                    disabled={pending}
                    data-testid={`routine-${routine.id}-pause`}
                    onClick={() => decide(routine, 'pause')}
                  >
                    {pending ? 'Saving…' : 'Pause'}
                  </button>
                )}
                {routine.state === 'paused' && (
                  <button
                    type="button"
                    className="pill"
                    disabled={pending}
                    data-testid={`routine-${routine.id}-resume`}
                    onClick={() => decide(routine, 'resume')}
                  >
                    {pending ? 'Saving…' : 'Turn back on'}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
