# FB-211 — amber for a decision, red only for a fault nobody can clear

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-03) ·
**Branch:** `fb-211-amber-for-decisions-red-for-faults` · One ticket = one branch = one PR.

## What was found

> Over-budget renders red on the desk and in the rail, with the provenance sentence back. **Over
> budget is a decision waiting on a founder, not a fault.**

FB-203's item 11 kept the over-limit sentence on the desk deliberately — the rail can colour a figure
but cannot say *285% of the limit*, or that £13,700 of it is still awaiting an OK. That reasoning
stands. **The colour was the mistake**, and it was inherited rather than chosen.

## Why it matters

The studio has one attention colour and one alarm colour, and spending the alarm on a routine state
is how a founder learns to stop seeing it. A budget over its limit is exactly the thing the amber
banner at the top of the desk is for: something waiting on the one person who can end it.

## Scope

- Over-limit is **attention (amber)** on the desk and in the rail.
- Write the rule down as rule 2's footnote in `docs/studio-design-contract.md`, in the reviewer's own
  words: *red is permitted for exactly one class — a fault nobody on the venture can clear: a stalled
  machine, a read that will not clear on its own.*
- Sweep `toneColor('blocked')` for anything that is a decision rather than a fault, and move it.

## Out of scope

The tone tokens themselves. `--tone-attention` and `--tone-blocked` are correct; this is about which
states are entitled to which.

## Acceptance criteria

- [ ] An over-limit surface is amber on the desk and amber in the rail.
- [ ] `studio-design-contract.md` states the one class red is for, and `design-lint`'s
      `raw-status-colour` rule points at it.
- [ ] Nothing that a founder can clear by deciding renders in the alarm colour.
- [ ] A stalled machine and an unclearable read still do.
