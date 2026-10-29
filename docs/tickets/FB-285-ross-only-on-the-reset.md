# FB-285 — ARCA's founder is "Founder", and Ross appears only on THE RESET

**Status:** Done · **Kind:** small · **Budget:** none (built in a Claude session, not by the factory) · **Phase:** 3 · **Raised by:** John, 29 October 2026 ("ARCA's founder for the demo is called "Founder", a placeholder … Ross is The Reset's founder only, and must never appear on ARCA or the other ventures") · One ticket = one branch = one PR.

## Why

ARCA's manifest named John as its founder, so the Review screen (FB-274) said "Signed off by John
Gallagher". In the demo that reads as John signing off his own work. John wants a placeholder:
"Founder".

Ross is THE RESET's founder. This repository is public, and his name had spread into examples about
ARCA, CALDERA and no venture at all: test data, comments, a playbook line and generic documentation.
His name belongs only where the subject is THE RESET.

## What changed

- `ventures/arca.yaml`: `founder.name` is now `Founder`. The founder's address
  (`arca.founder@bruntsfield.capital`) and GitHub account are unchanged. Its comment no longer names
  Ross.
- **Examples that were not about THE RESET** now say "the founder" (in sentences) or `Founder` and
  `arca.founder@…` (where a name or an address is needed):
  - tests for ARCA's approvals, provenance, ledger row, welcome and knowledge fixture, and for
    CALDERA's welcome;
  - tests with no venture (the executor, the activity narration, first names);
  - two comments in `components/Decision.tsx` and `components/ReviewScreen.tsx`;
  - the playbook line "Saves the founder six hours a week…", here and in the source copy;
  - generic address examples in `CLAUDE.md`, the phased plan, `docs/manifest.md`,
    `docs/provisioning.md`, the `Venture` schema, and tickets FB-002, FB-080, FB-101 and FB-271.
- **One small code change** in `lib/approval-attestation.ts`: a founder named "Founder" is called
  "the founder", so the approval card does not say "Waiting for Founder, the founder, …".

## What stays

Every mention of Ross that is about THE RESET: its manifest, its tests (including the ones that
prove he cannot open ARCA), its box, and the tickets about his first days in the studio.

## What this means on screen

- The Review screen says "Signed off by Founder".
- ARCA's first-run greeting says "Welcome, Founder."
- Bruntsfield's view of ARCA's desk says "Founder: Founder". Accurate, if a little odd, until ARCA has
  a real founder.

## Done when

- [x] `git grep -w -i ross` finds no line that is not about THE RESET.
- [x] ARCA's founder name is `Founder` in its manifest.
- [x] Every command in `CLAUDE.md` `## Checks` passes.
