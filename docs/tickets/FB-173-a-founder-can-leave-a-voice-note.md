# FB-173 — a founder can leave a voice note, and it becomes a ticket

**Status:** Open · **Phase:** 3 · **Raised by:** John, 2026-09-02

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
- **Transcribe.** The Web Speech API is free and on-device but its quality and browser support are
  both uneven; a Whisper-class service is accurate and is an external call with a cost and a privacy
  question. **Decide explicitly and write the reasoning in the PR** — a founder's voice going to a
  third party is a decision, not a detail, and CLAUDE.md #8's spirit covers it.
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
