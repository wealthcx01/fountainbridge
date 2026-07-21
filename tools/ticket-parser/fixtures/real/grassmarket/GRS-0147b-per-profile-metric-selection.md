# GRS-0147b — Per-profile B-index metric selection (ADR-0035 Phase 2)

**Status:** Implemented (2026-07-19) — ADR-0035 Phase 2. Mechanism only; wealth content is Phase 3.
**Loop:** Part 2 — segment-fit remediation

## Why

Operating-model profiles (ADR-0025) only reshaped the **L / infrastructure modules**; `for_profile`
passed the B-index metrics through verbatim, so an exchange and a wealth manager were both scored on
retail AUA/ARPU/GBP. And because `CoefficientSet.validate_against` requires `w_metric` to cover
**exactly** `registry.metric_keys()`, you could not simply add segment metrics to the shared
`metrics.yaml` without breaking the retail golden master. Per-profile metrics were a missing
capability. This adds it, mirroring the module mechanism, with the retail path byte-identical.

## What changed (additive; retail/exchange unchanged; golden master byte-identical)

- **`ProfileDef` gains two levers:**
  - `metric_keys: tuple[str, ...] | None` — `None` (default) inherits the full superset (so retail
    and exchange are unchanged); a tuple selects exactly those superset metrics; `()` selects none.
  - `metric_additions: tuple[MetricDef, ...]` — profile-specific metrics that live on the profile,
    never in the shared superset, so adding a profile can never change the retail metric set.
- **`Registry.for_profile`** builds the view's metrics = (superset filtered by `metric_keys`, or all
  if `None`) + `metric_additions`, preserving superset order. Fail-loud on an unknown selected key or
  an addition that shadows a superset key.
- **`load_profiles`** parses `metrics:` (→ `metric_keys`) and `metric_additions:` (each via the same
  `_parse_metric` as the superset, so a profile metric is a first-class `MetricDef` with anchors,
  direction, group, and GRS-0144 domain bounds).

## Acceptance
- A profile can select a subset of superset metrics, drop them all (`()`), and add its own; the retail
  view's metrics still equal the superset (existing invariance test). Fail-loud on unknown/shadowing
  keys. Golden master V=0.478565 unchanged; 774 backend tests + schema sync green.
- Unblocks Phase 3 (the wealth profile's own metric set) with no golden-master risk.
