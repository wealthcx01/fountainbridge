# GRS-0148d — Self-service change-password + real Profile (ADR-0036 Item 2)

**Status:** Implemented (2026-07-19).
**Loop:** Part 2 — stress-test remediation (finish & trust)

## Why

Three personas — the compliance-anxious IFA most of all — flagged that `/profile` and `/settings`
were "coming soon" with **no way to change your password**, an immediate trust gap for a regulated
firm handling client data. This ships the one account control every live product owes.

## What changed (5 thin layers, each templated by existing auth code)

- **Contract** (`bcap_contracts/auth.py`): `ChangePasswordRequest` — `current_password` (min 1) +
  `new_password` (min 12, the same floor as signup).
- **Audit** (`bcap_contracts/audit.py`): `AUTH_PASSWORD_CHANGED` — a recorded, non-silent change (#3).
- **Repository** (`set_consultant_password`): persistence-only mutation of the password hash, fail
  loud if the row is missing (#5).
- **Service** (`AuthService.change_password`): verify the current password via `verify_password`,
  refuse an OAuth-only account (no password to change) or a wrong current password with
  `InvalidCredentialsError`, hash the new one, record the audit event.
- **Router** (`POST /auth/change-password`): self-scoped (`get_current_principal`); maps
  `InvalidCredentialsError` → 401, mirroring login; 204 on success.
- **Frontend** (`api.changePassword` + a real change-password card on `/profile`): current / new /
  confirm fields, a client-side 12-char + match check, and success/error banners.

## Acceptance
- A signed-in advisor changes their own password; the old one 401s, the new one logs in; a wrong
  current password → 401; a new password under 12 chars → 422; unauthenticated → 401. Golden master
  untouched; 787 backend tests + schema sync + frontend build/tests + ruff/pyright green.
