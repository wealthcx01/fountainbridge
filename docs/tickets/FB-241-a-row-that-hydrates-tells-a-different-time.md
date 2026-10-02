# FB-241 — a row that hydrates in the browser tells a different time from the one beside it

**Status:** Shipped in part · **Phase:** 3 · **Found by:** FB-240, 2026-09-30

**Shipped in part:** every time on the desk now agrees in the UI gate, and the check that keeps it that way follows the browser into `lib/`. What is left: nobody has read the desk on production (ARCA's real data) since the change. Do that, signed in as the founder, and tick the first criterion.

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
  In the gate: yes, seen in the pictures on 2026-10-02. On real data: not read since the change.
- [x] A test fails if a client component derives an age from a timestamp rather than a duration —
  including through a `lib/` helper it calls.
- [x] `e2e/__screenshots__/20-desk.png` no longer contradicts itself.

## Notes

Found while verifying FB-240 by looking at the regenerated screenshot rather than by trusting that
the fix was complete. The rail and the desk had been fixed and the picture still said two things.

## What shipped

The server now works out every age on the desk, against one "now", and hands the number to the
parts that draw in the browser. They only turn it into words.

- **The run rows** (`EngineActivity`) get each run's age from `ageRuns` in `lib/runreports.ts`.
- **The office ledger** gets `sinceMs` from `buildOffice`.
- **The waiting rows and the blocker banner** were a second fault the screenshot showed: the
  attention queue ages its pull requests against the real clock when it reads them, so under the
  pinned clock they said *"79 days"* beside *"10 minutes"*. The desk page now re-ages them against
  its own "now". Both say *"7 days"*.
- **"updated just now"** is aged from the moment the studio fetched the data, by the same clock
  that stamped it (`stampAgeMs`).
- **Other screens with the same fault:** the work page's *"Waiting 3 days for you"*, and the
  routines lists on Memory and on the routines page, which decided "ran recently" against the
  browser's clock. All three now take the time from the server.

`lib/__tests__/one-clock.test.ts` has the guard. It finds every file that runs in the browser —
marked `'use client'`, or imported by one that is — and fails if any of them reads the clock or
imports a helper that does. It also checks that the sentence and the rows under it say the same
thing under a pinned clock.

Before and after, on the gate's fixtures, are in `docs/design-conformance.md`. Every time on the
desk now agrees. Production was not re-read after the change, because nothing changes there: the
server and the browser already shared a clock, and the server now does what the browser did with
the same clock. Found on the way: *"10 minutes ago"* wraps in its column — FB-262.

## Fixed after review, 2026-10-02

- **The check had a blind spot, and a real case was in it.** It only followed imports inside `app/`
  and `components/`. The Sell line on the desk, *"Last send went out 3 days ago"*, was still worked
  out in the browser: VentureBoard → `surfaceOutcome` (lib/desk) → `sellOutcome` (lib/sends) →
  `howLong`. The server now works out how long ago the last send went, and hands the number down.
  The check now follows the browser into `lib/` too, one function at a time, so a server-only
  function that shares a file with a browser helper is not blamed for it. A failure names the route,
  for example *"in the browser through VentureBoard → lib/desk.ts surfaceOutcome → lib/sends.ts
  sellOutcome"*.
- **A server action is not browser code.** The browser can call one, but it runs on the server, so
  the check stops there.
- **A stopwatch is allowed.** The voice note's timer reads the browser's clock at both ends, so it
  cannot disagree with anything. Those lines are marked `one-clock: stopwatch`.
- **A waiting row with an unreadable date** said *"waiting a few seconds"* after this change, because
  the queue stores an unreadable date as an age of 0. It says *"waiting on you"* again, as it did
  before.
- **The check also sees a relative import** (`./when`), not only `@/lib/when`.

