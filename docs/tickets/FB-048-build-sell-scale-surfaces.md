# FB-048 — Build / Sell / Scale as three founder-owned surfaces

**Status:** Done · **Phase:** 2 · **Depends on:** FB-006 (venture board), FB-037 (dept-generic
loop) · **Repo:** fountainbridge · **Branch:** `fb-048-build-sell-scale-surfaces` · One ticket = one
branch = one PR.

## Why this matters (for the founder)
Running a venture isn't one job — it's three: **building** the product, **selling** it, and **scaling**
it. This gives each its own place in the studio to manage and own, so you always know what's happening
across all three, not just engineering. Cofounder lumps departments together; we split the three jobs
that actually run a company.

## Context
John (2026-07-29): "split managing product building, selling and scaling as their own ticket surfaces
to manage and own better than cofounder.co." The manifest already supports `departments`
(`gate ∈ pr | activegraph | tbd-fb012`) but the studio never rendered them (audit: "Department absent
from code"), and manifests declared a single `engineering` department. This makes **Build / Sell /
Scale** first-class: declared in every manifest, parsed by the loader, and surfaced on the board. It is
the visible half of the design's department-generic loop (`docs/founder-to-lane-execution.md` §7).

## Scope
- **Manifests:** replace the single department with **build** (product, gate `pr`), **sell** (GTM —
  content + interest-based sends, gate `activegraph`), **scale** (growth/ops/finance, gate
  `tbd-fb012`) in `arca.yaml` + `the-reset.yaml`. Sell/Scale repos that aren't provisioned yet render
  as "coming with your repo" (their repo isn't in the venture's `repos`).
- **Loader:** `lib/ventures.ts` parses `departments` into `DepartmentSummary[]` (`id, name, repo,
  queuePath, gate, provisioned`), where `provisioned = repo ∈ repos`.
- **Studio:** `VentureBoard` renders a **"Your surfaces"** section — a card per department with its
  plain-language gate ("approved by review" / "approved before it goes out") and active/coming state.
- Unit tests for the parse; the manifest validator still green.

## Out of scope
- Per-department ticket queues on the board (each surface currently links to the venture's work; a
  full per-department board is a fast-follow once Sell/Scale repos exist).
- Provisioning the `*-marketing` / `*-ops` repos (a provisioning step, FB-039/FB-045).
- The lane loop's department routing (FB-041) — this is the studio surface + manifest shape.

## Acceptance criteria
- [x] `arca.yaml` + `the-reset.yaml` declare Build/Sell/Scale; all manifests validate.
- [x] `loadVentures` parses departments + marks unprovisioned ones (unit-tested).
- [x] The board renders the three surfaces with plain-language gates + active/coming state.
- [ ] CI green (typecheck/test/Playwright/validate-manifests).

## Verification
`/review` + CI. Typecheck + the ventures unit test + manifest-validate pass locally; the Playwright
UI gate renders the new surfaces without breaking the existing board flow.
