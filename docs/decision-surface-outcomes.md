# Decision memo — where "the company, by surface" gets its numbers

**Status:** Open. Needs John. · **Blocks:** G10, and the outcome lines on the desk's surface panels.
**Written:** 2026-08-27, from the desk redesign's gap paper (`docs/design/foundry-desk/Backend Gaps.dc.html`).

The desk's last section shows the venture by surface:

> **Build · the product** — 14 tickets · preview of the app running from the venture VM.
> **Sell · the pipeline** — Last send: 41 delivered · 29 opened · 3 replied, September update.
> **Scale · paid growth** — Not connected.

**Build's line is already true today** — ticket counts come from `lib/tickets.ts` and the preview link
from the venture box. Sell's and Scale's are not. There is no analytics source anywhere in the studio,
and the gap paper says so plainly: *"Exists: nothing."*

## The actual question

Not "should the desk show outcomes" — it should, and it is the only place a founder learns whether any
of this worked. The question is **where the numbers come from**, and the honest answer differs by
surface:

- **Sell** numbers (delivered, opened, replied) belong to whatever sends the email. They arrive from
  the email provider's own reporting, which lands with G2 (FB-142) whether we decide anything here or not.
- **Scale** numbers belong to the ad platform, and arrive with G3 — which has its own open decision.
- **Build** is the one with a real choice: does the desk report *product* outcomes (people using the
  venture's app), and if so, from where?

So this memo is really about Build, and about a rule for all three.

## Options for Build's outcome line

1. **Ticket and preview facts only — what ships today.** "14 tickets · preview running." True, free,
   and says nothing about whether anyone uses it.
2. **Venture app events.** The venture app reports its own usage to an endpoint the studio reads.
   Truthful and portable across ventures, but it is a product to build and maintain in every venture
   app, and D1 keeps ventures isolated — a shared analytics pipe is a hole in that.
3. **A third-party analytics product** (Plausible, PostHog) per venture, read through its API.
   Fastest to a real number, adds a vendor and a second place venture data lives, and every venture
   needs its own account and key.
4. **Nothing for Build.** The desk shows shipping facts and is honest that it does not measure use.

## The rule that matters more than the choice

Whatever is decided: **the desk renders whatever reports exist and shows nothing invented.** A panel
with no source says so in words, as Scale's already does. No zeroes standing in for unknowns, no
"—" that could be read as nought, no sparkline drawn from one point.

That rule is the part worth ratifying now, because it is what makes the other three panels safe to
ship before this is settled — and it is the same discipline as `unknown` versus `unavailable` in
`lib/runreports.ts`, and the coverage banner in ARCA's analytics.

## Recommendation

**Option 1 now, with the rule above ratified; revisit when a venture has users to measure.**

Sell's numbers arrive free with FB-142 because the provider reports them. Scale's arrive free with the
connector, once G3 is decided. Build's are the only ones needing new machinery, and measuring usage of
a product nobody uses yet would be the most elaborate way to render a zero this programme could find.

The moment ARCA or THE RESET has real users, Option 2 is the right shape — venture-owned, no vendor,
consistent with D1 — and it is a small ticket in the venture repo plus a read in the studio.

## What to do when it is decided

Amend the phased plan, then file one ticket. It needs: the source per surface, the read path, and the
"no source yet" copy for any surface still unmeasured. The desk's layout does not change either way —
FB-128 builds the panels, and this decides only what fills the outcome line inside them.
