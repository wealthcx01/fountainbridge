# FB-151 — The rail costs five seconds on every screen under a venture

**Status:** Todo · **Area:** Studio / performance · **Depends on:** FB-128

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

## What to find out first

Which of the three reads it is. `/attention` runs `loadVentureAttention` across every venture in
225 ms, so it is almost certainly **not** the attention queue — leaving `loadApprovals` (which walks
the `foundry-approvals` ref per repository) and `loadRunReports` (bounded by FB-123, but bounded is
not the same as fast). Measure before changing anything: FB-128 spent its effort on the page because
the page looked slow, and the page was not slow.

## Scope

- Instrument the three reads in `loadRailData` so the answer is a number and not an argument.
- Make the rail cheap enough that a static handbook page does not cost five seconds.
- Keep FB-083's rule: bounded per load, never repeating on a timer, never a function of how much
  history a venture has.

## Out of scope

- The desk's own ~350 ms.
- Anything that makes the rail lie to be fast. A rail that renders before it knows the numbers must
  say it does not know them yet, not show a zero (FB-124's note: a number invented here is believed
  everywhere).

## Acceptance criteria

- [ ] The three reads inside `loadRailData` are measured on production and the numbers recorded here.
- [ ] `/venture/arca/handbook` — which reads nothing about the venture — is under 1s.
- [ ] `/venture/arca` is **under 3s**, which is FB-128's unmet criterion.
- [ ] The rail still shows real numbers or says it cannot; no zero stands in for an unknown.
- [ ] Measured three times on production and recorded, the same way this ticket's table was.
