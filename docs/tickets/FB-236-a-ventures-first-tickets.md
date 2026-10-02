# FB-236 — where a new venture's first tickets come from

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-25 — founders at the early stage of
defining tickets · **Depends on:** FB-232 group 3 · One ticket = one branch = one PR.

**Shipped in part:** it has not been run for real. The composer's new instructions reach a venture's
machine only when it is re-seeded, and no founding walk has yet been done with a real founder on a
venture that does not exist yet. Until then, "a founder can go from an idea to tickets in one sitting"
is built but not shown.

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

- [ ] A founder can go from an idea to a small set of tickets they agree with, in one sitting. — *the
      path exists end to end (day one's button → the walk → the map and tickets → one press), but it
      has not been walked with a real founder.*
- [x] The walk reaches the unknown-unknowns stage rather than stopping at a tidy list of knowns — that stage
      is the whole reason for choosing this over a crawler. — *the composer is told never to skip it, and
      the studio refuses to file a map that has nothing under "Unknown unknowns"
      (`mapProblem`, checked in the panel and again on the server). A founding set whose map is missing
      or cannot be read is refused too, in the panel and on the server, with a sentence saying why — so
      the check cannot be skipped by the map simply not arriving. What the studio cannot check is the
      conversation itself; it checks the map the conversation hands over.*
- [x] The map is written into `context/` and is readable later by the venture brain. — *saved as
      `context/general/founding-map.md`, in the same pull request as the tickets, listing the id each
      ticket was given. The brain's own rules count it as part of the venture's knowledge and share it
      with every department; tested through `deploy/lane/brain-lib.mjs`, not yet seen on a box.*
- [x] Tickets are filed through `filePlan`, not a second writer. — *`filePlan` takes the map as one more
      argument and writes it on the same branch.*
- [x] Nothing is filed the founder has not seen and agreed to. — *the map and the tickets arrive in the
      plan panel; the founder can read the whole map, strike any ticket, and nothing is written until
      they press "File all N". The composer is told never to file a founding set itself. One limit:
      the map is shown folded (one click opens it) and its points cannot be struck one by one; to change
      the map, the founder asks the composer. It is saved in a pull request a person still merges.*
- [ ] Run for real on one venture that does not exist yet, not on ARCA's existing backlog.

## What was built (2026-10-02)

- **The walk, in the composer's instructions** (`deploy/librechat/seed-agent.js`, step 3b): five
  stages, one per reply, each named; the method's questions from FB-069 asked in the known-unknowns
  stage; the unknown unknowns never skipped; the last stage hands over a map and a plan together.
- **Day one starts it.** The first-run button opens the composer with *"I am starting <venture>. Walk
  me through what we know and don't know, and help me find the first things to build."* typed in the
  box, unsent. The same sentence is the composer's first suggested opener.
- **The studio checks the map** (`lib/founding-map.ts`): it reached all four quadrants, and every
  ticket names the part of the map it came from.
- **One press files both.** The plan panel shows the idea, the map (folded, one click to read), and the
  tickets; `filePlan` writes the tickets and then the map, on one branch, in one pull request. It will
  not write over a founding map that has already been merged.

**Fixed after review (2026-10-02).** A founding set no longer files as an ordinary plan when its map
is missing or unreadable: the panel and the server both refuse it and say why. A map whose tickets
cannot be read now stays on screen, open, with a sentence saying the tickets are missing, instead of
vanishing. The browser test presses "File all" and proves the map travels with the tickets. A test
keeps the walk's questions the same as FB-069's. The panel no longer reads "From The founding map".

Found on the way and filed separately: **FB-257** — the studio's `file_ticket` tool for Claude cannot
file anything.

## Verification

The test is a real founding run producing tickets a founder recognises. Tickets nobody wanted, filed
quickly, is the failure mode.
