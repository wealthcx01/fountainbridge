# FB-229 — `railway.json` stops working on 2026-12-01

**Status:** filed · **Phase:** 3 · **Found by:** the Railway CLI warning while reading the account for
FB-228, 2026-09-29 · One ticket = one branch = one PR.

## The fact

`railway` now prints, on every command:

```
warning: Config as Code (railway.json / railway.toml) is deprecated. Prefer Infrastructure as Code
(.railway/railway.ts). Run `railway config migrate`
  Existing files keep working until 2026-12-01.
```

We have a `railway.json` at the repository root. It carries the studio's builder, its start command, its
health-check path and timeout, and its restart policy.

## Why it matters, and why it is not urgent

**It is the studio's deploy configuration.** If it stops being read, the deploy falls back to whatever
Railway infers, and the two specific things worth naming are the ones a default would not get right:

- `healthcheckPath: /api/health` — without it a broken deploy can be marked healthy.
- `restartPolicyType: ON_FAILURE` with 3 retries.

A silent change to either is the kind of fault that shows up as "the studio was down and nobody knew",
which is what non-negotiable 10 exists to prevent.

**Two months is plenty**, and that is exactly why this is filed rather than done in the middle of
something else. Doing it now, alongside other work, is how a deploy configuration gets changed without
anyone watching the deploy.

## Scope

- `railway config migrate`, then read what it produced rather than trusting it. The output is
  `.railway/railway.ts` — TypeScript, so it is checked by the same typecheck the rest of the repo runs.
- Confirm every value survived: builder, start command, health-check path **and timeout**, restart policy
  and its retry count.
- Deploy to **staging** and watch it, before production. The studio has a staging environment and this is
  what it is for.
- Delete `railway.json` only once a staging deploy has succeeded from the new file. Two sources of deploy
  configuration is worse than an old one.

## Out of scope

- Changing any deploy setting while migrating. A migration that also tunes the health check is two changes
  and one of them will be blamed for the other.
- The venture projects' configuration. `arca` has no `railway.json` in this repo; if it has its own, that
  is its repository's ticket.
- FB-228's ephemeral environments. Related only in that both were found reading the same account.

## Acceptance criteria

- [ ] `.railway/railway.ts` exists and every value from `railway.json` is present in it, checked
      field by field rather than assumed from the migration's output.
- [ ] A staging deploy succeeds from the new configuration, and the health check is confirmed to be
      running at `/api/health` rather than assumed.
- [ ] `railway.json` is deleted, and only after that.
- [ ] No deploy setting changed in the same PR.
- [ ] Done before 2026-12-01, and not in the same week as anything else that touches deployment.

## Verification

The deploy is the thing under test, so the verification is a real staging deploy plus a look at the
running health check — not a green typecheck. **A migration that typechecks and deploys nothing has
proved nothing.**
