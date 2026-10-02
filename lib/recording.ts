/**
 * Recording a voice note in the browser, and holding it until the studio has it (FB-173).
 *
 * Adapted from Grassmarket's `frontend/lib/recording.ts`, which is live and whose comments carry the
 * scars. Two jobs, kept out of the component:
 *
 * 1. **Capture**, with a live level meter. The meter is not decoration: a recording of silence — a
 *    muted microphone, a phone that handed the browser the wrong input — looks exactly like a good
 *    one until it comes back empty, and by then the thought is gone. A moving meter is the only proof
 *    a founder gets that their voice is reaching us.
 * 2. **Holding.** The recording goes into this device's IndexedDB the moment it stops, and is let go
 *    only when the studio answers 201. A founder walking home at 22:00 with one bar of signal loses
 *    nothing: a failed upload stays here and is offered again next time the composer opens.
 *
 * Nothing here talks to the network. Holding is per device, by design: it is a recording that has not
 * arrived yet, not a record of anything.
 */

/** Safari on an iPhone records `audio/mp4` and nothing else; Chrome and Firefox record WebM. */
const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of PREFERRED_MIME_TYPES) if (MediaRecorder.isTypeSupported(type)) return type;
  return ''; // let the browser choose, and read back what it chose
}

export function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export const NO_MICROPHONE = 'The studio could not use a microphone. Check this browser is allowed to use it, then try again. You can still type below.';
export const CANNOT_RECORD = 'This browser cannot record audio. Try Safari, Chrome or Firefox — or type below.';

export interface RecorderHandle {
  stop: () => Promise<{ blob: Blob; mimeType: string; seconds: number }>;
  cancel: () => void;
}

export async function startRecording(on: { level: (l: number) => void; elapsed: (s: number) => void }): Promise<RecorderHandle> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new Error(CANNOT_RECORD);
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error(NO_MICROPHONE);
  }
  const mimeType = pickMimeType();
  if (mimeType === null) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(CANNOT_RECORD);
  }
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    // Release the microphone: otherwise the phone's recording light stays on with nothing recording.
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(CANNOT_RECORD);
  }
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (e) => { if (e.data.size > 0) chunks.push(e.data); });

  // A stopwatch: both ends are read from this browser's own clock, so they cannot disagree.
  const startedAt = Date.now(); // one-clock: stopwatch
  let stopped = false;
  let audio: AudioContext | null = null;
  let frame = 0;
  try {
    audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 512;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const read = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) { const c = (s - 128) / 128; sum += c * c; }
      on.level(Math.min(1, Math.sqrt(sum / samples.length) * 3));
      frame = requestAnimationFrame(read);
    };
    frame = requestAnimationFrame(read);
  } catch {
    // No meter is not no recording — but say so rather than draw a flat bar that reads as silence.
    on.level(-1);
  }
  const ticker = window.setInterval(
    () => on.elapsed(Math.floor((Date.now() - startedAt) / 1000)), // one-clock: stopwatch
    1000,
  );

  const teardown = () => {
    stopped = true;
    if (frame) cancelAnimationFrame(frame);
    window.clearInterval(ticker);
    stream.getTracks().forEach((t) => t.stop());
    audio?.close().catch(() => undefined);
  };

  recorder.start(1000);
  return {
    stop: () => new Promise((resolve, reject) => {
      recorder.addEventListener('stop', () => {
        const seconds = Math.round((Date.now() - startedAt) / 1000); // one-clock: stopwatch
        teardown();
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type });
        if (blob.size === 0) { reject(new Error('Nothing was recorded — the microphone captured no sound. Try again, and watch the meter move as you speak.')); return; }
        resolve({ blob, mimeType: type, seconds });
      }, { once: true });
      recorder.stop();
    }),
    cancel: () => { teardown(); if (recorder.state !== 'inactive') recorder.stop(); },
  };
}

/* ------------------------------------------------------------------- holding until it arrives */

const DB_NAME = 'foundry.voice-notes';
const STORE = 'pending';

export interface PendingNote {
  id: string;
  ventureId: string;
  blob: Blob;
  mimeType: string;
  seconds: number;
  recordedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('could not open'));
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('store failed'));
    tx.oncomplete = () => db.close();
  }));
}

/** Keep it before the first upload. Nothing is sent that is not held first. */
export const holdNote = (n: PendingNote) => run('readwrite', (s) => s.put(n));
/** Let it go — called only after the studio answered 201. */
export const releaseNote = (id: string) => run('readwrite', (s) => s.delete(id));
export const pendingNotes = (ventureId: string): Promise<PendingNote[]> =>
  run<PendingNote[]>('readonly', (s) => s.getAll() as IDBRequest<PendingNote[]>)
    .then((all) => all.filter((n) => n.ventureId === ventureId))
    .catch(() => []);
