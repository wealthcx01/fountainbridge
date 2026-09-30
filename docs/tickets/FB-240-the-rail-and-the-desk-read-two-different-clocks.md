# FB-240 — the rail and the desk read two different clocks, so the gate always shows a contradiction

**Status:** Open · **Phase:** 3 · **Found by:** FB-178, 2026-09-30

## What is on the screen

Every UI-gate screenshot of the desk says both of these at once:

- the rail, on the left: *"Your team has not checked in for 70 days. It wakes every few minutes when
  all is well, so something is wrong with this venture's machine."*
- the body, in "What your team did": *"Your team checked in 10 minutes ago."*

Both are reading the **same heartbeat file**. They disagree because they are asking two different
clocks what time it is.

## Why

`engineStateAt` takes "now" as an argument, and its two callers pass different values:

- `app/venture/[id]/page.tsx:221` — the desk — passes `defaultNow()`, which honours the test-only
  `E2E_NOW` pin (`lib/health.ts:267`).
- `app/venture/[id]/layout.tsx:149` — the rail — passes `Date.now()`, the real clock.

`lib/rail.ts:116` already carries the comment *"The rail and the desk must not disagree about whether
the machine is alive, so they read the same thing the same way."* They do read the same thing. The
clock is what differs, and it differs one level up, at the call site, where that comment is not.

## Why it matters, and what it is not

**Production is not affected.** `E2E_NOW` is never set there, so `defaultNow()` and `Date.now()` are
the same instant and the two sentences agree. This is not a founder-visible fault today.

It matters because of what it does to the gate. The UI gate is the only gate that sees a screen
(CLAUDE.md #2), and on every run it renders a rail contradicting the body. Two things follow:

1. **A real rail-versus-desk disagreement could not be seen.** The screen already shows one, so the
   signal is used up. FB-099 was exactly this failure — a badge saying 15 over columns saying 0 —
   and the check that would catch it next time is now permanently red-flagged and ignored.
2. **Every screenshot a person reviews under non-negotiable 11 contains a false alarm.** A reviewer
   who learns to skip past it is being trained to skip past the thing the rule exists for.

## Scope

- One clock at both call sites. `loadRailData(venture, defaultNow())` is the likely one line.
- A test that fails if the two sentences disagree over one heartbeat — the property, not the line.
  Put it where a future caller passing `Date.now()` again is what breaks it.
- Re-take the desk screenshots and confirm the rail and the body now say the same thing.

## Acceptance criteria

- [ ] The rail and the desk state the same engine age over the same heartbeat, in the gate.
- [ ] A test fails if a caller gives one of them a different clock.
- [ ] The desk screenshots in `e2e/__screenshots__/` no longer contradict themselves.

## Notes

Found while measuring the desk over a real backlog for FB-178, by looking at the picture rather than
at the numbers — the heights were correct and the screen still said two opposite things. Not fixed
there: FB-178's scope is the desk's height, and a clock seam shared by every venture screen is a
change with its own blast radius (non-negotiable 3).
