# FB-151 — Five seconds on every screen under a venture

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

## What was measured again, and the mistake in the first measurement

**2026-08-31, production, signed in as ARCA's founder, three loads each, median time to first byte.**

The first pass produced this, and a confident wrong conclusion:

| Route | Median | |
| --- | --- | --- |
| `/login` | 5,354 ms | "the login page has no rail, so the rail is not the cost" |
| `/attention` | 4,820 ms | "225 ms when this ticket was written — a regression" |

**Both readings were of a different page.** Signed in, `/login` redirects to `/venture/arca` and
`/attention` redirects to `/venture/arca/tickets`. The probe recorded the time and never recorded
where it landed, so two venture screens were written down under the names of two pages that have no
rail. The conclusion drawn from them — that the root layout was the cost — followed correctly from
numbers that were not measurements of what they were labelled.

That is the same trap as the sweep that reported ten healthy pages and had been looking at the login
screen the whole time. **Print where you landed, beside every reading.**

### The corrected table

| Route | Renders | Landed on | Median |
| --- | --- | --- | --- |
| `/health` | nothing — no page, no header | `/health` | **232 ms** |
| `/login` *(signed out)* | the header and a sign-in form | `/login` | **200 ms** |
| `/not-authorized` *(signed in)* | the header, with a session | `/not-authorized` | **223 ms** |
| `/admin/timing` *(signed in)* | the header and a table. **No rail.** | `/admin/timing` | **224 ms** |
| `/venture/arca/handbook` | static markdown, **under the rail** | `/venture/arca/handbook` | **5,333 ms** |
| `/venture/arca` | the whole desk | `/venture/arca` | 5,190 ms |

The root layout, signed in, with the whole header, costs **224 ms**. Put the same page under
`app/venture/[id]/layout.tsx` and it costs **5,333 ms**.

**This ticket's original title was right.** It is the rail.

## What was shipped first, and why it stays

The first PR against this ticket moved the header's cross-venture count behind `<Suspense>` and
built the measuring instrument. The header was never the five seconds — that was the wrong reading —
but the change is right on its own terms: it is a cross-venture read of open work, on every page,
that nothing above the fold depends on. It stays.

The instrument stays too, and it is the reason this correction exists at all.

## Which of the three reads it is — still open, and it no longer blocks the fix

`loadRailData`'s three reads are instrumented and their medians are on `/admin/timing`, which is
Bruntsfield-only. Reading them needs John's account; the founder login this was measured with cannot
see that page, and widening it to see a diagnostic would be the wrong trade.

It does not gate the fix. Whichever of the three it is, **nothing above the fold depends on any of
them**, so the rail's shell renders now and its numbers arrive after — which is the same answer for
all three. The readings then say which one to attack if the numbers still matter.

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
- **Take the rail's three reads off it too**, the same way, since that is where the seconds actually
  are. The rail draws immediately and says "checking" until it knows.
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
