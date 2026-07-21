# GRS-0003 — Golden-master fixture

- **Loop:** 1 (see PRD §9)
- **Branch:** `grs-0003-golden-master` (stacked on `grs-0002-registry-content`)
- **Status:** ⏸ **PAUSED FOR JOHN'S RATIFICATION** — GRS-0004 (the engine) does not start until the
  fixture numbers are approved.
- **Normative sources:** `docs/ATLAS-Methodology-v1.1.md` §3, §5, §8; ADR-0001…ADR-0007.

## Goal

One complete assessment computed **end-to-end** per Methodology §5 for a composite mid-tier
retail brokerage (**"Meridian Securities"**), as the golden-master oracle the engine (GRS-0004)
must reproduce **exactly**. Delivered two ways: a live-formula workbook for you to audit/adjust,
and the JSON the engine tests against.

## Deliverables

- **`fixtures/golden-master.xlsx`** — live formulas. Editing a subcomponent Level (or setting a
  State) recomputes q_m → L, and the metric/power inputs recompute B/P → **V**. Sheets: Overview,
  Subcomponents, Modules, Business, Powers, Composite.
- **`tests/fixtures/golden_master.json`** — inputs + every intermediate + finals (authoritative).
- **`scripts/build_golden_master.py`** — the reference generator (Methodology §5).
- **`scripts/regen_golden_master_json.py`** — after you edit the workbook in Excel and save, this
  reads your inputs back and regenerates the JSON via the same compute path (one oracle, no drift).
- **`tests/test_golden_master_fixture.py`** — tests asserting the fixture is internally
  consistent (q_m = blend+min; N/A & Not-Assessed excluded; L, B, P, V recompose; all 7 powers in
  scope, never N/A; no Frontier over a Basic part; display = V×100).

## Revision (GRS-0003 review — "Suggested Changes", 4 Jul 2026)

Acted on the review before ratification. **Defects fixed** (numerically neutral): A1 (D9
regression — unassessed modules no longer zero-fill L), A2 (gate can now reach Basic), A6 (removed
the banned `ev or "E1"` evidence default), A7 (display convention recorded). **Content revised**
(changes B/P/V/triad): B1 (group-weighted B — scale metrics no longer count ~4×), B3 (renamed
`TAKE_RATE_DURABILITY` → `TAKE_RATE_LEVEL`), B4 (metrics and powers now support N/A / Not-Assessed
with renormalisation), B8 (powers carry **Benefit + Barrier**, the weaker gates, and the **triad is
now derived** — Economic/Perceived/Defence). **Governance:** the gate rule, strength encoding, index
comparability, metric grouping, and the Benefit/Barrier+triad model are ADR-0003…ADR-0007
(**now Accepted** and folded into Methodology v1.1 — see Close-out below; the interim N/A-for-powers
proposal was rejected at ratification). C-index (customer proposition) deferred to Methodology v2 /
a new loop, per John.

## Close-out (post-review ratification, GRS-0003 final)

Landed the three ratified decisions and the registry-key normalisation:

- **Powers are never N/A** (Methodology v1.1 §8; ADR-0007 revised). Network Economies and
  Counter-Positioning are re-scored as **real low levels** — Emerging Benefit / **None** Barrier
  each (a retail brokerage has weak referral value and no network lock-in; and it counter-positions
  traditional banks only weakly, with no barrier since banks can and do launch rival digital
  brokerages). Both collapse to strength **None** via Helmer's weaker-side test. P now averages
  over **all 7** powers (no renormalisation), so P **0.380 → 0.271** and V moves accordingly.
- **Triad thresholds** (Wide ≥ 0.85 / Established ≥ 0.55 / Emerging ≥ 0.20) documented in ADR-0007
  as the **anchor-midpoints** of the ADR-0004 strength encoding (nearest-named-level
  discretisation), each band given a falsifiable duration definition (§8).
- **Methodology v1.1 issued** (`docs/ATLAS-Methodology-v1.1.md`), folding in the gate bottleneck
  floor (§5.2a), group-weighted B (§5.3), index-range comparability (§5.4), power strength =
  min(Benefit, Barrier) (§5.4/§8), powers-never-N/A (§8), and the derived triad (§2/§8). ADR-0003…
  ADR-0007 promoted **Proposed → Accepted**. Fixture + generator `methodology_version = "1.1"`.
