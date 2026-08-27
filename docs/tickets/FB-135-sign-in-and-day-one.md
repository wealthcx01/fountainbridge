# FB-135 — Sign in, and a founder's first morning

**Status:** Todo · **Area:** Studio / onboarding · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screens 1 and 2; `screens/00-Sign_in.txt`, `03-Day_one.txt`.

## Why this matters (for the founder)

These are the two screens a founder meets before they trust anything, and both are currently
operator-shaped.

**Sign in** needs one sentence covering both doors: *"Sign in with your venture account: Google, or
the email and password you were given."* Google primary, email and password secondary. Both exist and
work today — the founder account signs in with either, proven 2026-08-27.

**Day one** is the harder one. A venture with nothing in it must not look broken. The design gives it
a greeting, exactly one action — *"Tell the studio what you want →"* — and a short "What will be here"
list, so an empty studio reads as ready rather than as failed:

> The office: your agents, live, at their desks.
> Tickets: everything you have asked for, each one followable to where it changed things.
> A queue that counts only what waits on you.

## What is true today

Both sign-in doors work: Google OAuth and `STUDIO_PASSWORD_LOGINS` (scrypt, per-account). `boardState`
already computes `first-run`, and `components/FirstRun.tsx` renders it (FB-066).

The admin ledger's own footnote is the warning this ticket answers: *"Caldera's composer key is not
set; its founder meets a dead button on day one. Fix before invite."* Day one is exactly where a
half-provisioned venture shows, and it must say so rather than offer a control that does nothing.

## Scope

- Restyle `/login` into the hairline system. One sentence, both doors, Google primary. No behaviour change.
- Day one, driven by the existing `boardState === 'first-run'`: greeting, the single action, the list.
- **A venture that is not fully wired says so on day one.** If the composer key is missing, the primary
  action explains that rather than failing on press.

## Out of scope

- Any change to authentication. Both doors work; this is a restyle.
- Provisioning. This surfaces an unwired venture; fixing it is the provisioning runbook's job.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/authz.test.ts     # scoping must be untouched
make design-lint && make ticket-drift
```

Both doors, on production, before review:

```
# Google, as an admin  → all ventures
# email + password, as arca.founder@bruntsfield.capital → ARCA only
```

## Acceptance criteria

- [ ] `/login` matches the design; both doors still work, unchanged.
- [ ] A first-run venture shows the greeting, exactly one action, and the "What will be here" list.
- [ ] A venture with no composer key says so on day one instead of offering a control that fails.
- [ ] Scoping is unchanged: admin sees every venture, a founder sees theirs.
- [ ] Both doors driven on production before the PR is opened.
