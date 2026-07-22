# FB-014 — Founder identity: shared Bruntsfield Workspace until spin-out (D3 amendment)

**Phase:** 0 (config/decision) · **Depends on:** FB-003 · **Repo:** fountainbridge
**Branch:** `fb-014-founder-identity-model` · One ticket = one branch = one PR.

## Context
John clarified the founder-identity model (2026-07-22). Founders do **not** sit on per-venture
domains yet — until a venture spins out, every founder's primary identity is on the **shared
Bruntsfield Google Workspace** (`@bruntsfield.capital`). Each founder still gets their own Hetzner
VPS + development lane (D1 unchanged). This amends **Decision D3**, whose earlier wording put each
founder on a venture-specific domain (e.g. `ross@thereset.com`).

Note: `john.gallagher@wealthcx.com` is an **alias** of `john@bruntsfield.capital` (same Google
account; wealthcx.com is a legacy domain). The studio's Google OAuth client is **Internal** to the
Bruntsfield Workspace, so sign-in returns the primary `@bruntsfield.capital` address.

## Scope
- `ventures/the-reset.yaml`: `founder.workspace_email` → `ross@bruntsfield.capital`.
- `ventures/arca.yaml`: `founder.workspace_email` → `john@bruntsfield.capital` (arca's founder is John).
- Amend **D3** in `docs/fountainbridge-phased-plan.md` and the auth note in `CLAUDE.md` to describe
  the shared-Bruntsfield-Workspace-until-spin-out model.
- Deployment: `STUDIO_ADMIN_EMAILS` set to `john@bruntsfield.capital` (+ the wealthcx alias) on the
  Railway production + staging environments.

## Out of scope
- Per-venture domain migration on spin-out (handled when a venture actually spins out).
- The Google OAuth client / consent screen (created by John, Internal).

## Acceptance criteria
- [x] Both real manifests validate against the Venture contract with the new emails (D3 no-personal-mailbox guard still passes).
- [x] D3 amended in the plan + CLAUDE.md; the change is dated and traceable.

## Verification
manifest-validate (CI) + /review.
