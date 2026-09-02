# FB-167 — the rail says the office is not live, three lines above "your team checked in 3 minutes ago"

**Status:** Shipped · **Phase:** 3 · **Found by:** FB-156, on production

> Removed rather than replaced. The rail already answers "is this venture's machine alive" once,
> from the run reports, in the line the placeholder was contradicting; the office itself lives on the
> desk, which is where FB-139 put it. Whether the rail should carry a compact office summary at all
> is a design call, not a bug fix, and inventing one here would have been the second source this
> ticket exists to remove.

## What a founder sees

Every venture page, in production, on 2026-09-02:

```
THE OFFICE
Not live yet. Your team’s desks appear here once this venture’s machine
reports what they are doing.

BUDGETS, MONTH
…
Your team checked in 2 minutes ago.
```

Two statements about the same machine, in the same rail, one screen apart, and they contradict each
other. The machine is reporting — the check-in line is right and is read from the run reports the box
wrote minutes earlier. The office block is wrong.

Reproduced on `/venture/arca`, `/venture/arca/tickets` and `/venture/arca/knowledge`. It is on every
venture screen, because the rail is on every venture screen.

## Why

`components/Rail.tsx` still carries the placeholder FB-139 was supposed to remove. Its own comment
says so:

```tsx
{/* FB-139 replaces this with the live feed from the venture box. Until then it says what it is:
    a placeholder is honest, a frozen last-known scene would not be. */}
```

FB-139 built the live office — `office-plate` and `office-ledger` on the desk — and did not delete
the block it was replacing. The placeholder was honest when nothing was live. It became a false
statement the moment the office did, and it has been sitting above a contradicting fact ever since.

This is FB-139's own constraint failing on the surface it did not touch: *"The office is the feeling;
this ledger is the record. Same events, so they cannot disagree."* The rail is a third thing, telling
a fourth story.

## Scope

- Remove the placeholder, or render the real office summary in the rail from `buildOffice` — the same
  array the desk's plate and ledger already map, never a second source (FB-099, FB-149).
- If the rail should stay quiet about the office, it must say nothing rather than say the opposite of
  what the line below it says.
- A test that fails when two surfaces on one page disagree about whether the venture's machine is
  live. The unit that matters is the *page*, not either component.

## Acceptance criteria

- [ ] No venture page states both "not live yet" and a recent check-in.
- [ ] Whatever the rail shows about the office comes from the same events the desk's ledger does.
- [ ] Reverting the fix turns the new test red.
