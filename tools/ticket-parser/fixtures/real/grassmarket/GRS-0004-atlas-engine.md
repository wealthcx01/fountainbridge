# GRS-0004 — Deterministic ATLAS engine

- **Loop:** 1 (see PRD §9)
- **Branch:** `grs-0004-atlas-engine`
- **Status:** In review
- **Normative source:** `docs/ATLAS-Methodology-v1.1.md` §2, §5, §8; ADR-0001…ADR-0007.
- **Depends on:** GRS-0002/0002a (registry), GRS-0003 (ratified golden master).

## Goal

Port the GRS-0003 reference computation (`scripts/build_golden_master.py`) into the real engine —
the script was the spec; `src/grassmarket/atlas/` is the product. Pure, contracts-typed, fail-loud
functions; **no database, no I/O, no clock, no randomness** (persistence is GRS-0006, Monte Carlo is
GRS-0005). The engine reproduces the ratified Meridian fixture **exactly** and satisfies the
property guarantees.

## What shipped

- **`atlas/inputs.py`** — the engine's input surface: `SubcomponentRating` (reused contract),
  `MetricObservation` (raw XOR non-score state), `PowerObservation` (Benefit + Barrier; powers are
  never N/A), wrapped in `AssessmentInputs`.
- **`atlas/results.py`** — the full typed two-track output (module rows, L terms, group-weighted B,
  P, derived triad, composite, gate bands, display). Every stored continuous value is rounded to
  6 dp at the boundary; downstream terms use full precision.
- **`atlas/engine.py`** — `score(inputs, coefficients, registry)`:
  - **q_m** (§5.1): `α·(Σλ·s/Σλ) + (1−α)·min s` over applicable+assessed only.
  - **L** (§5.4): δ-blend over assessed modules + critical-module `min`; a fully-unassessed module
    is excluded, never zero-filled (D9).
  - **B** (§5.3, ADR-0006): within-group `w_metric`-weighted mean, then `W_g`-weighted across
    groups; N/A / Not-Assessed metrics drop and their group renormalises.
  - **P** (§5.4, §8): `strength = min(Benefit, Barrier)` per power, `w_power`-weighted mean over
    **all 7** powers (never N/A).
  - **Rating gate** (§5.2a, ADR-0003): `min(critical-ceiling, bottleneck-floor)`; "Basic" reachable;
    a critical Not-Assessed blocks; evidence is fail-loud.
  - **Triad** (§2, ADR-0007): derived ordinal Economic/Perceived/Defence; band thresholds derived as
    the nearest-named-level midpoints of the ADR-0004 strength encoding. Ordinal out (ADR-0002).
  - Fail-loud: coefficient set validated against the registry, inputs must cover the registry
    exactly, every coefficient/encoding lookup is bracket access.
- **`atlas/draft_coefficients.py`** — `draft_v1_coefficient_set(registry)`: uniform placeholders
  covering the registry exactly (fully-qualified keys), provenance marked draft-pending-elicitation,
  **`client_usable=False`**. Loadable for tests; must never price a client deliverable.
- **Contracts** — `CoefficientSet` gains `group_weights` (W_g, ADR-0006) and `strength_encoding`
  (ADR-0004) as provenance-carrying, closed-set-validated families, plus a `client_usable` flag.

## Tests

- **Golden master** (`test_atlas_engine_golden_master.py`) — the engine reproduces
  `tests/fixtures/golden_master.json` field-by-field: every q_m, coverage, gate band + note, group
  mean, L term, B, P, the triad, and **V = 0.478565** (exact `==`). Inputs are reconstructed from
  the fixture; the one representational alias (state enum NAME vs VALUE) is normalised on load.
- **Property tests** (`test_atlas_engine_properties.py`, deterministic/enumerated) — monotonicity
  (raising any of the 51 subcomponents never lowers V); bottleneck (raising the unique min gains
  exactly `(1−α)·Δ` over raising the max by the same step); N/A renormalisation (subcomponents AND
  metrics); Not-Assessed exclusion + coverage taint; a critical Not-Assessed blocks the gate;
  powers-never-N/A (denominator always 7; a None power drags P down, not out); gate consistency vs
  §5.2a (all-Basic → Basic; never Frontier over a Basic part; Frontier reachable at all-Advanced/E3).

## Out of scope

Monte Carlo / uncertainty (GRS-0005); scoring-run persistence + value bridge (GRS-0006); the wizard
that fills these inputs (Loop 2). The elicited weights (they replace the draft set) are the panel's.
