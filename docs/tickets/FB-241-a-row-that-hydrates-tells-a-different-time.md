# FB-241 — a row that hydrates in the browser tells a different time from the one beside it

**Status:** Open · **Phase:** 3 · **Found by:** FB-240, 2026-09-30

## What is on the screen

In the gate's own desk screenshot, four lines apart:

- *"Your team checked in **10 minutes** ago."*
- *"Working on ARCA-6 now. · **70 days** ago"*

Both describe the same lane over the same fixture. FB-240 fixed the rail and the desk disagreeing;
this is the remaining pair, and it is a different fault with the same symptom.

## Why

`components/VentureBoard.tsx` is `'use client'`, so `EngineActivity` and its rows render **in the
browser**. `ago()` defaults to `studioNow()`, which reads `process.env.E2E_NOW` — and `E2E_NOW` is
not a `NEXT_PUBLIC_` variable, so it does not exist in the browser. The clock silently falls back to
`Date.now()`.

The engine sentence above it is computed on the server, where the pin does apply. Same helper, same
fixture, two different answers.

**This is already written down.** `lib/when.ts` says it in the note on `howLongMs`: *"`E2E_NOW` is
not a `NEXT_PUBLIC_` variable, so the server and the client disagree about 'now' and the row hydrates
with different words than were rendered. A duration has no such argument with itself."* The helper
that solves it exists. The rows were never moved onto it.

## Why it matters, and what it is not

**Production is not affected.** `E2E_NOW` is never set there, so the server and the browser agree.
Confirmed on ARCA's real data on 2026-09-30: the rows read *"2 minutes ago"* beside a heartbeat
saying *"checked in 2 minutes ago"*.

It matters for the same reason FB-240 did. The UI gate is the only gate that sees a screen, and it
renders a contradiction on every run. A reviewer who learns to skip past it is being trained to skip
past exactly what non-negotiable 11 exists to catch — and the next real disagreement will look
identical to this one.

## Scope

- Move the hydrating rows onto a **duration** rather than a timestamp: compute the age on the server
  where the clock is known, pass the number down, render it with `howLongMs`. That is what the helper
  was written for.
- Check the other client components that render a time the same way, rather than fixing only the row
  that was noticed.
- A test that fails when a client component computes an age from a timestamp, so the next one does
  not reintroduce it. `lib/__tests__/one-clock.test.ts` is where it belongs — extend it rather than
  starting a second file about the same rule.
- Re-take the desk screenshots and confirm the two sentences agree.

## Acceptance criteria

- [ ] Every time shown on the desk agrees with every other, in the gate as well as on real data.
- [ ] A test fails if a client component derives an age from a timestamp rather than a duration.
- [ ] `e2e/__screenshots__/20-desk.png` no longer contradicts itself.

## Notes

Found while verifying FB-240 by looking at the regenerated screenshot rather than by trusting that
the fix was complete. The rail and the desk had been fixed and the picture still said two things.
