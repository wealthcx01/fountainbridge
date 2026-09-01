# FB-136 — The admin ledger: every venture, one screen

**Status:** Done · **Area:** Studio / admin · **Depends on:** FB-124
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

- [x] Admins see the ledger at `/` with all seven columns.
- [x] A founder never sees it — they land on their own desk, asserted by a test.
- [x] Amber marks a founder bottleneck, red an engine stop or an over-budget surface.
- [x] "Open as founder" renders the founder's exact desk, from the same components and data path,
      with a persistent way back. It is literally `/venture/<id>` — no admin variant of anything —
      plus a strip carrying "← All ventures" and *"You are seeing exactly what this founder sees."*
      Shown only when the viewer is **not** that venture's founder: John opening his own venture is
      not viewing as a founder, he is the founder.
- [x] The wiring footnote names any venture whose composer key is unset, and names the variable so
      the fix is copy-pasteable.
- [x] Response-time and onboarding footnotes render from real data or say they have none. Both had
      to be re-derived — see below.

## Two colours the design does not name, and the studio cannot do without

The design gives amber and red. Two more states are real:

- **Unknown.** A venture whose reads failed is not calm. Painting it green is the studio reporting
  health it never checked (CLAUDE.md #10), on the one screen used to decide where to look.
- **Idle.** Nothing waiting and nothing moving is a fact about a venture, not a fault in it, and
  colouring it like work-in-progress would hide the ventures that have genuinely stalled quietly.

And **red beats amber** when both apply: a stopped team with six decisions queued behind it is not a
slow founder, it is a venture that cannot proceed even if they decide.

## The two footnotes that had no data

**Response time.** The design asks for *"median from needs-you to decided"*. Nothing in the studio
records when something *started* needing a founder — an approval carries `grantedAt` and no
proposed-at; a decided pull request keeps no trace of how long it sat. So the footnote reports what
IS knowable, named for what it measures — *"6 things waiting on founders, the middle one for 3
days"* — and says the other half is not recorded. Filed as **FB-159**.

**Onboarding.** The design names one account: *"The Arca account is the template."* That is a
decision somebody made, not a fact in any manifest, and hard-coding a venture into the studio core
is exactly what CLAUDE.md #5 forbids. So the footnote reports what is derivable — which ventures
have a founder account, a machine and a working key, and are therefore complete enough to copy.

## Two defects found by building it

- **The fallback table shared the real table's test id**, which is FB-158's lesson repeated on the
  first attempt. It put two seven-column tables in the document while the boundary resolved.
- **`.sr-only` escapes a scroll container.** It is `position: absolute` with no positioned ancestor,
  so its containing block is the document: laid out at its static position inside a table scrolled
  120px right, it sits 120px past the window and **adds that to the page's own scroll width**. The
  ledger scrolled a 393px phone sideways by 92px while the scroll container was working perfectly.
  `.table-scroll` is `position: relative` now — a scroll container should be the containing block
  for what it contains. This affected the Memory table too; it only never showed because four
  columns fit.

## Read against the real portfolio

Run locally with the service's own environment — real manifests, real records, the write credential
removed, the founder account promoted to admin so the ledger could be read at all:

```
ttfb          52 ms  (the shell, before any row)
summary       3 ventures: 1 waiting on its founder, 1 could not be read.

  arca                  amber   6 waiting on John Gallagher · 15 underway · £0/£5,800
  modernisation-engine  green   its team is on 1 ticket
  the-reset             unknown its records could not be read

wiring        Every venture is wired to its own machine.
waiting       6 things waiting on founders, the middle one for 14 days.
onboarding    Provision the next founder from ARCA — it has a founder account, a machine
              and a working key.
as founder    ← All ventures · You are seeing exactly what THE RESET's founder sees.
phone         the page does not drag sideways at all
```

**On production, as ARCA's founder:** `/` goes to `/venture/arca`, the ledger is not in the document,
and the as-founder strip is absent — they are the founder, not someone looking at one.

## A third thing the reading caught

The Engine column read `—` for every venture, because the row collapsed `EngineState.unknown` into
the same absence as a read that failed. They are different facts: *"your team is not working on this
venture yet"* is a sentence the studio owns and a founder needs. The row's engine is `null` only when
the read failed; everything else carries the engine's own words.

The guard for it was **vacuous on the first attempt** — asserted against ARCA, whose fixture engine
has checked in, so it passed with the collapse restored. It asserts `the-reset`, whose engine never
has, which is the state in question.
