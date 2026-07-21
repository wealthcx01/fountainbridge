# GRS-0042 — Close the invitation privilege-escalation hole

- **Loop:** 0 (auth + scoping)
- **Status:** CRITICAL — found in the 2026-07-14 adversarial security review.
- **Severity:** Critical (privilege escalation → complete multi-tenant scoping breach).
- **Normative source:** CLAUDE.md #9 (data scoping is absolute), #3 (fail loud); PRD §2 (invite-only signup).

## Problem

`POST /auth/invitations` is guarded only by `get_current_principal` — any authenticated
consultant, not an admin. The request body (`CreateInvitationRequest`) lets the caller choose
`role` (including `Role.ADMIN`) and `tier`, and the raw invite token is returned directly in the
HTTP response. Neither the router, `AuthService.create_invitation`, nor `Repository.create_invitation`
checks the inviter's role.

**Exploit:** an ordinary consultant calls `POST /auth/invitations` with
`{"email":"burner@x.com","role":"admin"}`, gets the raw token back, redeems it via
`POST /auth/accept-invitation`, and logs in. The resulting JWT carries `role: admin`, so every
scoped read short-circuits `_assert_can_access` (`if principal.is_admin: return`) — the attacker
now reads and mutates every other consultant's pipeline, engagements, earnings, assessments,
scoring runs, transcripts, and the audit log. The entire ownership model rests on the JWT `role`,
and the invite flow let an unprivileged user forge that role via a legitimately-signed token.

## Change

1. **Service:** `AuthService.create_invitation` takes the inviter's `Role` and fails loud
   (`ForbiddenInvitationError`) when a non-admin tries to grant any `role != CONSULTANT` or any
   `tier` other than the default entry tier. An admin may grant anything.
2. **Router:** pass `principal.role`; map `ForbiddenInvitationError` → HTTP 403.
3. **Regression test:** a consultant inviting `role=admin` (or an elevated tier) is refused 403;
   an admin inviting an admin succeeds; a consultant inviting a default consultant still succeeds.

## Exit criteria

- A non-admin cannot mint an invitation for any elevated role or tier (403, fail loud).
- Admins retain full invitation capability.
- Tests pin all three paths; the existing accept/login flow is unchanged.
