# FB-262 — "10 minutes ago" wraps onto two lines in the run list

**Status:** Open · **Phase:** 3 · **Found by:** FB-241, 2026-10-02

## What is on the screen

On the desk, under "What your team did", each run starts with how long ago it happened. The column
for that is 5.75rem wide. *"72 days ago"* fits on one line. *"10 minutes ago"* does not: it breaks
after "minutes", so the row has a two-line stub in its first column and the page grows by 18px.

## Why it shows up now

Before FB-241 the UI gate's rows read *"72 days ago"*, because they were timed against the wrong
clock. Now they are timed correctly and read *"10 minutes ago"*, which is longer. On a real venture
that has just checked in, the rows say *"2 minutes ago"* or *"12 minutes ago"* — about the same
length — so the wrap is likely on production too.

## Scope

- Let the longest time this column can print (*"59 minutes ago"*) fit on one line at 1440×1000,
  without taking so much width that the run's sentence wraps more than it does today.
- Check it at 393×851 as well, where the row already puts its sentence under the time.

## Acceptance criteria

- [ ] *"59 minutes ago"* sits on one line in the run list at 1440×1000.
- [ ] The desk is no taller than before FB-241 (2,324px on the gate's fixtures at 1440×1000).
