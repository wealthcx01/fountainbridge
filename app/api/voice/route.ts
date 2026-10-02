import { requireVenture } from '@/lib/venture-access';
import { buildTranscriber, refuseAudio, TranscriptionError } from '@/lib/transcribe';

/**
 * A voice note in, words out (FB-173).
 *
 * The browser posts the recording and the venture it belongs to. This checks the session can reach
 * that venture (CLAUDE.md #6), checks the recording is a recording, sends it to the transcriber, and
 * answers with the words. It **files nothing** and **keeps nothing**: the words go back into the
 * composer's box, and only the founder pressing the composer's own buttons turns them into work —
 * the same path a typed note takes.
 *
 * The audio is not stored here, or anywhere in the studio. The screen says so before a founder
 * presses record, and that sentence is only true while this handler keeps nothing.
 *
 * Behind the sign-in gate in `middleware.ts` like every other route; the venture check is the second
 * door, because a session can be valid and still not be this venture's.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'No recording arrived.' }, { status: 400 });
  }
  const ventureId = form.get('venture');
  if (typeof ventureId !== 'string') return Response.json({ error: 'No venture was named.' }, { status: 400 });
  const access = await requireVenture(ventureId);
  if (!access.ok) return Response.json({ error: access.error }, { status: 403 });

  const audio = form.get('audio');
  const file = audio instanceof Blob ? audio : null;
  const refused = refuseAudio(file);
  if (refused) return Response.json({ error: refused.message }, { status: refused.status });

  let transcriber;
  try {
    transcriber = buildTranscriber();
  } catch (e) {
    console.error('[voice] transcriber misconfigured', { message: (e as Error).message });
    return Response.json({ error: 'Voice notes are switched off on this studio until its settings are fixed.' }, { status: 503 });
  }
  if (!transcriber) {
    return Response.json({ error: 'Voice notes are not switched on for this studio yet.' }, { status: 503 });
  }

  try {
    const name = audio instanceof File && audio.name ? audio.name : 'voice-note.webm';
    const text = await transcriber.transcribe(file!, name);
    return Response.json({ text }, { status: 201 });
  } catch (e) {
    if (e instanceof TranscriptionError) {
      return Response.json({ error: e.message, kind: e.kind }, { status: e.kind === 'unavailable' ? 502 : 422 });
    }
    console.error('[voice] transcription failed', { venture: ventureId, message: (e as Error).message });
    return Response.json({ error: 'The studio could not transcribe that just now. Your recording is still on this device — try again in a minute.' }, { status: 500 });
  }
}
