# FB-151 — Five seconds on every screen (it was not the rail)

**Status:** Done · **Area:** Studio / performance · **Depends on:** FB-128

## What was measured

FB-128 parallelised the desk's reads and took the venture page from **9.1s to 5.4s** — short of its
own acceptance criterion of under 3s. Rather than guess at the rest, every route was timed on
production, signed in as ARCA's founder, three loads each (time to first byte):

| Route | What it renders | Median TTFB |
| --- | --- | --- |
| `/attention` | open work across **every** venture — no rail | **225 ms** |
| `/venture/arca/handbook` | static markdown, no venture data at all | **5,067 ms** |
| `/venture/arca/knowledge` | a file listing | 5,229 ms |
| `/venture/arca/activity` | repository health | 5,402 ms |
| `/venture/arca` | the whole desk | 5,416 ms |

Read the second row twice. **A static markdown page costs five seconds.** It reads nothing about the
venture. And `/attention`, which loads open pull requests across every venture the viewer can see,
answers in a fifth of a second.

## What that means

The cost is not the desk. It is `app/venture/[id]/layout.tsx` — **the rail** — which every screen
under a venture renders, and which loads the attention queue, the approvals and the run reports
through `loadRailData`.

The desk's own page work is the difference between its row and the handbook's: **about 350 ms.**
FB-128's parallelisation did what it set out to do; it was measuring the wrong thing, because the
five seconds were never on the page it changed.

`loadRailData` is already wrapped in React `cache()`, so the layout and the page share one load
within a request. That is not the problem. The problem is that the load itself takes five seconds and
now happens on **five screens instead of one** — FB-124 multiplied a cost nobody had measured.

## What was measured again, before changing anything — and the theory was wrong

**2026-08-31, production, signed in as ARCA's founder, three loads each, median time to first byte:**

| Route | Renders | Median TTFB |
| --- | --- | --- |
| `/health` | nothing — no page, no header | **237 ms** |
| `/login` | the header and a sign-in form. **No rail.** | **5,354 ms** |
| `/` | the venture list | 5,047 ms |
| `/attention` | open work across every venture — no rail | 4,820 ms |
| `/venture/arca/handbook` | static markdown | 4,988 ms |
| `/venture/arca/knowledge` | the corpus | 5,456 ms |
| `/venture/arca/tickets` | the backlog | 5,303 ms |
| `/venture/arca` | the whole desk | 5,962 ms |

`/attention` was **225 ms** when this ticket was written and is **4,820 ms** now, and it has no rail.
`/login` has no rail either. So the rail was never the cause — it was simply present on the screens
that got measured.

**The one experiment that settled it.** The same routes, in a fresh browser with no session:

| Route | Signed out | Signed in |
| --- | --- | --- |
| `/login` | **196 ms** | **5,354 ms** |
| `/not-authorized` | **200 ms** | — |

Same route. Same layout. Same server. The only difference is the `if (session?.user?.email)` block
in `app/layout.tsx`, and the expensive half of it is **`loadAccessibleAttention`** — open work across
every venture the viewer can see, read in the ROOT layout, on **every page of the studio**.

FB-124 did multiply an unmeasured cost across five screens. It just was not this one. The cost was
on all of them, and on the login page, from before FB-124 existed.

## What to find out first

Which of the three reads it is. `/attention` runs `loadVentureAttention` across every venture in
225 ms, so it is almost certainly **not** the attention queue — leaving `loadApprovals` (which walks
the `foundry-approvals` ref per repository) and `loadRunReports` (bounded by FB-123, but bounded is
not the same as fast). Measure before changing anything: FB-128 spent its effort on the page because
the page looked slow, and the page was not slow.

## Scope

- **A measuring instrument, on the hot path.** `lib/timing.ts` records each step of a real request
  into a bounded ring; `/admin/timing` (Bruntsfield only, unlinked) prints the medians. Two rounds
  of optimisation have now been aimed by reasoning about which code looked expensive, and both were
  wrong. The next person gets a reading.
- Instrument the three reads in `loadRailData`, and the root layout's own read, so the answer is a
  number and not an argument.
- Take the header's read off the critical path. Nothing above the fold depends on a count beside a
  link, so the shell flushes and the badge arrives when it arrives — the FB-155 treatment, one
  layout up. The reads are unchanged; the founder stops waiting for them.
- Keep FB-083's rule: bounded per load, never repeating on a timer, never a function of how much
  history a venture has.
- The fallback shows the nav **without** a badge, never with a zero. A zero is a claim that nothing
  needs the founder (FB-124: a number invented here is believed everywhere).

## Out of scope

- The desk's own ~350 ms.
- Anything that makes the rail lie to be fast. A rail that renders before it knows the numbers must
  say it does not know them yet, not show a zero (FB-124's note: a number invented here is believed
  everywhere).

## Acceptance criteria

- [x] The reads are instrumented and the numbers recorded here. The instrument outlived the
      measurement on purpose: `/admin/timing`.
- [x] The measurement was taken **before** changing anything, and it contradicted this ticket's own
      title. Recorded above rather than quietly corrected.
- [x] The rail still shows real numbers or says it cannot; no zero stands in for an unknown. The
      header's fallback shows no badge rather than a badge saying nothing needs you.
- [ ] `/venture/arca/handbook` — which reads nothing about the venture — is under 1s. *Measured on
      production after the deploy; recorded below.*
- [ ] `/venture/arca` is **under 3s**, which is FB-128's unmet criterion. *Same.*

## After the fix

*Measured on production once this is deployed, three loads each, the same way as above.*
