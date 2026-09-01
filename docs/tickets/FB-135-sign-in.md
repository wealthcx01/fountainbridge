# FB-135 — Sign in

**Status:** Done · **Area:** Studio / onboarding · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 1; `screens/00-Sign_in.txt`.

*(Day one was originally in this ticket. It is now FB-143 — it is the venture's whole first
impression and the only screen whose job is to make absence feel deliberate, and bundling it with a
restyle meant the harder half got whatever attention the easier half left.)*

## Why this matters (for the founder)

The screen before anyone trusts anything. It has to say, in one sentence, that both doors lead to the
same place:

> **Sign in with your venture account: Google, or the email and password you were given.**

Google primary, email and password secondary. Both work today — proven on production 2026-08-27, as
an admin through Google and as `arca.founder@bruntsfield.capital` through the password door.

## What is true today

Both doors work. Google OAuth, and `STUDIO_PASSWORD_LOGINS` (scrypt per account, `lib/password-login.ts`,
with a per-email throttle). The page is functional and operator-shaped.

## Scope

- Restyle `/login` into the hairline system: wordmark, the one sentence, Google primary, email and
  password secondary, the Edinburgh footer line.
- **No behaviour change of any kind.** This is the studio's front door and the one screen where a
  cosmetic change that breaks a login locks a founder out of everything.

## Out of scope

- Day one — FB-143.
- Any change to authentication, throttling, or the accounts allowed. If sign-in needs to change, that
  is its own ticket with its own care.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/password-login.test.ts lib/__tests__/authz.test.ts
make design-lint && make ticket-drift
```

Both doors, on production, before review — a restyle that breaks a door is worse than no restyle:

```
# Google, as an admin                            → all ventures
# email + password, as the ARCA founder account  → ARCA only
# a wrong password                               → still refused, still throttled
```

## Acceptance criteria

- [x] `/login` matches the design: wordmark, one sentence covering both doors, Google primary, the
      Edinburgh line at the foot.
- [x] Both doors still work, and the tests covering them pass unchanged — `password-login.spec.ts`
      and `auth.spec.ts` are untouched, and 32 unit tests across `password-login` and `authz` pass.
- [x] A wrong password is still refused and still throttled.
- [x] Both doors driven against the real configuration before the PR was opened. See below.

## Driven before the PR, against the real configuration

Not against the fixture rig: the restyled build was run locally with **the service's own
environment** — the real Google client, the real `STUDIO_PASSWORD_LOGINS` scrypt hash, and the write
credential removed.

| | |
| --- | --- |
| The sentence | *"Sign in with your venture account: Google, or the email and password you were given."* |
| The footer | *"A Bruntsfield Capital venture · Edinburgh"* |
| Visible wordmarks | **1** — the top bar's is hidden here |
| Test door | **absent**, as it must be wherever `E2E_TEST_LOGIN` is unset |
| Google | fires with the real client, `redirect_uri=http://localhost:3100/api/auth/callback/google` |
| Wrong password | `/login?error=password`, the generic message shown, no session — `/venture/arca` still bounces to `/login` |
| Right password | signs in, lands in ARCA, the rail is there |
| Another venture | refused |
| Signed in, `/login` | redirects to `/venture/arca` |

**The one hop that cannot be driven off production** is Google's final callback: the local
`redirect_uri` is not on that client's allowlist, so Google answers with its own error page. That
proves the button starts the flow with the right client and the right callback shape; only the
deployed domain can complete it. Driven there after the deploy — recorded below.

## Two guards that asserted nothing, caught before they shipped

- *"one wordmark"* counted elements. The top bar's is still in the document, hidden — so it counted
  two and would have counted two whether the rule worked or not. It counts **visible** ones now.
- *"the fields have a border"* passed with the rule deleted, because every input has one from the
  browser. FB-150's actual defect is an undefined custom property invalidating the declaration
  silently, so the check now asserts the border is **the token, resolved** — watched go red against
  `var(--color-rule-that-does-not-exist)`.
