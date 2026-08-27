# Decision memo — what Scale connects to

**Status:** Open. Needs John. · **Blocks:** G3, and the Scale surface on the desk.
**Written:** 2026-08-27, from the desk redesign's gap paper (`docs/design/foundry-desk/Backend Gaps.dc.html`).

No ticket exists for this and none should until it is decided. The design already tells the truth
while it is open: Scale renders **"Not connected. The ad account is a Bruntsfield setup step; platform
tbd."** and counts the tickets waiting on it. That is a better state than a half-built connector to a
platform we then leave.

## What is actually being decided

Not "should we do paid growth". The venture's Scale surface exists in the manifest and on the board
either way. The decision is **which platform the first connector targets**, because that choice
commits us to an ad account model, a spend-reporting shape, a review policy and an approval flow, and
those are not portable between platforms in the way an email provider is.

## What already holds, whatever is chosen

- **The gate.** Spend is an external action, so it goes through the same signed ActiveGraph approval
  as a send (CLAUDE.md #4). Nothing here changes that, and no connector may bypass it.
- **The budget envelope.** `lib/budgets.ts` already reads per-surface budgets and the desk already
  renders "Scale not open". A connector reports spend into the envelope that exists.
- **The approval matrix.** D7 puts spend in the high-blast-radius class. That is a dual-approve item,
  not a founder-alone one.

## What the choice actually costs

| | Meta (Facebook/Instagram) | Google Ads | LinkedIn | Defer |
| --- | --- | --- | --- | --- |
| Fit with ARCA (B2C collectors) | Strong — interest and lookalike targeting suits a collector audience | Weak for discovery, strong for intent once the category is searched | Wrong audience | — |
| Fit with THE RESET (B2C) | Strong | Moderate | Wrong audience | — |
| Fit with the B2B posture (bank-sponsored wealth product) | Weak | Moderate | Strong | — |
| API maturity for spend reporting | Good | Good | Good | — |
| Account setup burden | Business Manager, a page, a payment method, review | Ads account, billing, conversion tracking | Company page, ads account | none |
| Review/approval friction | Ad review can reject; needs a resubmit path | Similar | Similar | none |

The uncomfortable part: **ARCA and THE RESET point at Meta; the B2B posture the phased plan keeps
open points at LinkedIn.** Venture-as-config (CLAUDE.md #5) says the studio must not hard-code either,
so whatever is chosen first has to arrive as a manifest-declared connector rather than as "the Scale
integration".

## Options

1. **Meta first, connector declared per venture.** Matches both live ventures. The B2B case gets a
   second connector later against the same interface, which is the shape venture-as-config wants
   anyway. Highest chance the first connector is actually used.
2. **Google Ads first.** Better if the first real spend is intent capture rather than discovery.
   Weaker fit for a collector audience that does not know to search.
3. **Neither yet — keep Scale honest and closed.** Costs nothing, and the design is built for it. The
   Scale panel already says what is true. This is the default if the decision does not want making.

## Recommendation

**Option 3 until a venture has a reason to spend, then Option 1.**

Not indecision: the gap paper puts G3 last for a reason, and nothing else in this programme is blocked
by it. Building a connector before a venture has an audience to reach would be building the most
expensive placeholder in the set. When ARCA or THE RESET has something worth putting money behind, the
answer is almost certainly Meta, and the ticket is small because the gate, the budget envelope and the
approval matrix already exist.

## What to do when it is decided

Amend the phased plan with the decision (the D1–D8 convention — decisions change only by PR), then
file one ticket for the connector. It needs: the manifest field naming the platform, the spend read
into `lib/budgets.ts`, the account link-through the desk renders, and the proposal/approval path for a
campaign as an external action. Nothing about the desk changes; the Scale panel stops saying "tbd".
