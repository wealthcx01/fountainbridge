---
name: write-ticket
description: Turn a founder's request, or discovered work, into a ticket in this repo's format that the lane can pick up and a founder can read. Use before starting anything large or ambiguous, when discovered work needs filing, or when a request is too big to be one branch. Adapted from dzhng/skills write-spec.
---

# Write a ticket

Adapted from `engineering/write-spec` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT). Theirs
plans a feature into a ladder of slices under `specs/`. **Ours has no `specs/` directory — the unit here is
a ticket**, `docs/tickets/FB-XXX-slug.md`, and one ticket is one branch is one pull request.

That difference settles the overlap with gstack's `/spec`: **`/spec` writes a spec, this writes a ticket in
this repository's format.** Reach for this one whenever the output belongs in `docs/tickets/`.

## Grill before planning

**Ask one question at a time, and give your recommended answer with each one** so it can be accepted,
rejected or edited in a word. Stop when you know:

- what a person will see change, in their words
- what is explicitly *not* in scope
- how anyone would know it worked
- what must not break

**Inspect the repository instead of asking what the code can answer.** A question whose answer is in
`lib/` is a question that wastes the founder.

If you are unsure what is wanted, **ask before filing**. A wrong ticket costs more than a question.

## One ticket is one branch

If it needs two branches, it is two tickets. If it has an "and" in the title, look hard at it.

Discovered work becomes its **own** ticket, never scope creep into the current one (non-negotiable 3).
That rule is why this repository has 230 tickets and why nothing in its history had to be reconstructed
from memory.

## The format

Every ticket carries, in this order:

```
# FB-XXX — what a person would call it

**Status:** filed · **Phase:** N · **Raised by:** who and when · One ticket = one branch = one PR.

## Why  (what is wrong now, for the founder)
## Scope  (what this PR does)
## Out of scope  (what it deliberately does not, and why)
## Acceptance criteria  (checkboxes; each one checkable by someone else)
## Verification  (how it will be proved, and whether non-negotiable 11 applies)
```

**Write it for the founder** (non-negotiable 12): short sentences, the plain word over the clever one, say
what happened then what it means then what to do. Some founders are not technical and none of them should
have to be.

## What makes an acceptance criterion real

- **Someone else can check it.** "Works properly" cannot be checked. "The desk is under 2,500px on ARCA's
  production data at 1440×1000" can.
- **It names what would prove it false.** A criterion that cannot fail is the same bug as a test that
  cannot fail, and this project has shipped five of those.
- **If a screen changes, non-negotiable 11 is a criterion**, with the heights recorded.
- **If nothing can prove it yet, say so in the ticket** rather than writing a criterion nobody can tick.

## Before you file

- Does a ticket already exist for this? 230 do. Check.
- Is it one branch?
- Would a founder who has never seen the code understand what changes for them?
- Does `make parse-tickets` pass, and `make copy-lint`?

## What this does not do

It does not implement anything, and it does not decide priority. Filing a ticket is not starting work.
