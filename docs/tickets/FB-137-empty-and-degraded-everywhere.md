# FB-137 — Every screen tells the truth when it has nothing, or cannot read

**Status:** Todo · **Area:** Studio / honesty · **Depends on:** FB-128, FB-129, FB-130, FB-131, FB-132, FB-133, FB-134, FB-135, FB-136
**Design:** `docs/design/foundry-desk/` — the `firstrun`, `degraded`, `*Empty` states throughout; the
wireframe's own props expose `degraded` as a switch precisely so every screen can be checked in it.

## Why this matters (for the founder)

This is CLAUDE.md #10 made into a screen-by-screen obligation: *"A founder blocked at 22:00 must see
why in the studio — run reports, lane staleness and failure states surfaced in plain language, never
swallowed."*

Two states, on every screen, and they are different things a founder must never confuse:

- **Empty** — there is genuinely nothing. *"No runs yet. The engine wakes when there is a ticket to
  work; every wake will be written down here."* An invitation, not an apology.
- **Degraded** — we could not read. *"GitHub is rate-limiting reads from arca-site; this desk fills in
  as reads succeed. Nothing for you to do; it clears on its own."*

A blank panel that could mean either is the failure. It teaches a founder that empty means broken, and
after that they stop believing the full panels too.

## What is true today

`lib/tickets.ts` already distinguishes `no-credentials` / `unreadable` / `rate-limit` / `error`
(FB-021) — the hard part is done and mostly unused. `components/FirstRun.tsx` and `BoardUnreadable`
exist. `lib/runreports.ts` separates `unknown` (no checks exist) from `unavailable` (could not find
out), which is the same distinction one level down.

It is applied unevenly, which is why this is one ticket rather than a line in ten.

## Scope

- Every screen from FB-128 to FB-136 gets both states, with the design's copy.
- **The degraded strip is grouped by cause and sits below anything the founder must act on.** A
  rate-limit notice above the blocker banner is a studio telling a founder about its own problems
  before theirs.
- **Nothing invented in either state.** No zero standing in for unknown, no dash that reads as nought.
- A degraded read never blanks a panel that had data a moment ago — it fills in as reads succeed.
- Both states are **testable on demand**, not only when GitHub happens to fail. The wireframe has a
  `degraded` switch; the studio needs the equivalent so this can be checked in CI and by eye.

## Out of scope

- Fixing the causes. This is about saying what is true while they happen.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift
```

Every screen, in three states, by eye — the checklist goes in the PR:

```
# 1. populated   2. genuinely empty   3. reads failing
```

## Acceptance criteria

- [ ] Every screen FB-128…FB-136 has a distinct empty state and a distinct degraded state.
- [ ] Empty reads as an invitation; degraded says what failed, in plain words, and that it clears itself.
- [ ] The degraded strip groups by cause and never sits above something the founder must act on.
- [ ] No screen renders a zero, a dash or a blank where the honest answer is "we could not read".
- [ ] Degraded state can be induced deliberately for testing, and there is a test that every screen
      renders something truthful in it.
- [ ] The three-state checklist for all nine screens is in the PR, with what was seen.
