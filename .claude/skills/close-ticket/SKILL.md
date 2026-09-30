---
name: close-ticket
description: Close a ticket honestly once its work has shipped — set the real status, record what was learned, and say plainly what is left. Use after a pull request merges, when ticket-drift complains, or when a ticket's status no longer matches what shipped. Adapted from dzhng/skills close-spec.
---

# Close a ticket

Adapted from `engineering/close-spec` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT). Their
insight, and it is the reason this is worth having:

> A spec is a **build plan** while you're building and a **rationale record** once you've shipped. Closing
> flips it from one to the other.

A ticket here is the same. While open it says what to do. Once shipped it should say **why it was done and
what was learned**, because the code already says how.

## Why this repository needs it specifically

**Twenty-one tickets are "Shipped in part"**, and `make ticket-drift` has turned `main` red three times in
two days catching a status that no longer matched what shipped. Every one of those catches was correct.
Closing a ticket properly is not admin — it is what keeps the board a true picture for a founder.

## The statuses, and what each one honestly means

| status | means |
|---|---|
| `Done` | Every acceptance criterion is met, or explicitly un-tickable with the reason recorded. |
| `Shipped in part` | Real work shipped **and something named is left.** The ticket must say what. |
| `filed` / `Open` / `Todo` | Not started. |

**`Done` is not "the pull request merged".** If a criterion is unmet, the status is `Shipped in part` and
the ticket says which one and why. A ticket marked Done over a screen that still fails is the board lying,
which is the failure non-negotiable 10 exists to forbid.

## The trap that has caught this project three times

**A ticket whose deliverable *is* the ticket ships in the commit that files it.** A decision record, a
research note, a plan — the commit subject names the ticket, `ticket-drift` sees the work has shipped, and
the status still says `filed`.

**Do not special-case the check.** It was right all three times. File a decision record **together with the
document it produces**, so filing and shipping are genuinely one act, and set the status in the same
commit.

## What to write when closing

Not a summary of the implementation — anyone can read the code. Write the layer the code cannot hold:

- **What was measured**, with the numbers. Before and after.
- **What was assumed and turned out wrong.** This is the most valuable part and the one most often left
  out. If a diagnosis was wrong, say so and say what the real cause was.
- **What was not verified**, and why.
- **What would make someone reopen it.**

## Then

- Update the ticket's status and its criteria in the same commit.
- Run `make ticket-drift`. If it complains, it is right — fix the ticket, not the check.
- If something durable was learned, record it where the next session will find it rather than in the pull
  request body alone.
