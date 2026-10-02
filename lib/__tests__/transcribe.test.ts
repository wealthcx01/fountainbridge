import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { buildTranscriber, refuseAudio, voiceNotesOn, TranscriptionError } = await import('../transcribe');

/**
 * Turning a voice note into words (FB-173).
 *
 * The rules Grassmarket learned the hard way: one place picks the provider, an unknown provider is
 * refused, the test double is refused in production, and a transcript is never invented — an empty
 * answer is an error with a sentence, not an empty draft.
 */
const audio = () => new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3])], { type: 'audio/webm' });

describe('choosing the transcriber', () => {
  it('uses hosted Whisper when there is a key, and offers nothing without one', () => {
    expect(buildTranscriber({ OPENAI_API_KEY: 'sk-test' })?.name).toBe('openai-whisper');
    expect(buildTranscriber({})).toBeNull();
    expect(voiceNotesOn({})).toBe(false);
    expect(voiceNotesOn({ OPENAI_API_KEY: 'sk-test' })).toBe(true);
  });

  it('refuses a provider it does not know, rather than doing nothing', () => {
    expect(() => buildTranscriber({ TRANSCRIBER: 'whisperr', OPENAI_API_KEY: 'k' })).toThrow(/does not know/);
    expect(voiceNotesOn({ TRANSCRIBER: 'whisperr', OPENAI_API_KEY: 'k' })).toBe(false);
  });

  it('refuses the test double in production, whatever the settings say', () => {
    expect(() => buildTranscriber({ TRANSCRIBER: 'test-double', NODE_ENV: 'production' })).toThrow(/refused in production/);
    expect(buildTranscriber({ TRANSCRIBER: 'test-double', NODE_ENV: 'development' })?.name).toBe('test-double');
    // The browser-test rig only: a production build with the test sign-in switched on.
    expect(buildTranscriber({ TRANSCRIBER: 'test-double', NODE_ENV: 'production', E2E_TEST_LOGIN: '1' })?.name).toBe('test-double');
    expect(() => buildTranscriber({ TRANSCRIBER: 'test-double', NODE_ENV: 'production', E2E_TEST_LOGIN: '0' })).toThrow(/refused in production/);
  });
});

describe('asking Whisper', () => {
  const answering = (status: number, body: unknown) => vi.fn(async () => ({ ok: status < 300, status, json: async () => body }));

  it('sends the recording to whisper-1 with the key, and returns the words', async () => {
    const post = answering(200, { text: '  Make the deck share link expire after a week.  ' });
    const t = buildTranscriber({ OPENAI_API_KEY: 'sk-test' }, { fetch: post })!;
    expect((await t.transcribe(audio(), 'voice-note.webm')).text).toBe('Make the deck share link expire after a week.');
    const [url, init] = post.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: FormData }];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(init.body.get('model')).toBe('whisper-1');
    expect((init.body.get('file') as File).name).toBe('voice-note.webm');
  });

  it('reports the seconds the service billed, for the daily cap (John, 2026-10-02)', async () => {
    const post = answering(200, { text: 'A note.', duration: 83.4 });
    const t = buildTranscriber({ OPENAI_API_KEY: 'sk-test' }, { fetch: post })!;
    expect((await t.transcribe(audio(), 'a.webm')).seconds).toBe(83.4);
    // The duration only comes back when it is asked for.
    const [, init] = post.mock.calls[0] as unknown as [string, { body: FormData }];
    expect(init.body.get('response_format')).toBe('verbose_json');
  });

  it('charges a full minute when the service does not say how long it was', async () => {
    for (const duration of [undefined, null, 0, -5, 'long']) {
      const t = buildTranscriber({ OPENAI_API_KEY: 'sk-test' }, { fetch: answering(200, { text: 'A note.', duration }) })!;
      expect((await t.transcribe(audio(), 'a.webm')).seconds, String(duration)).toBe(60);
    }
  });

  it('never returns an empty transcript — it says the recording had no words', async () => {
    for (const body of [{ text: '' }, { text: '   ' }, {}, null]) {
      const t = buildTranscriber({ OPENAI_API_KEY: 'k' }, { fetch: answering(200, body) })!;
      const err = await t.transcribe(audio(), 'a.webm').catch((e) => e);
      expect(err).toBeInstanceOf(TranscriptionError);
      expect(err.kind).toBe('empty');
    }
  });

  it('tells a recording it cannot read apart from a service that is down', async () => {
    const bad = await buildTranscriber({ OPENAI_API_KEY: 'k' }, { fetch: answering(400, {}) })!.transcribe(audio(), 'a.webm').catch((e) => e);
    expect(bad.kind).toBe('refused');
    const down = await buildTranscriber({ OPENAI_API_KEY: 'k' }, { fetch: answering(503, {}) })!.transcribe(audio(), 'a.webm').catch((e) => e);
    expect(down.kind).toBe('unavailable');
    const offline = await buildTranscriber({ OPENAI_API_KEY: 'k' }, { fetch: vi.fn(async () => { throw new Error('ENOTFOUND'); }) })!
      .transcribe(audio(), 'a.webm').catch((e) => e);
    expect(offline.kind).toBe('unavailable');
  });
});

describe('what may be sent', () => {
  it('accepts what iPhones and other browsers really record', () => {
    expect(refuseAudio({ size: 40_000, type: 'audio/mp4' })).toBeNull(); // Safari on an iPhone
    expect(refuseAudio({ size: 40_000, type: 'audio/webm;codecs=opus' })).toBeNull(); // Chrome
    expect(refuseAudio({ size: 40_000, type: 'audio/ogg;codecs=opus' })).toBeNull(); // Firefox
  });

  it('refuses nothing, an empty recording, a huge one, and anything that is not audio', () => {
    expect(refuseAudio(null)?.status).toBe(400);
    expect(refuseAudio({ size: 0, type: 'audio/webm' })?.status).toBe(400);
    expect(refuseAudio({ size: 11 * 1024 * 1024, type: 'audio/webm' })?.status).toBe(413);
    expect(refuseAudio({ size: 10, type: 'text/html' })?.status).toBe(415);
    expect(refuseAudio({ size: 10, type: '' })?.status).toBe(415);
  });
});
