# FB-003 — Venture manifest format + ARCA and the-reset manifests

**Phase:** 0 · **Depends on:** FB-001, FB-002 · **Repo:** fountainbridge
**Branch:** `fb-003-venture-manifest` · One ticket = one branch = one PR.

## Context
Venture-as-config is the discipline that keeps the studio generic (B2C founders first; B2B bank-sponsored wealth products later must be "just another manifest"). A manifest declares a venture's VPS, founder identity, repos, lanes, departments, and connectors, validating against the `Venture` contract from FB-002.

## Scope
- `ventures/` directory: one YAML per venture, schema-validated against bcap-contracts `Venture` (loader + `make validate-manifests` CI step).
- **`ventures/the-reset.yaml`** — the **launch venture** (D5 revised: Reset is in the studio from Phase 1): founders John + Ross with venture-domain Workspace identities, repos (platform app + marketing site per its own roadmap: "Platform v0.1 read-only dashboard"), departments engineering + GTM (gate: ActiveGraph per research doc), VPS fields filled by FB-011.
- **`ventures/arca.yaml`** — secondary fixture manifest: ARCA's real repo, lanes, and queue, with John as "founder"; used to test scoping, parser tolerance, and breaking changes before they hit Reset's view.
- `ventures/example-venture.yaml` documenting every field inline — the template for future onboarding (Tier 3 pipeline: CANON next-most-likely).
- `docs/manifest.md` — how to add a venture, field semantics, validation, the generic/B2B posture rules (nothing venture-specific in studio core).

## Out of scope
Reading manifests from the studio (FB-006); provisioning (FB-011).

## Acceptance criteria
- [ ] Both real manifests validate in CI; a deliberately broken fixture fails CI with a useful error.
- [ ] Example manifest documents all fields; docs/manifest.md complete.

## Verification
/review + /qa; validation run output attached to PR.
