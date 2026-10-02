'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extensionFor, holdNote, pendingNotes, releaseNote, startRecording, type PendingNote, type RecorderHandle } from '@/lib/recording';
import { MAX_SECONDS, NOTHING_FILED, WHERE_IT_GOES, clock, uploadOutcome } from '@/lib/voice-note';

/**
 * Leave a voice note in the composer (FB-173).
 *
 * One button to start, one to stop. While recording, a meter moves with the founder's voice and a
 * clock counts up. When they stop, the recording is held on this device, sent to be transcribed, and
 * the words are put into the composer's box — **after** anything already typed. Nothing is filed:
 * the founder reads the words and presses the composer's own Send, the same path as typing.
 *
 * Every failure says which one it is (CLAUDE.md #10) — no microphone, no network, no words came back —
 * and the text box keeps working throughout, because this component never touches it except to add
 * words to the end.
 */
type State =
  | { kind: 'idle' }
  | { kind: 'recording'; seconds: number; level: number }
  | { kind: 'sending' }
  | { kind: 'failed'; message: string; held: PendingNote | null };

export function VoiceNote({ ventureId, onWords, disabled }: {
  ventureId: string;
  onWords: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [waiting, setWaiting] = useState<PendingNote[]>([]);
  const handle = useRef<RecorderHandle | null>(null);

  // A recording from earlier that never arrived — the one bar of signal on the walk home.
  useEffect(() => {
    void pendingNotes(ventureId).then(setWaiting);
  }, [ventureId]);

  const send = useCallback(async (note: PendingNote) => {
    setState({ kind: 'sending' });
    const form = new FormData();
    form.append('venture', ventureId);
    form.append('audio', note.blob, `voice-note.${extensionFor(note.mimeType)}`);
    let status: number | null = null;
    let body: unknown = null;
    try {
      const res = await fetch('/api/voice', { method: 'POST', body: form });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch { /* the network: status stays null, and the note is kept */ }
    const out = uploadOutcome(status, body);
    if (out.kind === 'done') {
      await releaseNote(note.id).catch(() => undefined);
      onWords(out.text);
      setState({ kind: 'idle' });
    } else if (out.kind === 'drop') {
      await releaseNote(note.id).catch(() => undefined);
      setState({ kind: 'failed', message: out.message, held: null });
    } else {
      setState({ kind: 'failed', message: out.message, held: note });
    }
    setWaiting(await pendingNotes(ventureId));
  }, [ventureId, onWords]);

  const stop = useCallback(async () => {
    const h = handle.current;
    handle.current = null;
    if (!h) return;
    try {
      const { blob, mimeType, seconds } = await h.stop();
      const note: PendingNote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ventureId, blob, mimeType, seconds, recordedAt: new Date().toISOString(),
      };
      // Held BEFORE it is sent. If this throws (a private window), it is still sent — just without
      // the safety net — rather than refusing to transcribe a note the founder has already spoken.
      await holdNote(note).catch(() => undefined);
      await send(note);
    } catch (e) {
      setState({ kind: 'failed', message: (e as Error).message, held: null });
    }
  }, [send, ventureId]);

  const start = async () => {
    try {
      handle.current = await startRecording({
        level: (level) => setState((s) => (s.kind === 'recording' ? { ...s, level } : s)),
        elapsed: (seconds) => setState((s) => (s.kind === 'recording' ? { ...s, seconds } : s)),
      });
      setState({ kind: 'recording', seconds: 0, level: 0 });
    } catch (e) {
      setState({ kind: 'failed', message: (e as Error).message, held: null });
    }
  };

  // A note left running sends itself at the limit rather than recording a pocket for an hour.
  useEffect(() => {
    if (state.kind === 'recording' && state.seconds >= MAX_SECONDS) void stop();
  }, [state, stop]);

  // Leaving the page releases the microphone.
  useEffect(() => () => handle.current?.cancel(), []);

  const earlier = waiting.filter((n) => !(state.kind === 'failed' && state.held?.id === n.id));

  return (
    <div className="voice-note" data-testid="voice-note">
      {state.kind === 'recording' ? (
        <div className="voice-recording" role="group" aria-label="Recording a voice note">
          <span className="voice-meter" aria-hidden="true" data-testid="voice-meter">
            <span style={{ width: `${Math.max(state.level, 0) * 100}%` }} />
          </span>
          <span className="voice-clock" aria-live="off">{clock(state.seconds)}</span>
          {state.level < 0 ? <span className="muted">This browser shows no meter, but it is recording.</span> : null}
          <button type="button" className="btn btn-primary" data-testid="voice-stop" onClick={() => void stop()}>
            Stop and use it
          </button>
          <button type="button" className="btn" data-testid="voice-cancel" onClick={() => { handle.current?.cancel(); handle.current = null; setState({ kind: 'idle' }); }}>
            Throw it away
          </button>
        </div>
      ) : (
        <p className="voice-row">
          <button
            type="button"
            className="btn"
            data-testid="voice-start"
            disabled={disabled || state.kind === 'sending'}
            onClick={() => void start()}
          >
            {state.kind === 'sending' ? 'Turning it into words…' : 'Record a voice note'}
          </button>
        </p>
      )}

      {state.kind === 'idle' || state.kind === 'recording' ? (
        <p className="voice-where muted" data-testid="voice-where">{WHERE_IT_GOES} {NOTHING_FILED}</p>
      ) : null}

      {state.kind === 'failed' ? (
        <p className="voice-failed" role="alert" data-testid="voice-failed">
          {state.message}
          {state.held ? (
            <>
              {' '}
              <button type="button" className="btn" data-testid="voice-retry" onClick={() => void send(state.held!)}>Try again</button>
              <button type="button" className="btn" data-testid="voice-discard" onClick={() => {
                void releaseNote(state.held!.id).then(() => pendingNotes(ventureId)).then(setWaiting);
                setState({ kind: 'idle' });
              }}>Throw it away</button>
            </>
          ) : null}
        </p>
      ) : null}

      {earlier.length > 0 && state.kind !== 'recording' && state.kind !== 'sending' ? (
        <p className="voice-earlier" data-testid="voice-earlier">
          {earlier.length === 1
            ? `A voice note from earlier (${clock(earlier[0].seconds)}) did not reach the studio. It is saved on this device.`
            : `${earlier.length} voice notes from earlier did not reach the studio. They are saved on this device.`}
          {' '}
          <button type="button" className="btn" data-testid="voice-send-earlier" onClick={() => void send(earlier[0])}>Send it now</button>
          <button type="button" className="btn" data-testid="voice-drop-earlier" onClick={() => {
            void releaseNote(earlier[0].id).then(() => pendingNotes(ventureId)).then(setWaiting);
          }}>Throw it away</button>
        </p>
      ) : null}
    </div>
  );
}
