# GRS-0001 — Scaffold (Loop 0)

- **Loop:** 0 (see PRD §9)
- **Branch:** `grs-0001-scaffold`
- **Status:** In progress
- **Owner:** Founder + engineering
- **Normative sources:** `CLAUDE.md`, `docs/Grassmarket-PRD-v2.md`,
  `docs/ATLAS-Methodology-v1.md`, `docs/ATLAS-Feasibility-Deep-Dive-v1.md`.

## Goal

Stand up the Grassmarket repository so that every downstream loop inherits the
non-negotiables structurally, not by convention. Loop 0 ships **no scoring engine**
(that is Loop 1) — it ships the *scaffold that makes the prototype's defects
impossible to reintroduce*.

## Scope

1. **Repo hygiene** — `git init`, GitHub remote `wealthcx01/grassmarket`, `.gitignore`,
   `.gitattributes`, `.python-version`, `.env.example`, pre-commit gate
   (ruff, format, schema-validate, secret-scan) — never bypassed.
2. **Layout** per `CLAUDE.md`: `src/grassmarket/{config,contracts,data,atlas,pipeline,
   deliverables,workbench,earnings,auth,web}`, `frontend/`, `packages/bcap_contracts/`,
   `tests/`, `docs/adr/`, `docs/tickets/`.
3. **`bcap_contracts` package** — Pydantic v2 models + JSON Schemas for the core
   resources (entities, engagements, assessments, deliverables, commissions, learning,
   auth claims), shaped like the future Holy Corner API (PRD §1). Includes:
   - the **single key registry** (ADR-0001) — 7 Powers populated (fixed by Methodology
     §8), 9 module keys stubbed (subcomponents authored Loop 1);
   - **`CoefficientSet`** with load-time validators (Σθ=1, α∈[0,1], registry
     completeness, mandatory Weight Provenance Record) — kills D1–D7;
   - the **`Money`** type and the score/currency type boundary (ADR-0002) — no
     cross-domain operator exists.
4. **Auth skeleton** — invitation-based signup, email/password + JWT with role/tier
   claims in the Holy Corner claim shape; data scoping enforced **only** in
   `src/grassmarket/data/repository.py`.
5. **ADR-0001 and ADR-0002** — written from the Methodology *before* any engine code.
6. **CI** — GitHub Actions: `ruff` + `pyright` + `pytest` must pass.
7. **Railway deploy skeleton** — FastAPI + managed Postgres; health endpoint.
8. **Frontend** — Next.js App Router + TS shell with BC design tokens.

## How this scaffold defeats the defect register (D1–D9)

| Defect | Prototype cause | Structural defence in this scaffold |
|---|---|---|
| D1, D4, D7 | Key-name mismatch → silent equal-weight / zero fallback | Single registry (ADR-0001); unknown key → `UnknownKeyError` at load; `CoefficientSet` completeness validated against registry |
| D2 | `module_effects` mismatch → `κ=0` → `LV=−cost` | κ deleted (ADR-0002); no score×currency operator exists; prioritisation is full re-scoring (Loop 1) |
| D3 | α read from wrong key; seed α=2.0 accepted | `α ∈ [0,1]` enforced at construction; α keyed in the registry-validated `CoefficientSet` |
| D5, D6 | `normalization.py` empty; `metric_weights.yaml` empty | Business-metric register lives in contracts; a coefficient set over an empty dimension **refuses to validate**, never passes |
| D8 | Zero backend tests, no schema parity | Tests mandatory from Loop 0 (scoping, registry, invariants, ADR compliance); `schema-validate` pre-commit hook enforces model↔JSON-Schema parity |
| D9 | Empty module → `q_m=0.0` | `Not Assessed` is a first-class state (ADR-0001) that contributes to no score; empty-module-as-zero prohibited |

Score/currency dimensional inconsistency (feasibility §5 gap 2) is defeated by the
ADR-0002 type boundary: no function in `bcap_contracts`/`atlas` takes a score-domain
value and a `Money` value and returns a number.

## Exit criteria

- [ ] Repo builds (`uv sync`), pre-commit active, no `--no-verify` anywhere.
- [ ] CI green: `ruff` + `pyright` + `pytest`.
- [ ] ADR-0001 and ADR-0002 committed.
- [ ] Scoping tests passing (a consultant sees only their own data — enforced in the
      repository layer, tested from day one).
- [ ] Registry / `CoefficientSet` invariant tests passing (unknown/missing key,
      Σθ=1, α∈[0,1], provenance-required).
- [ ] A logged-in empty shell deploys to Railway (health endpoint + auth flow working).

## Out of scope (later loops)

ATLAS scoring engine, Monte Carlo, value-bridge computation, wizard, pipeline UI,
deliverable builder, Workbench, earnings math, Path B meeting intelligence. Loop 0
ships **mechanisms and seams**, not features.
