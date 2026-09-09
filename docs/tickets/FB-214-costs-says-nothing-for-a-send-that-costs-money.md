# FB-214 — "Costs: Nothing" on a send that costs money

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-08, second half) ·
**Branch:** `fb-214-costs-for-a-send` · One ticket = one branch = one PR.

> **Narrowed 2026-09-09, and the original framing no longer applies.** This ticket was written
> around the decision panel on a ticket printing "Costs — Nothing" for an external send. Checked, and
> neither half holds:
>
> - **A send never reaches that panel.** FB-183 gave external sends their own page
>   (`/venture/<id>/approvals/<repo>/<id>`) on 3 September. The tickets panel renders only for a
>   pull request, and *"Nothing. This is work your team already did"* is correct for those.
> - **The send's own page already states the cost.** `ApprovalCard` prints "This one costs £5,200."
>   whenever it has a figure.
>
> **The defect the scope names is live, and it is the whole of this ticket now.** `priceUnreadable`
> is parsed, stored, and used for a budget flag — and never rendered to a founder anywhere. When the
> studio cannot read a send's price, the card says **nothing at all**. Silence, on the screen where
> somebody approves money leaving their company, reads as free.

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

- **`priceUnreadable` is not zero.** `ActiveGraphApproval` carries that flag precisely because a price
  the studio could not read is not a price of nothing, and the sentence must say so — on the card,
  where the founder decides, not only in a field nothing reads.
- Internal work keeps the sentence it has, which is correct for it.

## Noticed and not taken (non-negotiable 3)

An external send that states **no price at all** — as opposed to one whose price would not parse —
is also silent, and reads as free for the same reason. It is a different fact (`amountMinor: null`
with `priceUnreadable: false`), it needs its own words, and it wants a decision about whether a
priceless send should be approvable at all. Its own ticket if it turns up on a real send.

## Out of scope

Changing what a send costs, or where the figure comes from. This states a number that already exists.

## Acceptance criteria

- [x] A price the studio could not read says so, on the card where the decision is made.
- [x] A readable price still states its figure, and says nothing about reading.
- [x] A genuinely free action stays silent — free is a real answer, and a warning that fires on
      everything means nothing.
- [x] The two are exclusive: no card claims both a figure and an unreadable price.

*(The original criterion — "a ticket for an external send states its cost on the decision panel" —
does not apply: a send has its own page since FB-183 and never reaches that panel. See the note at
the top.)*
- [ ] A send whose price could not be read says that, and never "Nothing".
- [ ] Internal work still reads "Nothing", with the reason it is nothing.
- [ ] The figure is formatted by the same function the rail and the surfaces use.
