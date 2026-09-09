# FB-214 — "Costs: Nothing" on a send that costs money

**Status:** filed · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-08, second half) ·
**Branch:** `fb-214-costs-for-a-send` · One ticket = one branch = one PR.

## What was found

> **Costs** stays "Nothing" only for internal work; **a send states its metered cost from the
> approval.**

The decision panel on a ticket prints:

> **Costs** — Nothing. This is work your team already did; approving it makes it part of your product.

That is true of internal work and false of an external send. ARCA's approvals carry `amountMinor` and
`currency`; the surface columns and the rail both show money from them. The one screen where a founder
says **yes** to something leaving the company is the screen that says it costs nothing.

## Why it is its own ticket

FB-208 fixed the other half of R-08 — *Proven* now states what the checks actually said. Costs is a
different wire: the money is on the **approval**, and a ticket row reaches an approval only through
`waiting`, which today carries a pull request. Joining a ticket to its external approval is a change to
what the row knows, not a change to what the panel prints.

## Scope

- A ticket whose waiting item is an external send states its metered cost — `amountMinor` and
  `currency`, formatted by `lib/budgets.ts`'s `formatMoney`, so one formatter owns it.
- **`priceUnreadable` is not zero.** `ActiveGraphApproval` carries that flag precisely because a price
  the studio could not read is not a price of nothing, and the sentence must say so.
- Internal work keeps the sentence it has, which is correct for it.

## Out of scope

Changing what a send costs, or where the figure comes from. This states a number that already exists.

## Acceptance criteria

- [ ] A ticket for an external send states its cost in money on the decision panel.
- [ ] A send whose price could not be read says that, and never "Nothing".
- [ ] Internal work still reads "Nothing", with the reason it is nothing.
- [ ] The figure is formatted by the same function the rail and the surfaces use.
