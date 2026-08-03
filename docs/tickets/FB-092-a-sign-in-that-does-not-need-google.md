# FB-092 — A sign-in that does not need Google

**Status:** In review · **Phase:** 0/3 (auth) · **Asked for by:** John, 2026-08-03 — *"the dummy
account doesnt work because of the google OAuth. We should have a seperate login where you can
choose either google login or nomal email to Foundry Studio."* · **Repo:** fountainbridge ·
**Branch:** `fb-092-a-sign-in-that-does-not-need-google` · One ticket = one branch = one PR.

## The problem

FB-090 created `arca.founder@bruntsfield.capital` precisely so the founder experience could be
judged through a founder's eyes. The account works — the scoping table in that ticket is measured
output. But it was measured with the E2E credentials provider against a production *build*, not by
signing in to the production *deployment*: there, Google OAuth is the only door, and John cannot
complete the Google flow for the walkthrough account. The account that exists to test the studio
cannot get into the studio.

So the studio gets a second door: email + password, offered on the same login page under the Google
button. Google remains the primary provider and the Holy Corner pattern (D4); nothing about it
changes.

## What this is NOT

Not self-serve authentication. There is no signup, no password reset, no user table, no sessions
database. An account exists exactly when a Bruntsfield admin puts an `email=hash` entry into
`STUDIO_PASSWORD_LOGINS` on the deployment. Removing the entry (or unsetting the variable) removes
the door; unset, the form does not even render and the login page is byte-for-byte what it was.

This is deliberately the same shape as `STUDIO_ADMIN_EMAILS`: a small, explicit, env-configured
allowlist, auditable at a glance.

## Hardening, itemised

Auth is high-blast-radius under D7, so the security properties are stated and each one is tested:

- **No plaintext anywhere.** The env holds scrypt hashes (N=16384, r=8, p=1 — OWASP interactive
  cost, parameters encoded per-entry so they can be raised without invalidating existing entries).
  The mint script reads the password from stdin — never argv, where it would land in shell history —
  and refuses passwords under 12 characters.
- **No user enumeration.** An unknown email burns the same scrypt work as a wrong password against
  a decoy hash minted at boot, and both fail into the one generic Auth.js error. The login page
  shows a single message for every failure mode, on purpose.
- **Online guessing throttled.** Five failures on an email pauses that email for fifteen minutes —
  even for the right password, and unknown emails burn budget too, so probing is never free.
  In-memory is sufficient: the studio is one long-running server (D6 as amended), and the throttle
  defends online guessing, not a stolen hash.
- **A corrupted env value cannot hurt.** `verifyPassword` never throws; hash parameters are
  bounded so a malformed entry cannot make the server allocate gigabytes; a malformed entry is
  skipped with a warning that names its **position and never its content** — the likeliest typo is
  a plaintext password pasted where a hash belongs, and a log line is the last place it should
  surface (CLAUDE.md #8 in spirit, #10 in behaviour).
- **The door grants identity, nothing else.** Venture scoping stays lib/authz on the email,
  server-side, per request (CLAUDE.md #6). The e2e suite proves it through this door specifically:
  ARCA's founder signs in with a password, lands on ARCA, and is refused `the-reset` server-side.
- **The E2E provider is untouched** and stays production-inert (no secret → refuses).

## Scope of this pull request

- `lib/password-login.ts` — parse, hash, verify, throttle, authorize; every rule above lives here
  as a pure, tested function.
- `auth.ts` — a `password` Credentials provider, present only when at least one account parses.
- `app/login/page.tsx` — the form (only when enabled), and a plain-language failure message; the
  page previously showed nothing at all on a failed sign-in.
- `scripts/mint-password-login.mjs` — mints `email=hash` entries; a unit test runs the script and
  verifies its output against `verifyPassword`, so the two cannot drift apart silently.
- `.env.example` documents `STUDIO_PASSWORD_LOGINS` (named there for the FB-087 reason: an
  undocumented variable is how a surface stays broken for weeks).
- e2e: `password-login.spec.ts` drives the real form against a production build — form renders,
  wrong password refused with no session, founder scoped identically to Google, unlisted email
  refused.

## Explicitly NOT in this pull request

- Password reset, signup, or any storage beyond the env var.
- Setting the production variable. That is a human step on Railway, deliberately (CLAUDE.md #8):
  mint locally, paste the hash entry, redeploy.
- 2FA. If password accounts outlive the walkthrough phase, that conversation should happen.

## Acceptance criteria

- [x] With `STUDIO_PASSWORD_LOGINS` unset, the login page renders exactly as before and no
      password provider exists.
- [x] A configured account signs in and is scoped by lib/authz identically to Google.
- [x] Unknown email and wrong password produce the same generic failure.
- [x] Five failures pause the email for fifteen minutes, right password included.
- [x] A malformed env entry is skipped, warned by position only, and never crashes the studio.
- [x] A minted entry from the script verifies against the library (tested, not assumed).

## Verification

Unit suite covers parse/verify/throttle/authorize and the script-library lockstep. The e2e suite
drives the production build's real login form through success, refusal, and isolation. CI green on
the PR. Production verification happens after merge: set the variable on Railway, sign in as
`arca.founder@bruntsfield.capital`, and confirm the FB-090 scoping table holds through this door.
