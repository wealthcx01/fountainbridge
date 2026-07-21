# GRS-0032 — Hardening + compliance

- **Loop:** 6
- **Branch:** `grs-0032-hardening-compliance`
- **Status:** In review

## Delivered vs accepted-risk (see ADR-0021)

- **Delivered + tested:** append-only audit log covering every listed event class (admin-only); GDPR
  export (complete owned-data bundle, reflection-driven so no table is missed) and erasure
  (personal data removed, consultant anonymised, immutable scoring runs kept but de-identified —
  anonymisation-not-deletion). Encryption-at-rest (GRS-0029), absolute scoping (#9), fail-loud,
  bcrypt, and production-secret refusal are already in place.
- **Accepted risks (explicit, per exit criterion), fast-follows before the cohort scales:** MFA
  (TOTP) — launch is invitation-only to a small trusted cohort over JWT+bcrypt; app-level rate
  limiting — Railway edge covers network-level. Both are scoped, not launch blockers for the initial
  group. Security review ran as a fresh-context adversarial pass on this branch (findings addressed).
- **Normative source:** PRD §2; Viewforth PRD §3 (inherited data-protection standards); CLAUDE.md #6, #9.
- **Depends on:** all prior feature tickets (final-pass ticket before launch).

## Goal

Production-grade security and compliance posture.

## Scope

1. MFA (TOTP), policy: recommended for all, required for Certified Leads and committee members.
2. Comprehensive append-only audit logging: auth events, scoring finalisations, deliverable generations + downloads, committee decisions, certification overrides, commission-config changes.
3. Rate limiting on auth and generation endpoints; session/inactivity policies.
4. GDPR export (complete scoped bundle per person) and deletion workflow. Deletion vs scoring-run immutability is reconciled by **anonymisation-not-deletion** of immutable runs — document as an ADR.
5. Dependency audit + secret-scan review; run `/security-review`; findings fixed or ticketed with accepted-risk rationale.

## Exit criteria

- Security review clean or risks explicitly accepted in writing.
- Audit log covers every listed event class (tested).
- GDPR export produces a complete scoped bundle; deletion request leaves no personal data outside anonymised immutable runs (tested).
- Full gate green; CI green.
