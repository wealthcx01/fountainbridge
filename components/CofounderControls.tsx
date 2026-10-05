'use client';

import { useState, useTransition } from 'react';
import { cofounderLookNow, releaseCofounder, saveCofounderSettings, setCofounderStop } from '@/app/actions/cofounder';
import { toneColor } from '@/lib/status';
import { LIMITS, type CofounderSettings } from '@/lib/cofounder';

type Result = { ok: boolean; message: string } | null;

function Said({ result, testId }: { result: Result; testId: string }) {
  if (!result) return null;
  return (
    <p
      data-testid={`${testId}-${result.ok ? 'done' : 'error'}`}
      style={{ fontSize: 'var(--fs-meta)', margin: '0.4rem 0 0', color: toneColor(result.ok ? 'ok' : 'blocked') }}
    >
      {result.message}
    </p>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

/**
 * One venture's dial (FB-201). Everything here makes the cofounder quieter, narrower or silent.
 * There is deliberately no box that lets it send, spend, merge, deploy or approve — the page above
 * says so in words.
 */
export function CofounderSettingsForm({ ventureId, ventureName, initial }: { ventureId: string; ventureName: string; initial: CofounderSettings }) {
  const [s, setS] = useState<CofounderSettings>(initial);
  const [quiet, setQuiet] = useState(initial.quietHours !== null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  const id = `cofounder-${ventureId}`;
  const set = (patch: Partial<CofounderSettings>) => { setS((x) => ({ ...x, ...patch })); setResult(null); };
  const q = s.quietHours ?? { from: 21, to: 8 };

  return (
    <form
      className="cofounder-form"
      data-testid={`${id}-form`}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await saveCofounderSettings(ventureId, { ...s, quietHours: quiet ? q : null })))
      }}
    >
      <label className="cofounder-check">
        <input type="checkbox" checked={s.on} onChange={(e) => set({ on: e.target.checked })} data-testid={`${id}-on`} />
        <span>On for {ventureName}</span>
      </label>

      <fieldset className="cofounder-group">
        <legend>When it wakes</legend>
        <label className="cofounder-field">
          <span>Every</span>
          <input
            type="number" className="cofounder-num" min={LIMITS.wakeEveryHours.min} max={LIMITS.wakeEveryHours.max}
            value={s.wakeEveryHours} onChange={(e) => set({ wakeEveryHours: Number(e.target.value) })}
            data-testid={`${id}-every`}
          />
          <span>hours</span>
        </label>
        <label className="cofounder-check">
          <input type="checkbox" checked={quiet} onChange={(e) => { setQuiet(e.target.checked); setResult(null); }} data-testid={`${id}-quiet`} />
          <span>Keep quiet at night (UK time)</span>
        </label>
        {quiet ? (
          <span className="cofounder-field">
            <span>from</span>
            <select value={q.from} onChange={(e) => set({ quietHours: { ...q, from: Number(e.target.value) } })} aria-label="Quiet from">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
            <span>until</span>
            <select value={q.to} onChange={(e) => set({ quietHours: { ...q, to: Number(e.target.value) } })} aria-label="Quiet until">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </span>
        ) : null}
      </fieldset>

      <fieldset className="cofounder-group">
        <legend>When one wake must stop</legend>
        <label className="cofounder-field">
          <span>After looking at</span>
          <input
            type="number" className="cofounder-num" min={LIMITS.maxIterations.min} max={LIMITS.maxIterations.max}
            value={s.maxIterations} onChange={(e) => set({ maxIterations: Number(e.target.value) })}
            data-testid={`${id}-iterations`}
          />
          <span>tickets</span>
        </label>
        <label className="cofounder-field">
          <span>Or after</span>
          <input
            type="number" className="cofounder-num" min={LIMITS.maxMinutes.min} max={LIMITS.maxMinutes.max}
            value={s.maxMinutes} onChange={(e) => set({ maxMinutes: Number(e.target.value) })}
            data-testid={`${id}-minutes`}
          />
          <span>minutes</span>
        </label>
      </fieldset>

      <fieldset className="cofounder-group">
        <legend>What it may read</legend>
        <label className="cofounder-check">
          <input type="checkbox" checked={s.reads.tickets} onChange={(e) => set({ reads: { ...s.reads, tickets: e.target.checked } })} />
          <span>Tickets</span>
        </label>
        <label className="cofounder-check">
          <input type="checkbox" checked={s.reads.runReports} onChange={(e) => set({ reads: { ...s.reads, runReports: e.target.checked } })} />
          <span>What the team did</span>
        </label>
      </fieldset>

      <fieldset className="cofounder-group">
        <legend>What it may propose</legend>
        <label className="cofounder-check">
          <input type="checkbox" checked={s.proposes.noteOnTicket} onChange={(e) => set({ proposes: { ...s.proposes, noteOnTicket: e.target.checked } })} />
          <span>Leave a note on a ticket</span>
        </label>
        <label className="cofounder-check">
          <input type="checkbox" checked={s.proposes.raiseForDecision} onChange={(e) => set({ proposes: { ...s.proposes, raiseForDecision: e.target.checked } })} data-testid={`${id}-raise`} />
          <span>Ask the founder to decide, and hold back until they do</span>
        </label>
      </fieldset>

      <span className="budget-row">
        <button type="submit" className="btn btn-primary" data-testid={`${id}-save`} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </span>
      <Said result={result} testId={`${id}-save`} />
    </form>
  );
}

function ActionButton({ label, busy, testId, primary, act }: { label: string; busy: string; testId: string; primary?: boolean; act: () => Promise<Result> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  return (
    <span className="cofounder-action">
      <button
        type="button"
        className={primary ? 'btn btn-primary' : 'btn'}
        data-testid={testId}
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await act()))}
      >
        {pending ? busy : label}
      </button>
      <Said result={result} testId={testId} />
    </span>
  );
}

/** The one switch that stops it for every venture at once. */
export function CofounderStopButton({ stopped }: { stopped: boolean }) {
  return stopped
    ? <ActionButton label="Lift the stop" busy="Lifting…" testId="cofounder-stop-lift" act={() => setCofounderStop(false)} />
    : <ActionButton label="Stop it for every venture" busy="Stopping…" testId="cofounder-stop" primary act={() => setCofounderStop(true)} />;
}

/** A person has decided, so it may look at this venture again. */
export function CofounderReleaseButton({ ventureId }: { ventureId: string }) {
  return <ActionButton label="Release it" busy="Releasing…" testId={`cofounder-${ventureId}-release`} primary act={() => releaseCofounder(ventureId)} />;
}

/** Wake it for this venture now, instead of waiting. Off, the stop, quiet hours and holding back still win. */
export function CofounderLookNowButton({ ventureId }: { ventureId: string }) {
  return <ActionButton label="Look now" busy="Looking…" testId={`cofounder-${ventureId}-look`} act={() => cofounderLookNow(ventureId)} />;
}
