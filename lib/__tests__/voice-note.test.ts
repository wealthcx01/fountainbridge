import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendTranscript, clock, uploadOutcome, WHERE_IT_GOES } from '../voice-note';

/**
 * The rules of a voice note that are not the microphone (FB-173).
 */
describe('the words go into the box, never over what was typed', () => {
  it('appends after a typed half-thought, and fills an empty box', () => {
    expect(appendTranscript('', 'Make the link expire.')).toBe('Make the link expire.');
    expect(appendTranscript('About ARCA-5: ', 'make the link expire.')).toBe('About ARCA-5:\n\nmake the link expire.');
    expect(appendTranscript('typed', '   ')).toBe('typed');
  });
});

describe('a recording is let go only when it is no longer needed', () => {
  it('lets go once the words came back', () => {
    expect(uploadOutcome(201, { text: 'Hello' })).toEqual({ kind: 'done', text: 'Hello' });
  });

  it('keeps it when the network, the service or the studio failed — it cannot be spoken again', () => {
    expect(uploadOutcome(null, null).kind).toBe('keep'); // no signal
    expect(uploadOutcome(502, { error: 'The transcription service could not be reached.' })).toEqual({
      kind: 'keep', message: 'The transcription service could not be reached.',
    });
    expect(uploadOutcome(503, {}).kind).toBe('keep');
    expect(uploadOutcome(429, {}).kind).toBe('keep');
    expect(uploadOutcome(403, {}).kind).toBe('keep'); // signed out: sign back in and it can go
  });

  it('keeps it when the sign-in has run out, and says so rather than blaming the recording', () => {
    // An expired sign-in is answered by the gate with a redirect to the login page, not with 401.
    // The browser is told not to follow it, so it arrives as status 0.
    const expired = uploadOutcome(0, null);
    expect(expired.kind).toBe('keep');
    expect(expired.kind === 'keep' && expired.message).toMatch(/sign in again/);
    expect(uploadOutcome(401, null).kind).toBe('keep');
  });

  it('keeps it on any answer it does not recognise — a login page, a missing route, a bad request', () => {
    expect(uploadOutcome(200, null).kind).toBe('keep'); // the login page, if a redirect was followed
    expect(uploadOutcome(307, null).kind).toBe('keep');
    expect(uploadOutcome(404, null).kind).toBe('keep');
    expect(uploadOutcome(405, null).kind).toBe('keep');
    expect(uploadOutcome(400, { error: 'No recording arrived.' }).kind).toBe('keep');
    expect(uploadOutcome(413, {}).kind).toBe('keep');
  });

  it('never turns an empty answer into an empty draft', () => {
    expect(uploadOutcome(201, { text: '' }).kind).toBe('drop');
    expect(uploadOutcome(201, {}).kind).toBe('drop');
  });

  it('lets go of a recording the studio read and cannot use, and says why', () => {
    expect(uploadOutcome(422, { error: 'The recording came back with no words in it.' })).toEqual({
      kind: 'drop', message: 'The recording came back with no words in it.',
    });
    expect(uploadOutcome(415, {}).kind).toBe('drop');
  });
});

describe('what the founder is told before they speak is true', () => {
  it('says where the audio goes and that the studio does not keep it', () => {
    expect(WHERE_IT_GOES).toMatch(/OpenAI/);
    expect(WHERE_IT_GOES).toMatch(/does not keep the recording/);
  });

  // That the voice route keeps nothing is checked by behaviour, not by reading its source:
  // `app/api/voice/__tests__/route.test.ts`, "the studio keeps nothing it was given", makes every
  // store live and watches each one while a note goes through.

  it('the composer offers recording only beside its own Send, so speaking cannot file anything', () => {
    const composer = readFileSync(join(process.cwd(), 'components/Composer.tsx'), 'utf8');
    const voice = readFileSync(join(process.cwd(), 'components/VoiceNote.tsx'), 'utf8');
    // The voice component reaches the composer only through `onWords`, which appends to the draft.
    expect(composer).toMatch(/onWords=\{\(text\) => \{ setDraft\(\(d\) => appendTranscript\(d, text\)\)/);
    expect(voice).not.toMatch(/send\(fileThisMessage|filePlan|fileTicket/);
  });
});

describe('the clock', () => {
  it('reads like a clock', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(67)).toBe('1:07');
  });
});
