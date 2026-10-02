import 'server-only';

/**
 * Turning a founder's voice note into words (FB-173).
 *
 * ## One port, one place that picks the provider
 *
 * `buildTranscriber(env)` is the only way to get a transcriber. It reads `TRANSCRIBER` (default
 * `openai-whisper`) and refuses anything it does not know, at the moment it is asked — a typo in the
 * deployment's settings is an error a person can read, not a feature that silently does nothing.
 *
 * ## Why hosted Whisper
 *
 * Grassmarket argued this and settled it on 2026-09-02, by founder direction: `whisper-1` is its
 * production transcriber, and the browser's own speech recognition was rejected on quality and on
 * browser coverage (it is missing or unreliable on exactly the iPhone this feature is for). There is
 * no reason for two answers in one company.
 *
 * ## Never fabricate a transcript
 *
 * Grassmarket's scar: an offline transcriber decoded audio bytes as text, and a real recording came
 * back as replacement characters that were stored and shown as a meeting's transcript. So:
 *
 * - the test double is refused in production, by the builder, whatever the settings say;
 * - a transcript that comes back empty is an error with a sentence, never an empty draft;
 * - nothing here ever turns audio bytes into text itself.
 */

export interface Transcriber {
  /** Shown nowhere; recorded in logs so a reading can say which provider produced it. */
  name: string;
  transcribe(audio: Blob, filename: string): Promise<string>;
}

/** A failure a founder can be told about, in words. */
export class TranscriptionError extends Error {
  constructor(
    message: string,
    /** What kind of failure, so the screen can say which. */
    readonly kind: 'empty' | 'refused' | 'unavailable',
  ) {
    super(message);
  }
}

export const PROVIDERS = ['openai-whisper', 'test-double'] as const;
export type ProviderKey = (typeof PROVIDERS)[number];

type Fetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: FormData; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * The transcriber this studio is configured for, or `null` when it has no key — then the studio does
 * not offer to record at all, rather than recording something it cannot transcribe.
 *
 * Throws on a configuration that is wrong rather than merely absent: an unknown provider, or the test
 * double in production.
 */
export function buildTranscriber(
  env: Record<string, string | undefined> = process.env,
  opts: { fetch?: Fetch } = {},
): Transcriber | null {
  const key = (env.TRANSCRIBER?.trim() || 'openai-whisper') as ProviderKey;
  if (!PROVIDERS.includes(key)) {
    throw new Error(`TRANSCRIBER is set to ${JSON.stringify(key)}, which this studio does not know. Use one of: ${PROVIDERS.join(', ')}.`);
  }
  if (key === 'test-double') {
    // The one exception is the UI gate's rig, which runs a production build with the test sign-in
    // switched on. A studio with E2E_TEST_LOGIN lets anyone sign in as anyone, so it is never a real
    // studio, and its browser test can then press record without sending audio anywhere.
    if (env.NODE_ENV === 'production' && env.E2E_TEST_LOGIN !== '1') {
      throw new Error('TRANSCRIBER=test-double is refused in production: it returns a fixed sentence, not what was said.');
    }
    return testDouble;
  }
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return openAiWhisper(apiKey, opts.fetch ?? (fetch as unknown as Fetch));
}

/** Whether the composer offers to record. A misconfigured studio offers nothing rather than failing later. */
export function voiceNotesOn(env: Record<string, string | undefined> = process.env): boolean {
  try {
    return buildTranscriber(env) !== null;
  } catch {
    return false;
  }
}

/** For local work and tests only. Its words say what it is, so it can never pass for a real note. */
const testDouble: Transcriber = {
  name: 'test-double',
  async transcribe() {
    return 'This is the test transcriber, not a real transcript.';
  },
};

function openAiWhisper(apiKey: string, post: Fetch): Transcriber {
  return {
    name: 'openai-whisper',
    async transcribe(audio, filename) {
      const form = new FormData();
      form.append('file', audio, filename);
      form.append('model', 'whisper-1');
      form.append('response_format', 'json');
      let res: Awaited<ReturnType<Fetch>>;
      try {
        res = await post('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          // A two-minute note takes seconds; a minute is generous, and a founder is waiting.
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        throw new TranscriptionError('The transcription service could not be reached. Your recording is still on this device — try again in a minute.', 'unavailable');
      }
      if (!res.ok) {
        // 400 is the audio itself (too short, a format it will not read); anything else is the
        // service. The founder needs to know which, because only one of them is worth retrying.
        if (res.status === 400) {
          throw new TranscriptionError('The transcription service could not read that recording. Try recording it again.', 'refused');
        }
        throw new TranscriptionError(`The transcription service answered with an error (${res.status}). Your recording is still on this device — try again in a minute.`, 'unavailable');
      }
      const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
      const text = typeof body?.text === 'string' ? body.text.trim() : '';
      if (!text) {
        throw new TranscriptionError('The recording came back with no words in it. Check the microphone is the right one and try again — the meter should move while you speak.', 'empty');
      }
      return text;
    },
  };
}

/** What the browser may send. Whisper reads all of these; anything else is refused before it is sent. */
export const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'] as const;

/** Whisper's own limit is 25 MB; a note is a few minutes, which is well under 10 MB in every format. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Check an upload before anything is sent anywhere. Returns a sentence when it must be refused. */
export function refuseAudio(file: { size: number; type: string } | null): { status: number; message: string } | null {
  if (!file) return { status: 400, message: 'No recording arrived.' };
  if (file.size === 0) return { status: 400, message: 'The recording was empty — nothing was captured.' };
  if (file.size > MAX_AUDIO_BYTES) return { status: 413, message: 'That recording is too long. Keep a voice note under about ten minutes.' };
  const base = file.type.split(';')[0].trim().toLowerCase();
  if (!(AUDIO_TYPES as readonly string[]).includes(base)) {
    return { status: 415, message: 'That is not a recording this studio can transcribe.' };
  }
  return null;
}
