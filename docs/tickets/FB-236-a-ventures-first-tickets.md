# FB-236 — where a new venture's first tickets come from

**Status:** filed · **Phase:** 3 · **Raised by:** John, 2026-09-25 — founders at the early stage of
defining tickets · **Depends on:** FB-232 group 3 · One ticket = one branch = one PR.

## The moment this is about

A venture starts. There is no code, no backlog, and a founder with an idea. **The hardest question is not
"what shall we build first" — it is "what do I not know that I do not know?"** Everything the Foundry does
well after that point depends on the first tickets being about the right thing.

## Why `explore-unknowns` and not a research crawler

John asked for `deep-research`. It is a genuinely good project (19.7k stars) and it is the wrong shape here,
for reasons worth stating plainly:

- It is a **separate application** needing its own search-API keys, deployed and kept alive on every venture
  machine.
- It was **last updated in April**, while the skills collection was updated the day this was checked.
- Most importantly: **the founding question is rarely answered by crawling the web.** "What am I building and
  who is desperate for it" is not sitting in a document somewhere.

`explore-unknowns` is a five-stage walk — known knowns, known unknowns, unknown knowns, unknown unknowns,
then **hand over the map**. That last stage is the point: it ends by producing something the next step can
act on, and that something is the venture's first tickets. It interrogates the founder, which is what this
moment needs.

`auto-research` sits beside it for the questions that genuinely do need outside facts.

**If a venture later needs a real web crawl the skills cannot do, we revisit `deep-research` then, with a
case.** Not before.

## What a founder should get

A conversation that ends with **a map and a handful of tickets they recognise as their own** — not a
document to read, and not tickets invented on their behalf. Gary's office-hours questions already in the
repo ("who is desperate for this?") are the right register.

## Scope

1. Adapt `explore-unknowns` and `auto-research` (FB-232 group 3 does the adapting; this ticket uses them).
2. Wire the walk into the founding conversation that already exists — FB-069 built one and it is shipped in
   part. **Extend it rather than building a second front door.**
3. End the walk by filing real tickets through the same path everything else uses (`filePlan`), so a
   founding ticket is indistinguishable from any other.
4. Keep the map in `context/` (D8) so the reasoning survives the conversation.

## Out of scope

- `deep-research` as a deployed application, for the reasons above.
- A new conversational surface. D10 settled where conversation happens; this uses it.
- Filing tickets without the founder confirming them. A wrong first ticket is more expensive than a question.

## Acceptance criteria

- [ ] A founder can go from an idea to a small set of tickets they agree with, in one sitting.
- [ ] The walk reaches the unknown-unknowns stage rather than stopping at a tidy list of knowns — that stage
      is the whole reason for choosing this over a crawler.
- [ ] The map is written into `context/` and is readable later by the venture brain.
- [ ] Tickets are filed through `filePlan`, not a second writer.
- [ ] Nothing is filed the founder has not seen and agreed to.
- [ ] Run for real on one venture that does not exist yet, not on ARCA's existing backlog.

## Verification

The test is a real founding run producing tickets a founder recognises. Tickets nobody wanted, filed
quickly, is the failure mode.
