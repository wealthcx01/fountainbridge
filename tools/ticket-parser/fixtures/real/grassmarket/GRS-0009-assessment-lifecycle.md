# GRS-0009 — Assessment lifecycle + API

- **Loop:** 2 (see PRD §9)
- **Branch:** `grs-0009-assessment-lifecycle`
- **Status:** In review
- **Normative source:** PRD §3; `docs/ATLAS-Methodology-v1.2.md` §7; ADR-0001/0002/0008.
- **Depends on:** GRS-0004..0008.

## Goal

The backend the Wizard Path A drives: the single intermediate schema, the assessment lifecycle with
finalisation locking, scoped CRUD, a live-score endpoint, and a guidance endpoint.

## What shipped

1. **The single intermediate schema** (`bcap_contracts.assessments`, schema-parity mirrored):
   `AssessmentDocument` — the ONE document BOTH Path A and (later) Path B feed. Partial by design (a
   half-filled document is valid). `MetricEntry` (raw|state + optional confidence), `PowerEntry`
   (benefit/barrier + optional evidence grades), and `SubcomponentRating` (existing).
2. **Lifecycle** (`AssessmentState`: draft → in_progress → finalised): autosave replaces the document
   without scoring; a partial document persists. Finalisation **locks inputs** (a finalised
   assessment refuses edits — `ConflictError`/409) and creates the immutable, content-hashed scoring
   run (GRS-0006). Every stored artifact carries engine / methodology / coefficient / **uncertainty**
   versions (the run's `uncertainty_version` is new).
3. **API** (FastAPI, scoped through the repository only): `POST/GET/PUT /assessments`,
   `GET /{id}`, `POST /{id}/finalise`, `GET /{id}/live-score`. A cross-owner access is a **404** on
   every endpoint (never revealing the resource exists). `GET /guidance/subcomponents/{key}`.
4. **Live-score** (`grassmarket.assessments.service`): completes the partial document to engine inputs
   — every unrated subcomponent and unobserved metric becomes **Not Assessed** (first-class, never
   zero-filled, D9). It "scores what it can": scoreability is checked (L needs a rated core-module
   subcomponent, B needs a metric, P needs all 7 powers) and reported as `blocking` rather than a
   500. When scoreable it runs the deterministic engine + Monte Carlo and returns V/L/B/P bands with
   the ADR-0008 **`modelled` flags** and coverage, so the client labels B/P honestly. The RNG is
   injected per request with a fixed seed (deterministic band, no flicker; never module-global).
5. **Guidance**: returns a subcomponent's four rubric anchors (GRS-0008) **including `todo`** anchors
   — the client shows "guidance not yet authored", never a blank.

## Persistence

`AssessmentORM` (owner-scoped, document stored as JSON so a partial doc saves, version stamps, run
link) + `scoring_runs.uncertainty_version`. **Alembic migration 0002** creates the table and adds the
column; the migration↔models parity test still passes.

## Tests

Partial autosave round-trips without scoring (no run created); finalisation locks (edit-after-
finalise → 409) and creates an immutable run; the live-score endpoint returns a V band with honest
B/P `modelled` flags on a genuinely partial document (and an empty doc is `scoreable:false` with
reasons, no falsely-confident band); **cross-consultant access is refused (404) on GET/PUT/live-
score/finalise/list**; guidance returns `todo` anchors labelled (empty statement), not blank; unknown
subcomponent → 404; unauthenticated → 401.

## Out of scope

The wizard frontend (GRS-0010); Path B meeting intelligence; committee/dual-rater governance. The
`todo`-anchor rendering and honest B/P labelling live in the wizard UI (GRS-0010).
