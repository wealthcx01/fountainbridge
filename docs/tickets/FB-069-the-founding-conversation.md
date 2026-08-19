# FB-069 — The founding conversation: bring your research in, leave with a thesis

**Status:** In progress · **Phase:** 3 · **Depends on:** FB-066 (day one), FB-043 (deposits), FB-050
(the brain), FB-018 (the deep playbook) · **Repo:** fountainbridge (+ venture box) ·
**Branch:** `fb-069-the-founding-conversation` · One ticket = one branch = one PR.

**Shipped in part:** the strategic lens (`lib/founding-lens.ts`) — the powers read out of the shipped
playbook, the questions, and the boundary that decides when to coach and when to stay out of the
way. Still to come: the composer actually using it (its instructions live on the box), the
corpus-in/thesis-out conversation mode, and writing the thesis to the venture's knowledge. A founder
does not yet get a founding conversation.

## Why this matters (for the founder)
The first thing a founder should do is not "file a ticket". It is to bring in everything they already
know — the research they have been doing elsewhere, the reports, the half-formed idea — and come out
the other side with a **thesis**: who this is for, what makes it hard to copy, and the first thing to
build.

Right now the studio would take "build me a landing page" and dutifully turn it into a well-formed
piece of work. It would never ask whether a landing page is the right first move, or what would stop
a competitor doing the same thing next month.

## The gap, precisely
We have the material and the composer cannot see it.

The studio ships **8 handbook chapters** and **12 playbook chapters** covering Disciplined
Entrepreneurship's 24 steps and Hamilton Helmer's 7 Powers — including the parts that matter most for
a new venture: that durable advantage comes overwhelmingly from **counter-positioning** and a
**cornered resource**, and that the newcomer's move is only available *before* you have a legacy to
protect.

The composer's instructions mention none of it. Not one reference to either framework. And the
venture brain indexes the **venture's own repo**, not this content — so it cannot search for it
either. The studio teaches a method in one room and gives founders an assistant that has never read
it.

## What the founding conversation should do

**1. Take the corpus in.** A founder arrives with work already done — exports from other chats,
research reports, competitor notes, a deck, customer interviews. They should be able to hand all of
it over at the start, and have it become the venture's knowledge rather than context that evaporates
when the conversation ends. The deposit path already exists (FB-043); this makes it the *first* thing
that happens rather than an afterthought.

**2. Ask the questions the frameworks ask.** Not a quiz — a conversation that goes where the
playbook goes:
- Who *exactly* is this for? (DE steps 1–5: market segmentation, beachhead, the end user, the
  persona.) "Card enthusiasts" is not an answer; the playbook says so and the composer should too.
- What do they do today instead, and what does that cost them?
- **What would stop someone copying this?** This is the question founders skip and the one that
  decides whether the company is worth building.
- Which power is actually available *to a newcomer*: can an incumbent not follow without damaging
  their own business (counter-positioning), or is there something you can hold that others cannot
  (a cornered resource)? Scale economies and network effects are mostly not available yet — say so
  rather than letting a founder claim them.
- **Barriers, not benefits.** A list of features is not a moat. The conversation should push from
  "what it does" to "why it keeps working once someone notices".

**3. Produce a thesis, and save it.** A short document in the founder's own words: who it is for,
what it replaces, the power being built, what would falsify it. Deposited to the venture's knowledge
so every later conversation and every agent lane plans from it. This is the artefact everything else
hangs off — FB-056's founding run already produces a north star and starter backlog; this is what
should feed it.

**4. Only then, work.** The first tickets come *out of* the thesis, and each one should be traceable
to it. A ticket that serves no part of the thesis is a question worth asking out loud.

## Scope
- Make the handbook and playbook **searchable by the composer** — a second brain source alongside the
  venture's own, so it can quote the method rather than paraphrase from memory.
- Extend the composer's instructions with the strategic lens: the questions above, when to push back,
  and the explicit instruction that a feature list is not a moat.
- A **first-run conversation mode** — corpus in, thesis out — distinct from the everyday "turn this
  into a piece of work" mode.
- Write the thesis to the venture's knowledge as a durable document.
- Hand the thesis to FB-056's founding run so the starter backlog derives from it.

## Out of scope
- Replacing `/office-hours` and `/plan-ceo-review` (Gary Tan's lens, already in the engine). This is
  the founder-facing front of the same idea, not a second copy of it.
- Scoring or grading a founder's answers. The composer coaches; it does not mark.

## The judgement to get right
There is a real tension here and the ticket should name it: a founder who wanted to file one small
ticket must not be dragged through a strategy interview. **The coaching belongs at the founding
conversation and at genuinely strategic moments — not on every ask.** Getting that boundary wrong
makes the product exhausting, which is worse than making it shallow.

## Acceptance criteria
- [ ] A founder can hand over a body of existing research at the start and have it become the
      venture's knowledge. — *the deposit path exists (FB-043); making it the first thing that
      happens does not.*
- [x] The composer can quote the studio's own playbook rather than paraphrasing from memory — the
      lens **parses** `content/playbook/09-seven-powers.md`, including each power's own sentence
      about when it becomes buildable, so what gets quoted is the chapter a founder can go and read.
- [x] The conversation reaches "what would stop someone copying this?" and does not accept a feature
      list as the answer — the question carries its own refusal.
- [x] It names which power is realistically available to a newcomer, and says plainly when a claimed
      one is not — `availableAtFounding` / `notYetAvailable`, both derived from the chapter rather
      than restated.
- [ ] A thesis document is produced, in the founder's words, and saved to the venture's knowledge.
- [ ] The first tickets trace to the thesis.
- [x] A founder filing a routine small ticket is **not** taken through any of this — see below.

## The boundary, which is the part worth getting right

The ticket names the tension and it is the whole design problem: *"a founder who wanted to file one
small ticket must not be dragged through a strategy interview."*

`wantsStrategicLens` errs towards silence. It engages on day one (that **is** the founding
conversation), whenever the founder asks, and when the ask is about direction — and otherwise stays
out of the way. The asymmetry is deliberate: a missed coaching moment is an opportunity lost, while
interrogating someone who asked to move a button teaches them that talking to the studio is
expensive, and they stop.

It reads the **question**, not the size of the work. "Rewrite the entire analytics module" is large
and not strategic; "should we charge monthly or per seat?" is small and entirely strategic. Both are
pinned by tests, along with five real asks from ARCA's own backlog that must not trigger it.

## What is left

1. **The composer using it.** Its instructions live in `seed-agent.js` on the box — the same
   hand-copied deploy path as FB-047's runner and FB-060's hand-off.
2. **The conversation mode** — corpus in, thesis out — and writing the thesis to the venture's
   knowledge so later work plans from it.
3. **Handing the thesis to FB-056's founding run**, so the starter backlog derives from it.

## Verification
`/review` + CI, then the real thing: a founding conversation on a venture with no history, starting
from a pile of imported research, ending with a saved thesis and a first ticket that cites it — with
the whole conversation logged.
