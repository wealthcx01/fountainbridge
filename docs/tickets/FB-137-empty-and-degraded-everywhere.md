# FB-137 — Every screen tells the truth when it has nothing, or cannot read

**Status:** Done · **Area:** Studio / honesty · **Depends on:** FB-128, FB-129, FB-130, FB-131, FB-132, FB-133, FB-134, FB-135, FB-136, FB-143
**Design:** `docs/design/foundry-desk/` — the `firstrun`, `degraded`, `*Empty` states throughout; the
wireframe's own props expose `degraded` as a switch precisely so every screen can be checked in it.

## Why this matters (for the founder)

This is CLAUDE.md #10 made into a screen-by-screen obligation: *"A founder blocked at 22:00 must see
why in the studio — run reports, lane staleness and failure states surfaced in plain language, never
swallowed."*

Two states, on every screen, and they are different things a founder must never confuse:

- **Empty** — there is genuinely nothing. *"No runs yet. The engine wakes when there is a ticket to
  work; every wake will be written down here."* An invitation, not an apology.
- **Degraded** — we could not read. *"GitHub is rate-limiting reads from arca-site; this desk fills in
  as reads succeed. Nothing for you to do; it clears on its own."*

A blank panel that could mean either is the failure. It teaches a founder that empty means broken, and
after that they stop believing the full panels too.

## What is true today

`lib/tickets.ts` already distinguishes `no-credentials` / `unreadable` / `rate-limit` / `error`
(FB-021) — the hard part is done and mostly unused. `components/FirstRun.tsx` and `BoardUnreadable`
exist. `lib/runreports.ts` separates `unknown` (no checks exist) from `unavailable` (could not find
out), which is the same distinction one level down.

It is applied unevenly, which is why this is one ticket rather than a line in ten.

## Scope

- Every screen from FB-128 to FB-136, and FB-143's day one, gets both states, with the design's copy.
- **The degraded strip is grouped by cause and sits below anything the founder must act on.** A
  rate-limit notice above the blocker banner is a studio telling a founder about its own problems
  before theirs.
- **Nothing invented in either state.** No zero standing in for unknown, no dash that reads as nought.
- A degraded read never blanks a panel that had data a moment ago — it fills in as reads succeed.
- Both states are **testable on demand**, not only when GitHub happens to fail. The wireframe has a
  `degraded` switch; the studio needs the equivalent so this can be checked in CI and by eye.

## Out of scope

- Fixing the causes. This is about saying what is true while they happen.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift
```

Every screen, in three states, by eye — the checklist goes in the PR:

```
# 1. populated   2. genuinely empty   3. reads failing
```

## What the switch found

`E2E_FAIL_READS` fails named reads at **read time** — inside whatever the loader catches — gated on
the same `E2E_TEST_LOGIN` that already turns the studio into a rig. With `all` set, before any fix:

| Screen | | |
| --- | --- | --- |
| the ledger | 200 | honest — *"3 ventures: 3 could not be read"* |
| **the desk** | 200 | **rendered nothing at all** |
| **tickets** | **500** | crashed |
| **what happened** | 200 | **nothing at all** |
| **memory** | 200 | **nothing at all** |
| **needs you** | **500** | crashed |
| the composer, the handbook | 200 | fine — they read nothing |
| the rail, everywhere | | **`£0/£4,800`** for a venture whose spending it had not read |

Three blank pages and two crashes, on the studio's own promise that a founder blocked at 22:00 sees
why. None of it was visible to any gate, because the degraded half only ever appeared when a code
host was having a bad day.

### The root cause of five of them

Three loaders — `loadVentureTickets`, `loadVentureAttention`, `loadVentureHealth` — `Promise.all`
over a venture's repositories and let a **throwing** fetcher reject the lot. Each already has an
error shape (`lane.error`, `RepoPrs.error`, `RepoHealthRaw.error`) and both shipped fetchers use it,
so nothing had ever thrown — until something did. One unreadable repository cost the founder the
other two, and the page.

## Empty and degraded were being said together

With every read failing, four screens said **both**, and put the *invitation* first:

```
tickets   "No tickets yet. The first one your team files lands here."   ⚠ part could not be read
activity  "Nothing yet. Everything your venture does gets written down here."   ⚠ …
memory    "Nothing handed over yet."                                     ⚠ …
routines  ⚠ …                                          "No recurring work yet."
```

The empty state tells a founder their venture is a blank page. Over a failed read that is a claim
with no evidence — and the most reassuring one the studio can make. `panelState` in
`lib/read-failures.ts` is now the one rule: **content wins; otherwise unreadable replaces empty.** It
was a condition in five places and four of them were wrong.

## The three-state checklist

Every screen, driven by hand in each state, and the words read.

| Screen | Populated | Genuinely empty | Reads failing |
| --- | --- | --- | --- |
| the ledger | rows, tones, footnotes | *"3 ventures, and nothing is stuck."* | *"3 ventures: 3 could not be read"*, every row `unknown` |
| the desk | board, brief, budgets | day one — *"Welcome, John. Nothing has happened yet, which is exactly right for day one."* | *"could not read this venture, so this page is empty — that is not the same as nothing having happened"*, naming each repository |
| tickets | list + detail | *"No tickets yet…"* + *"The queue is clear."* | filters read `—`, one apology, no invitation |
| what happened | 40 rows + summary | *"Nothing yet. Everything your venture does gets written down here…"* | one strip naming what failed; the invitation gone |
| memory | table + provenance | *"Nothing handed over yet."* + the invitation | apology, no summary sentence, Add still offered |
| recurring work | routines with tones | *"No recurring work yet…"* | apology only |
| needs you | queue, oldest first | *"Nothing is waiting for you."* | count reads `—`, *"it is not that nothing is — it is that it could not look"* |
| the composer | thread + rail | *"Nothing yet. Describe what you want…"* | unaffected — it reads nothing |
| the handbook | 9 chapters | n/a | unaffected — it reads nothing |
| the rail | numbers | `not set` per department | `checking`, no badge, **no £ figure** |

FB-143's day one is listed as a dependency and is not built; the desk's existing first-run screen is
what appears in the middle column above, and FB-143 carries its own states when it lands.

## Acceptance criteria

- [x] Every screen FB-128…FB-136 has a distinct empty state and a distinct degraded state. FB-143 is
      not built; noted above.
- [x] Empty reads as an invitation; degraded says what failed, in plain words, and that it clears
      itself.
- [x] The degraded strip groups by cause and never sits above something the founder must act on.
- [x] No screen renders a zero, a dash or a blank where the honest answer is "we could not read".
      The four that did — the rail's `£0`, the attention count, the ticket filters, the ledger's
      `not set` — say so now.
- [x] Degraded state can be induced deliberately, and `e2e/degraded.spec.ts` asserts every screen
      renders something truthful in it. **It runs in CI**, as a second UI-gate step with
      `E2E_FAIL_READS=all`, because a switch nobody pulls is a switch that stops working.
- [x] The three-state checklist is above, with what was seen.

## The suite skips rather than passes when the switch is off

A degraded-state suite that quietly passes against a healthy server is the worst kind of green: it
asserts nothing, in the same voice as a real result. `test.skip` is the honest outcome and it is loud
in the report.
