# The desk redesign — screen map and ticket index

The design bundle in this directory is the contract for FB-124…FB-142. This file is the index: which
screen maps to which route, which ticket builds it, and which back-end gap it waits on.

**How to view the reference.** The wireframe fetches its own source, so `file://` will not work.
Serve the directory and open it over HTTP:

```
cd docs/design/foundry-desk && python3 -m http.server 8899
# then open http://127.0.0.1:8899/Foundry%20Studio%20Full%20Wireframe.dc.html
```

Sign in with either door (no credentials are checked), then use the rail. `screens/` holds a
text extraction of every screen block, including the `[IF …]` state conditions, for reading and
grepping without a browser.

## Fidelity, from the handoff's own README

**Contractual:** information architecture, screen inventory, section order, copy voice and specific
microcopy, interaction behaviour, state transitions, empty and degraded states.

**Indicative:** exact pixel values. Rebuild spacing in rem per `docs/studio-design-contract.md`.

## The screens

| # | Screen | Route | Ticket | Waits on |
| --- | --- | --- | --- | --- |
| 1 | Sign in | `/login` | FB-135 | — |
| 2 | Day one / first run | `/venture/[id]` (`first-run`) | FB-135 | — |
| 3 | The desk | `/venture/[id]` | FB-128 | G6/G7 for the live office |
| 4 | Tickets (absorbs `/attention`) | `/venture/[id]/tickets` | FB-129 | — |
| 5 | The trail, on a ticket | same | FB-130 | **G1** (FB-125) |
| 6 | Composer | `/venture/[id]/composer` | FB-131 | **G4** (FB-126), **G5** (FB-127) |
| 7 | What happened | `/activity` | FB-132 | — |
| 8 | Memory | `/venture/[id]/knowledge` | FB-133 | **G9** (FB-140) for the write path |
| 9 | Handbook | `/handbook` | FB-134 | — |
| 10 | Admin ledger | `/` (admins) | FB-136 | — |
| 11 | Pocket studio | responsive | FB-138 | **G8** (FB-141) for push |
| — | Empty + degraded, everywhere | all | FB-137 | — |

## The gaps, and what they became

The handoff suggested FB-130+ and FB-140+ with gaps between. Our ids are contiguous and 3-digit
(FB-001…FB-123, and FB-118 on why the width matters), so the set is renumbered. This table keeps the
design papers resolvable.

| Gap | Suggested in the paper | Our ticket | Note |
| --- | --- | --- | --- |
| G1 — the per-ticket trail | FB-130 | **FB-125** | Studio only |
| G2 — the Sell trace | FB-131 + the FB-02x set | **FB-142** | Rides on the ratified GTM research |
| G3 — the Scale connector | FB-132, after a decision | *no ticket yet* | `docs/decision-scale-platform.md` |
| G4 — per-ticket composer threads | FB-133 | **FB-126** | Studio + venture repo |
| G5 — plan objects (PRD → ticket set) | FB-134 | **FB-127** | Studio + git |
| G6 — the pixel-agents feed | FB-135 | **FB-139** | Venture box + studio embed |
| G7 — a live desk | folded into G6 | **FB-139** | Same ticket, as the paper suggests |
| G8 — the pocket studio push | FB-136 | **FB-141** | PWA + one push event |
| G9 — the memory write path | FB-137 | **FB-140** | Venture repo + gbrain |
| G10 — per-surface outcomes | FB-138, after a decision | *no ticket yet* | `docs/decision-surface-outcomes.md` |

Two gaps have no ticket on purpose. The paper is explicit that G3 and G10 need a decision before any
ticket, and the design already tells the truth while they are open — Scale renders "not connected ·
platform tbd" rather than an empty panel pretending to be broken. A ticket follows each decision;
neither number is allocated in advance, because an id that names nothing is the failure FB-117 exists
to prevent.

## Build order

From the paper's §3, which this set follows:

1. **FB-125 (G1) and FB-126 (G4)** — studio-side, built on events that already exist, and what makes
   the desk honest.
2. **FB-127 (G5)** — the PRD flow is the founder's highest-leverage act and needs only the studio and git.
3. **FB-139 (G6+G7)** — the venture-box work; the office is the product's feeling and the desk's
   reason to stay open.
4. **FB-142 (G2)** per the ratified research, with **FB-141 (G8)** and **FB-140 (G9)** alongside.
5. G3 and G10 last, both behind decisions.

The front end can run ahead of all of it: every gap has a truthful placeholder state, which is
FB-137's job to make true on every screen rather than only where someone remembered.

## What was already there

The paper's §1 lists the machinery the desk re-arranges rather than invents: `lib/tickets.ts`,
`lib/attention.ts`, `lib/approvals.ts`, `lib/activegraph-log.ts`, `lib/provenance.ts`,
`lib/budgets.ts`, `lib/runreports.ts`, `app/actions/release-plan.ts`, `lib/brief.ts`,
`lib/knowledge.ts`, `lib/routines.ts`, `lib/composer.ts`, both sign-in doors, the FB-009 mobile pass
and `WhileWorking.tsx`'s budgeted polling.

Worth stating because it sets the standard for these tickets: **none of that is a gap, and none of it
should be rewritten.** A ticket in this set that reimplements something in that list is wrong.
