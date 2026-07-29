# FB-057 — Studio design-token discipline (apply meridian's ARCHITECTURE rubric)

**Status:** Planned · **Phase:** 3/5 · **Depends on:** the studio UI (FB-005+) · **Repo:** fountainbridge
**Branch:** `fb-057-studio-design-token-discipline` · One ticket = one branch = one PR.

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
- [ ] A documented token contract + status/priority vocabulary for the studio.
- [ ] Existing components use tokens (no raw hex/px); a check or rubric enforces it.

## Verification
`/review` + `/design-review`; the studio renders consistently in light/dark with no raw values.
