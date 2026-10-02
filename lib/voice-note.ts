/**
 * The rules for a voice note, apart from the microphone (FB-173). Pure, so they can be tested.
 */

/**
 * What a founder reads before pressing record: where their voice goes, and whether it is kept.
 *
 * True only while `app/api/voice/route.ts` stores nothing — the recording is posted, transcribed and
 * dropped — and while `lib/recording.ts` lets go of it on this device once the words are back.
 */
export const WHERE_IT_GOES =
  'Your recording goes to OpenAI’s Whisper service to be turned into words, which land in the text '
  + 'box. The studio does not keep the recording: it stays on this device until the words are back, '
  + 'then it is deleted. OpenAI’s own terms decide what it keeps.';

/** Nothing is filed by speaking. Said beside the words, because it is the gate that matters. */
export const NOTHING_FILED = 'Nothing is filed until you press Send, then File — the same as typing.';

/**
 * Put the words where the founder can read them — after anything already typed, never over it.
 * A founder who typed half a thought and then spoke the rest must not lose the half they typed.
 */
export function appendTranscript(draft: string, text: string): string {
  const words = text.trim();
  if (!words) return draft;
  const before = draft.replace(/\s+$/, '');
  return before ? `${before}\n\n${words}` : words;
}

/**
 * What to do with a held recording after one upload attempt.
 *
 * - `done` — the words came back. Let the recording go.
 * - `drop` — the studio read it and cannot use it (no words in it, not a recording). Trying again
 *   would give the same answer, so it is let go — and the founder is told why, in words.
 * - `keep` — the network, the service or the studio failed. The recording is the one thing that
 *   cannot be made again, so it stays on this device and is offered again.
 */
export type UploadOutcome =
  | { kind: 'done'; text: string }
  | { kind: 'drop'; message: string }
  | { kind: 'keep'; message: string };

const KEPT = 'The recording did not reach the studio. It is saved on this device — press “Try again”, or come back later and it will be offered again.';

export function uploadOutcome(status: number | null, body: unknown): UploadOutcome {
  const b = (body && typeof body === 'object' ? body : {}) as { text?: unknown; error?: unknown };
  const said = typeof b.error === 'string' && b.error.trim() ? b.error : null;
  if (status === 201 && typeof b.text === 'string' && b.text.trim()) return { kind: 'done', text: b.text.trim() };
  if (status === null) return { kind: 'keep', message: KEPT };
  // 201 with no words is the one answer that must never become an empty draft.
  if (status === 201) return { kind: 'drop', message: 'The recording came back with no words in it. Try again, and watch the meter move as you speak.' };
  if (status === 408 || status === 429 || status >= 500) return { kind: 'keep', message: said ? `${said}` : KEPT };
  // 401/403: signed out or not this venture's — keep it; signing back in makes it sendable again.
  if (status === 401 || status === 403) return { kind: 'keep', message: said ?? 'You need to sign in again. The recording is saved on this device.' };
  return { kind: 'drop', message: said ?? 'The studio could not use that recording. Try recording it again.' };
}

/** "1:07" — the elapsed time beside the meter. */
export const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** A voice note is a few minutes. Past this, recording stops on its own and the note is sent. */
export const MAX_SECONDS = 5 * 60;