- **Registry keys** fully qualified to `<MODULE_KEY>_<LEAF>` (GRS-0002a) throughout the fixture.
- **display_convention** is now built from the computed V (no longer a stale hand-typed value).

## Computed headline (Meridian Securities, GRS-0003 final)

| | B | P | L | **V** |
|---|---|---|---|---|
| index [0,1] | 0.679 | 0.271 | 0.484 | **0.4786** |
| display 0–100 | | | | **47.86** |

**Triad (derived, ordinal):** Economic Value **Established** (0.710) · Perceived Value
**Established** (0.550) · Defence Value **Emerging** (0.271). Defence Value is the Barrier aggregate
across **all 7** powers (§2).

Module ratings (two-track — continuous q_m for priority, rule-based gate for the word):

| Module | q_m | Gate | Bottleneck |
|---|---|---|---|
| FRONTEND | 0.445 | Developing | FRONTEND_ACCESSIBILITY_LOCALISATION (Basic) |
| APP_SERVER | 0.620 | Advanced | APP_SERVER_RESILIENCE_DR (Developing) |
| MARKET_DATA | 0.480 | Developing | MARKET_DATA_VENDOR_REDUNDANCY (Basic) |
| ORCHESTRATION | 0.368 | Developing | ORCHESTRATION_EVENT_DRIVEN (Basic) |
| CMS | 0.480 | Developing | CMS_CONTENT_SEARCH_PERSONALISATION (Basic) |
| BACKOFFICE | 0.640 | Advanced | BACKOFFICE_PORTFOLIO_MGMT (Developing) |
| OEMS | 0.410 | Developing | OEMS_EXEC_ALGOS (Basic) |
| EMS_GATEWAY | 0.553 | Advanced | EMS_GATEWAY_CONNECTIVITY (Developing) |
| LIQ_CONNECT | 0.640 | Advanced | LIQ_CONNECT_FOREIGN_BROKERS (Developing) |

Non-score states exercised (subcomponents/metrics only — powers are never N/A):
`OEMS_APIS_COLOCATION` = Not Applicable (dropped from its denominator); `MARKET_DATA_VALUE_ADD_SERVICES`
and `LIQ_CONNECT_FUND_HOUSES` = Not Assessed (never scored, coverage < 1.0, excluded from q_m). No
module is Frontier — each has a Developing/Basic bottleneck, so the headline stays honest.

## ⚠️ Judgement calls to ratify (these are yours)

1. **Subcomponent levels + evidence grades** — the 51 ratings for Meridian. Realistic composite;
   adjust any in the workbook. *(These are the "scores" the loop prompt means.)*
2. **Draft coefficients** (all uniform pending the elicitation panel): α_module = 0.7, α_L = 0.7,
   θ = (B 0.30, P 0.30, L 0.40), critical-modules-for-L = {APP_SERVER, BACKOFFICE, OEMS}, and
   λ/δ/w uniform. These are placeholders; the panel replaces them in GRS-0004.
3. **Power Benefit/Barrier strengths** — the draft levels for the 7 powers, especially the two
   re-scored ones: Network Economies (Emerging / None) and Counter-Positioning (Emerging / None).
   These drive P down to 0.271; confirm the readings or adjust in the workbook.
4. **Power-strength encoding** (feeds the continuous P index only): None = 0, Emerging = 0.4,
   Established = 0.7, Wide = 1.0 — now **ADR-0004 (Accepted)**; the *values* stay
   draft-pending-elicitation. The triad ratings themselves stay ordinal, and the triad band
   thresholds are the midpoints of this encoding (ADR-0007).
5. **The rating-gate rule** — now **ADR-0003 (Accepted)**, Methodology v1.1 §5.2a:
   `band = min(critical-rule ceiling, overall-bottleneck floor)` — a module is never rated above
   its weakest assessed part, and Frontier additionally needs all critical subcomponents Advanced+
   at E3+.

## To ratify

Open the workbook, adjust anything, save, then run
`uv run python scripts/regen_golden_master_json.py`. Re-run `uv run pytest -q` (the consistency
tests must stay green). When you're happy, approve and GRS-0004 (the engine) begins — its
golden-master test will pin these exact numbers.
