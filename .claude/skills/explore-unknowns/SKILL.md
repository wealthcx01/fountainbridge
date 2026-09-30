---
name: explore-unknowns
description: Walk a founder or a ticket through the four quadrants of what is known and unknown, one stage at a time, ending with a map they hold. Use when a request is ambiguous, when a venture is starting and there is no backlog yet, when a founder will "know it when they see it", or before slicing anything large. Adapted from dzhng/skills explore-unknowns.
---

# Explore the unknowns

Adapted from `engineering/explore-unknowns` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).
Theirs ships a reference file per stage; this folds the essentials into one page and points at the ticket
format as the deliverable.

> The map is not the territory… **an unknown found before code is written costs minutes, while the same
> unknown found three pull requests later costs the three pull requests.**

## Two moves that apply at every stage

**Reacting beats imagining.** Never ask a founder to describe what they want when you can hand them
something concrete to react to. Reacting extracts what somebody knows but cannot say unprompted — and a
founder who is not technical can always tell you what is wrong with a thing in front of them.

**Every answer should be nearly free to give.** End each step with their reply already drafted: a
recommended answer to accept or edit, a short list to strike through. A question that costs a paragraph to
answer often goes unanswered.

## The four quadrants, walked one at a time

Name the quadrant as you go, so they always know where they stand.

1. **Known knowns — the settled ground.** Open here. What is already decided, already built, already true.
   Cite it: a file, a ticket, a manifest. **Inspect the repository rather than asking what the code can
   answer.**
2. **Known unknowns — the questions.** One at a time, each with your recommended answer attached. Record
   every one with its answer and who closed it: the founder, the territory, or still open. An open one
   states what would unblock it.
3. **Unknown knowns — what they know and have not said.** Taste, constraints, who else has to live with
   this, what "good" looks like to them. This is where reacting earns its keep.
4. **Unknown unknowns — the landmines.** What neither of you knew to ask. Sweep the ground the work will
   touch and say how far the sweep reached. Hunt for: things that bite silently, rules the code enforces
   that nothing documents, and **half-built or reverted earlier attempts at the same job — the reason one
   died is usually the landmine.**

This repository has a rich supply of the fourth kind, and they are worth reading for the pattern: a
directory listing silently capped at a thousand entries; a fixture that left no rows so a test could not
fail; a comment describing elements that no longer existed.

## Stage 5 — hand over the map

**The map is the deliverable.** Implementation is a different task that starts after it is handed over.

For a venture that is starting, the map becomes its **first tickets** — filed through `write-ticket`, with
the map itself kept in `context/` (D8) so the reasoning survives the conversation.

For an ambiguous ticket, the map goes into the ticket, and the open questions become its blockers rather
than assumptions nobody wrote down.

## Where it stops

Do not file anything the founder has not seen and agreed to. A wrong first ticket costs more than a
question, and a founding conversation that produces tickets nobody wanted is worse than one that produces
none.
