# FB-109 — The surfaces organise the board

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"We then have the
surfaces… and dont actually act as a filter. Because then underneath we have each repo of Build,
GTM, Growth & Ops - sat underneath."* Caught on re-read: this was the one sentence of the journey
review the first eight tickets did not cover. · **Repo:** fountainbridge ·
**Branch:** `fb-109-the-surfaces-organise-the-board` · One ticket = one branch = one PR.

## The disconnect

The board presents the same three-way split twice and never joins them. First as **cards** —
Build / Sell / Scale, each with its gate, budget, and launch door. Then, further down, as **lanes**
— three ticket lists headed by repo names (`arca`, `arca-marketing`, `arca-ops`). A founder has to
already know that "Build — Product" *is* `arca` to connect a card to its queue; the studio knows
the mapping (each department declares its repo in the manifest) and keeps it to itself. The cards
look like controls — they are the most button-shaped objects on the page — and do nothing.

## What ships

- **A surface card is the door to its queue.** Clicking a card scrolls to / expands its lane
  below, and the lane's heading takes the surface's name — *"Build — Product"*, with the repo name
  demoted to a small technical aside — so the page's two halves finally speak the same names.
  (The manifest mapping already exists; this is presentation, not new data.)
- **Filtering, the simple version.** A selected surface highlights its lane and quiets the others
  (visually de-emphasised, not hidden — hiding two-thirds of the board behind a first click is how
  a founder loses work they didn't know to look for). Selecting nothing shows everything, as
  today. No routing changes, no state that survives reload.
- **The card carries its queue's numbers.** Each surface card gains its lane's counts ("2 waiting
  for your OK · 1 in progress"), computed from the same attention model as everything else
  (FB-099's one-source rule) — so the card is worth clicking before it is clicked.

## Explicitly NOT here

- Per-surface pages or routes (a filter that is really navigation is a bigger design decision).
- Reordering or renaming the departments themselves (manifest-owned, venture-as-config).
- The cards' copy wordiness (FB-103's sweep owns the words; this ticket owns the behaviour).

## Acceptance criteria

- [ ] Clicking a surface card brings its queue into view, visibly associated, others quieted.
- [ ] Lane headings lead with the surface name; the repo slug becomes an aside.
- [ ] Surface cards show their queue's counts, from the shared attention computation.
- [ ] Keyboard and screen-reader users can operate the cards (they become real buttons —
      the audit found the ticket cards are the only button-shaped things on the page that act
      like one; the surface cards must not repeat that).
- [ ] E2e: select Build → arca's queue is focused; deselect → all three equal again.
