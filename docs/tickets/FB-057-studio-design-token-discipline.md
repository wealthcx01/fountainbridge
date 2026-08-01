# FB-057 — Studio design-token discipline (apply meridian's ARCHITECTURE rubric)

**Status:** Done · **Phase:** 3/5 · **Depends on:** the studio UI (FB-005+) · **Repo:** fountainbridge
**Branch:** `fb-057-studio-design-token-discipline` · One ticket = one branch = one PR.

**Design:** `docs/studio-design-contract.md` — written by this ticket, and the thing CI now enforces.

## Why this matters (for the founder)
A studio that looks and feels like one coherent, trustworthy product — not a patchwork — because every
screen draws from one design system, and every control does something real.

## Context
Meridian's `ARCHITECTURE.md` is a disciplined token contract: tokens-only (no raw hex/px), one status
vocabulary (working/idle/paused/blocked/offline; p0–p3), machine values in mono, "no dead UI / every
button dispatches something real". We already pull grassmarket tokens (D6) but enforce them ad hoc.
This applies that rubric.

## Scope
- Codify a **studio token contract** (grassmarket tokens; no raw hex/px in components), a single status
  vocabulary + priority scale, mono for machine values, and a "no dead UI" rule.
- A lint/check (or a documented review rubric) that flags raw values + dead controls in the studio.
- Sweep the existing studio components (VentureBoard, cards, queues) onto the contract.

## Out of scope
- A visual redesign (this is discipline, not a re-skin). New surfaces.

## Acceptance criteria
- [x] A documented token contract + status vocabulary for the studio: `docs/studio-design-contract.md`
      (tokens-only, the complete type scale, five status tones, mono for machine values, no dead UI).
      The tones live in `lib/status.ts`, where every domain status — CI, ticket, approval, lane fault
      — maps onto one of them.
- [x] Existing components use tokens, and a check enforces it: `make design-lint` (wired into CI as
      the **Design contract** job) flags raw hex, raw px, a status colour named directly instead of
      through a tone, and a `<button>` that dispatches nothing. The sweep took the studio from 51
      violations to 0.

**Note on "priority scale":** the ticket asked for `p0–p3` alongside the status vocabulary. The
studio has no priority concept — tickets carry no priority field, and nothing renders one — so
shipping a scale would have meant inventing a product concept inside a discipline ticket. Left out
deliberately; it belongs with whatever ticket first needs to *rank* work.

## Verification
`make design-lint` (0 violations across 22 files) + 22 new unit tests: the tone vocabulary and every
domain mapping (`lib/__tests__/status.test.ts`), and the linter's own catch/quiet edges including
comments, URL anchors, the 1px hairline exemption and multi-line buttons
(`scripts/__tests__/design-lint.test.mjs`). 147 tests, lint, typecheck, build, the Playwright UI gate
(34), ticket parse, manifest validation and shellcheck all green.

**The one deliberate visual change.** Every type-scale replacement is the token for the exact value
it replaced, so the sweep is pixel-identical — *except* CI states. A run that is `in_progress`, and a
PR whose checks are `pending`, previously fell through to grey, the same colour as "no CI runs" and
"unknown". They now read `working` (accent). That conflation of *running* with *we don't know* is
precisely what one status vocabulary exists to remove, so it is a fix rather than a regression — but
it is a visible change and should be looked at, not assumed.
