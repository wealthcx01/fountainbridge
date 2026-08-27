# FB-135 — Sign in

**Status:** Todo · **Area:** Studio / onboarding · **Depends on:** FB-124
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

- [ ] `/login` matches the design: one sentence covering both doors, Google primary.
- [ ] Both doors still work, and the tests covering them pass unchanged.
- [ ] A wrong password is still refused and still throttled.
- [ ] Both doors driven on production before the PR is opened.
