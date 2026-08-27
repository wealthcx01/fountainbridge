# FB-136 — The admin ledger: every venture, one screen

**Status:** Todo · **Area:** Studio / admin · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 10; `screens/01-All_ventures_admin.txt`.

## Why this matters (for John)

Every other ticket in this set is for a founder. This one is for the person running the portfolio, and
its question is: **where is a venture stuck, and is it stuck on its founder or on its engine?**

> A row is amber when its founder is the bottleneck, red when its engine is.

That is the whole design. One glance, and the thing needing attention is coloured by *whose* attention
it needs.

## What is true today

`lib/authz.ts` already distinguishes admin from founder: an admin gets every venture, a founder gets
theirs. `STUDIO_ADMIN_EMAILS` carries the admin list. There is no all-ventures view; an admin picks a
venture and sees a founder's board.

## Scope

- A ledger at `/` for admins: **Venture · Founder · Needs them · Underway · Engine · Spend, month · action**.
- Amber when the founder is the bottleneck; red when the engine has stopped; red when spend is over.
- **"Open as founder"** — the founder's exact desk, with a persistent "← All ventures" strip and the
  line *"You are seeing exactly what this founder sees."* Not an approximation: the same components,
  the same data path, so an admin diagnosing a founder's problem is looking at the founder's problem.
- Three footnotes the design specifies, because they are the portfolio's real health:
  - **Wiring** — a venture whose composer key is unset, named, before its founder is invited.
  - **Founder response time** — median from needs-you to decided.
  - **Onboarding** — which account is the template for provisioning the next founder.

## Out of scope

- Acting on another venture from the ledger. An admin opens the desk and acts there, through the same
  gates as its founder.
- Cross-venture aggregation beyond this table — that is Holy Corner's job, per D5.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/authz.test.ts
make design-lint && make ticket-drift
```

Both roles, on production:

```
# admin at /            → the ledger
# founder at /          → straight to their own desk, never the ledger
```

## Acceptance criteria

- [ ] Admins see the ledger at `/` with all seven columns.
- [ ] A founder never sees it — they land on their own desk, asserted by a test.
- [ ] Amber marks a founder bottleneck, red an engine stop or an over-budget surface.
- [ ] "Open as founder" renders the founder's exact desk, from the same components and data path, with
      a persistent way back.
- [ ] The wiring footnote names any venture whose composer key is unset.
- [ ] Response-time and onboarding footnotes render from real data or say they have none.
