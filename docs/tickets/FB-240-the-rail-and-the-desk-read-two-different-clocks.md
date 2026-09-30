# FB-240 — the rail and the desk read two different clocks, so the gate always shows a contradiction

**Status:** Done · **Phase:** 3 · **Found by:** FB-178, 2026-09-30

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

## What shipped

**One clock, and it defaults.** `studioNow()` is now the studio's only clock — `defaultNow()`
delegates to it rather than parsing `E2E_NOW` a second time, because two functions that each read the
same variable were two clocks with one name between them.

The clock-taking functions now **default** their argument: `loadRailData`, `loadLedgerRow`,
`loadWaitingAges`, `engineState` and `engineStateAt`. So the easy call is the correct one, and a
caller has to go out of its way to introduce a second clock. That is the mechanism this needed; the
comment asking for it already existed in `lib/rail.ts` and sat one level below the call site that was
wrong.

**Three call sites were wrong, not one.** The rail (`layout.tsx`), the tickets screen, and the
approvals screen — whose own comment says *"it must not show a cheaper number than the desk did"*
while reading a different clock from the desk. The MCP tools had it too.

**The rule is not "never call `Date.now()`."** There are two kinds of clock here:

- a clock the founder **reads** — ages, staleness, "checked in 3 minutes ago" — which must be the
  one shared clock, or two surfaces disagree in front of a founder;
- a clock **written into a record** — `granted_at` on an approval, a thread's timestamp — which must
  be the real one. Stamping a pinned test time into a signed grant would be a far worse bug than this
  ticket's.

`lib/__tests__/one-clock.test.ts` encodes that split: it allows `new Date().toISOString()` and
refuses every other raw clock under `app/`. Each of its five tests was checked by reintroducing the
fault and watching it go red.

## Acceptance criteria

- [x] The rail and the desk state the same engine age over the same heartbeat, in the gate. Both now
      read *"Your team checked in 10 minutes ago."*
- [x] A test fails if a caller gives one of them a different clock. Mutation-checked four ways,
      including putting `Date.now()` back in the rail.
- [x] The desk screenshots in `e2e/__screenshots__/` no longer contradict themselves — for the rail
      and the desk. **One pair remains and is filed as FB-241**, below.

## Found while doing this

**FB-241** — the run rows hydrate in the browser, where `E2E_NOW` does not exist, so they read the
real clock while the sentence above them reads the pinned one: *"checked in 10 minutes ago"* four
lines above *"70 days ago"*. A different fault with the same symptom, and `lib/when.ts` already
documents it and already carries the helper that fixes it. Production is not affected.

Found by looking at the regenerated screenshot instead of trusting that the fix was complete.

## Notes

Found while measuring the desk over a real backlog for FB-178, by looking at the picture rather than
at the numbers — the heights were correct and the screen still said two opposite things. Not fixed
there: FB-178's scope is the desk's height, and a clock seam shared by every venture screen is a
change with its own blast radius (non-negotiable 3).
