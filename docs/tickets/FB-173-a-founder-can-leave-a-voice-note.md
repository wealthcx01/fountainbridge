# FB-173 — a founder can leave a voice note, and it becomes a ticket

**Status:** Open · **Depends on:** FB-174 (the audio needs somewhere to live) · **Phase:** 3 · **Raised by:** John, 2026-09-02

## Why

John: *"I also want a way for Founders to leave voice notes as tickets."*

The composer is a text box. A founder with a thought at 22:00, on a phone, walking, does not type it —
which means the studio only hears from them when they are at a desk. FB-138 built the pocket studio
so the product travels; this is the input half of the same argument.

## Wispr Flow is not the integration, and that is worth being clear about

John linked https://wisprflow.ai. Wispr Flow is a **system-wide dictation input method** for Mac,
Windows, iPhone and Android — it works "anywhere you can type", with no plugin and no integration.
It publishes no API or SDK.

Two consequences:

1. **A founder can already dictate into the composer today**, by installing Wispr Flow on their own
   machine and speaking into the composer's text box. Nothing needs building for that, and it is
   worth telling founders, because it is free and it works now.
2. **It cannot be what the studio ships.** A feature that requires every founder to buy and install a
   third-party keyboard is not a feature of the studio. What this ticket builds is in-studio capture.

## Scope

- **Record in the browser.** `MediaRecorder` on the composer and on the pocket studio, one control,
  hold-to-talk or tap-to-start. It must work on iOS Safari, which is the device this is for.
- **Transcribe with hosted Whisper**, behind a provider port. This was left open for the PR to argue.
  It is settled now, by Grassmarket having already argued it: `openai-whisper` (`whisper-1`) is the
  production default there, chosen by founder direction on 2026-09-02, with the Web Speech API
  rejected on quality and browser coverage. The same trade applies here and there is no reason for
  two answers in one company.
  The port matters as much as the provider: `build_transcriber(settings)` is a single resolution
  point, an unknown provider key is refused at load, and **a test double is refused in production**.
- **The transcript is a draft, never a filing.** It lands in the composer's input, the founder reads
  it, and the composer's existing gate ("Nothing is built until you press it") is still the only
  thing that turns words into work. A voice note that files a ticket unread is the fastest possible
  way to fill a founder's board with things they did not mean.
- **Keep the audio, or say you did not.** If the recording is discarded after transcription, the
  screen says so. If it is kept, it needs a home (FB-174) and a retention answer.
- Failure is loud (#10): no microphone permission, no network, a transcript that came back empty —
  each says which, and the typed input is never taken away.

## Acceptance criteria

- [ ] A founder can record a note on an iPhone and see a transcript in the composer.
- [ ] Nothing is filed without the founder pressing the existing gate.
- [ ] Where the audio goes, and whether it is kept, is stated on screen and true.
- [ ] Every failure names itself; the text box keeps working throughout.
- [ ] The transcription choice and its privacy reasoning are argued in the PR body.

## What Grassmarket already learned, which we should not re-learn

`frontend/components/VoiceNoteRecorder.tsx`, `frontend/lib/recording.ts`,
`src/grassmarket/pathb/transcription.py` and `src/grassmarket/web/routers/voice_notes.py`. That
feature is live and its comments carry the scars. Five of them are ours to inherit.

**The meter must move.** A recording that captured silence — muted microphone, a phone that handed
the browser the wrong input, permission granted to a dead device — looks exactly like a good one
until it comes back empty, and by then the thought is gone. A live level meter is the only proof a
founder gets that their voice is reaching us. It is not decoration and it is not optional.

**Nothing is thrown away until the server has it.** The recording goes into IndexedDB the moment it
stops and is released only on a `201`. A failed upload leaves it on the phone to retry on next load.
Grassmarket's note says it plainly: *the car park has one bar, and the conversation cannot be had
again.* A founder walking home at 22:00 is the same case.

**Say where the audio goes, on the screen, before they press record.** Grassmarket puts one sentence
in front of the advisor: the recording is stored here and sent to OpenAI Whisper to be transcribed.
The person deciding whether to speak is the person who needs to know where their voice ends up.

**Never fabricate a transcript.** Grassmarket's offline transcriber used to be the unconditional
return of the route's dependency, in every environment. It decoded bytes as UTF-8, so a real MP3
became replacement characters that were stored and served as that meeting's transcript — a silent
fallback that invented data. Two things stop it recurring there and must stop it here: the offline
transcriber refuses undecodable bytes rather than replacing them, and the builder refuses to hand a
test double to production.

**It proposes; it never files.** The transcript comes back beside a *proposed* update with per-field
confidence, and not one field is applied until the human ticks it and confirms. What they confirm is
what is applied — not what was suggested.

## What is different here, and it is one thing

Grassmarket proposes a **pipeline update**. We propose a **ticket**.

So the transcript comes back with a draft ticket beside it — a title, a surface, and the note in the
founder's own words — and the founder edits and presses the gate that already exists. That keeps
this feature inside the rule the whole studio is built on: everything new proposes, and only the desk
grants.

## Sequencing

**FB-174 first.** Audio and transcripts are bytes, and today the studio's only storage is committing
base64 into a git repository. Building voice notes before the document store means committing MP3s
into ARCA's repository, which is the exact fault FB-174 exists to fix. FB-174 depends on FB-170.

Grassmarket also encrypts transcripts at rest (`FernetTranscriptCipher`). A founder's voice note is
at least as sensitive as an advisor's meeting, so whatever FB-174 builds needs an answer for
encrypted text at rest, and there is an in-house pattern to copy.
