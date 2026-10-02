# FB-229 — `railway.json` stops working on 2026-12-01

**Status:** Shipped in part — the new file is written and tested; Railway has not been switched to it ·
**Phase:** 3 · **Found by:** the Railway CLI warning while reading the account for FB-228, 2026-09-29 ·
**Branch:** `fb-229-railway-iac` · One ticket = one branch = one PR.

**Shipped in part:** `railway config apply` still has to be run on staging and then production, each
deploy watched, and `railway.json` deleted afterwards in its own pull request. Merging this changes
nothing on Railway, because Railway never reads `.railway/railway.ts` by itself.

## What was found doing it (2026-10-02)

- **Railway does not read the new file when it deploys.** It takes effect only when a person runs
  `railway config apply` against an environment. So "merge, then watch staging deploy from it" is not
  possible: a merge leaves `railway.json` in charge until someone applies.
- **The migration tool's draft was wrong in two ways.** It dropped the builder (left as a comment) and
  the restart policy (gone entirely). And it left out the GitHub source and the variables, which
  Railway reads as "delete them": `railway config plan` against staging showed it would delete all
  eight variables, the sign-in keys among them, and disconnect the service from GitHub.
- **The file in this PR was written by hand** and planned against staging (read only, nothing
  applied): **0 to add, 2 to change, 0 to destroy**, and the only changes are the five settings
  moving in from `railway.json`.
- **The settings stored in Railway itself are not the ones in `railway.json`.** Staging's own service
  settings say builder Railpack with no start command, no health check and no restart policy;
  `railway.json` overrides them at every deploy. So if `railway.json` simply stopped being read on
  2026-12-01, the studio would lose its health check and restart policy without anyone changing
  anything. That is the outage this ticket exists to prevent.
- **Production's variables may differ from staging's.** The `env` list names the variables that exist
  on staging and on the production-forked preview of this PR. Before applying to production, plan
  against it and stop if anything would be destroyed. `docs/deploy.md` has the steps.

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

- [x] `.railway/railway.ts` exists and every value from `railway.json` is present in it, checked
      field by field rather than assumed from the migration's output. (`lib/railway-config.test.ts`
      checks each one by name and fails if either file drifts from the other.)
- [ ] A staging deploy succeeds from the new configuration, and the health check is confirmed to be
      running at `/api/health` rather than assumed. (Not done: it needs `railway config apply` on
      staging, which changes Railway settings and is John's call. The plan against staging is clean.)
- [ ] `railway.json` is deleted, and only after that. (Correctly not done: nothing has applied yet.)
- [x] No deploy setting changed in the same PR.
- [ ] Done before 2026-12-01, and not in the same week as anything else that touches deployment.
      (The apply is what has to happen before 2026-12-01.)

## Verification

The deploy is the thing under test, so the verification is a real staging deploy plus a look at the
running health check — not a green typecheck. **A migration that typechecks and deploys nothing has
proved nothing.**
