import { requireVenture } from '@/lib/venture-access';
import { buildTranscriber, MAX_AUDIO_BYTES, refuseAudio, TranscriptionError } from '@/lib/transcribe';
import { studioDatabase, withVenture } from '@/lib/db';
import { addSeconds, capRefusal, dailyLimitSeconds, secondsUsed, utcDay, type Querier } from '@/lib/voice-cap';

/**
 * Where today's count is kept (the daily cap, FB-173). The studio's database when it has one. The UI
 * gate's rig has none, and runs the test transcriber with the test sign-in, so it counts in memory.
 * Any other studio without a database cannot keep the count, and refuses rather than run uncapped.
 */
const rigCounts = new Map<string, number>();
type Usage = { used(day: string): Promise<number>; add(day: string, seconds: number): Promise<void> };
function usageFor(ventureId: string, env: Record<string, string | undefined> = process.env): Usage | null {
  if (studioDatabase(env)) {
    return {
      used: (day) => withVenture(ventureId, (c) => secondsUsed(c as unknown as Querier, day), env),
      add: (day, seconds) => withVenture(ventureId, (c) => addSeconds(c as unknown as Querier, day, seconds), env),
    };
  }
  if (env.E2E_TEST_LOGIN === '1' && env.TRANSCRIBER?.trim() === 'test-double') {
    return {
      used: async (day) => rigCounts.get(`${ventureId}|${day}`) ?? 0,
      add: async (day, seconds) => { rigCounts.set(`${ventureId}|${day}`, (rigCounts.get(`${ventureId}|${day}`) ?? 0) + Math.ceil(seconds)); },
    };
  }
  return null;
}

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
  // Refuse an oversized upload before reading it. `formData()` reads the whole body into memory, so
  // the size check on the recording itself (in `refuseAudio`) would come after the damage. The
  // allowance above the recording's own limit is for the form around it.
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + 64 * 1024) {
    return Response.json({ error: 'That recording is too long. Keep a voice note under about ten minutes.' }, { status: 413 });
  }
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

  // The daily cap, checked before anything is sent (John, 2026-10-02). Transcription is paid per
  // minute; without a place to keep the count there is no cap, so there are no voice notes.
  const usage = usageFor(ventureId);
  if (!usage) {
    return Response.json({ error: 'Voice notes are off: this studio has no database to keep the daily limit in.' }, { status: 503 });
  }
  const day = utcDay();
  let used: number;
  try {
    used = await usage.used(day);
  } catch (e) {
    console.error('[voice] could not read today\'s count', { venture: ventureId, message: (e as Error).message });
    return Response.json({ error: 'The studio could not check today\'s voice-note limit, so it did not send the recording. Your recording is still on this device — try again in a minute.' }, { status: 503 });
  }
  const capped = capRefusal(used, dailyLimitSeconds());
  if (capped) return Response.json({ error: capped, kind: 'capped' }, { status: 429 });

  try {
    const name = audio instanceof File && audio.name ? audio.name : 'voice-note.webm';
    const { text, seconds } = await transcriber.transcribe(file!, name);
    // Counted after the words come back, because that is what was billed. A failure to count is
    // logged, not shown: the founder has their words, and the next note re-reads the count.
    await usage.add(day, seconds).catch((e) => console.error('[voice] could not add to today\'s count', { venture: ventureId, message: (e as Error).message }));
    return Response.json({ text }, { status: 201 });
  } catch (e) {
    if (e instanceof TranscriptionError) {
      return Response.json({ error: e.message, kind: e.kind }, { status: e.kind === 'unavailable' ? 502 : 422 });
    }
    console.error('[voice] transcription failed', { venture: ventureId, message: (e as Error).message });
    return Response.json({ error: 'The studio could not transcribe that just now. Your recording is still on this device — try again in a minute.' }, { status: 500 });
  }
}
