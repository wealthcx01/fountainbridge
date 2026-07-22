---
slug: activegraph
title: ActiveGraph
order: 5
summary: The gate every external action stops at — nothing leaves the building without a recorded yes.
---

## The gate at the edge

Inside the box, agents can do almost anything — draft, build, revise — freely, because it's all
reversible and reviewable. The moment an action would touch the **outside world**, it stops at
**ActiveGraph** and waits.

External actions are the ones with real-world consequences you can't take back:

- Sending an **email** to a prospect or customer.
- Posting to **social** or any public channel.
- Writing to a **CRM** or other system of record.
- Moving **money** — payments, invoices, subscriptions.

## Approve-then-act, always

ActiveGraph holds each of these as a proposed action with its full content attached, and it will not
execute until a **recorded human approval** exists. There is no path where an agent sends the email
and asks forgiveness later — the send simply doesn't happen until someone approves it, and the
approval is logged as an event. Engineering changes gate on PR review; external actions gate on
ActiveGraph approvals. Both gates, no exceptions, including "trivial" ones.

## Why an event, not just a button

Because "who approved this, and when" has to be answerable after the fact. ActiveGraph records
approvals as durable events, so every outbound action a venture ever took has a name and a timestamp
attached to it. That's what makes it safe to let agents draft outbound work at speed: the record of
consent is part of the mechanism, not an afterthought.
