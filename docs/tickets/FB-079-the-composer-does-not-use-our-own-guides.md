# FB-079 — The composer does not use our own guides

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-013 (the playbook), FB-018 (the frameworks),
FB-065 (the composer inside the studio) · **Repo:** fountainbridge (+ venture box) ·
**Branch:** `fb-079-the-composer-does-not-use-our-own-guides` · One ticket = one branch = one PR.

## Why this matters (for the founder)
The whole argument for a co-created venture is that Bruntsfield brings a way of doing this — a real
method, not just machines that write code. That method is written down, and the studio will happily
show it to you as pages you can go and read.

The thing you actually talk to has never heard of it. Ask the composer for something and it shapes a
competent ticket. It never asks the question the method exists to make you answer.

## What was found
Checked on 2026-08-01, directly.

**The guides exist**, in this repository, rendered by the studio:

- `content/playbook/` — the Disciplined Entrepreneur arc: `02-de-customer`, `03-de-value`,
  `04-de-acquire`, `05-de-money`, `06-de-build`, `07-de-scale`, plus `08-moats` and
  `09-seven-powers`.
- `content/handbook/` — how to build, how to sell, how to scale, and the Bruntsfield playbook itself.

**The composer's own instructions reference none of them.** A search of `deploy/librechat/
seed-agent.js` — the single source of truth for both agents' prompts — for *disciplined
entrepreneur*, *7 powers*, *seven powers*, *counter-position*, *cornered resource*, *beachhead* and
*jobs to be done* returns **zero matches**.

So the studio holds a method, renders the method, and then has a conversation that ignores it. A
founder can read `09-seven-powers.md` on Tuesday and get a ticket on Wednesday that never once asks
what would stop a competitor doing the same thing.

## What "using the guides" should and should not mean
The failure mode to avoid is a composer that lectures. A founder asking for a stale price fix does not
want a seminar on counter-positioning, and a tool that answers every request with a framework becomes
one people route around.

The useful version is narrower: **the method changes which questions get asked, and when.**

- For a small, well-understood ask, nothing changes. Fix the prices.
- For anything that shapes what the venture *is* — a new surface, a pricing decision, a market, a
  first customer — one question from the method, at the moment it is cheap to answer.
- For the founding conversation specifically (FB-069), the method is the structure rather than an
  aside.

The two specific ideas John named are worth stating plainly, because they are the ones that most
change a ticket: **most durable advantage for a new company comes from counter-positioning or from a
cornered resource**, and **a moat is built out of barriers, not out of benefits**. A composer that has
those two sentences in mind asks "what would stop the obvious competitor copying this next month?"
instead of writing a better acceptance criterion.

## Scope
- **Put the method in the composer's instructions** — the ideas, not a reading list. It should be able
  to use them without the founder having read anything.
- **Let it cite the page.** When a framework shapes a question, the composer should be able to point
  at the studio's own page for it, so the founder can go deeper if they want. The guides are already
  rendered at `/playbook` and `/handbook`; the link is free.
- **Gate it on the size of the ask.** Small asks stay small. The trigger should be about what the ask
  changes, not about how it is phrased.
- **One question, not a checklist.** The composer already asks well; this changes what it asks about,
  not how much it asks.
- **Keep it in one place.** The prompts live in `seed-agent.js` by design (FB-033), and the guides
  live in `content/`. Duplicating the method into the prompt means two copies that will drift; the
  ticket should decide whether the prompt references the content or embeds a distilled version, and
  say why.
- **Make it visible that this happened.** If the composer asks a positioning question, a founder
  should be able to tell it came from the method rather than from nowhere.

## Out of scope
- The founding conversation itself (FB-069) — that is a bigger surface with its own shape, and it
  needs John's wording. This ticket is about the everyday composer.
- Writing new guide content. What exists is enough to start.

## Acceptance criteria
- [ ] A venture-shaping ask draws one relevant question from the method.
- [ ] A small maintenance ask draws none.
- [ ] Where a framework is used, the founder can reach the studio's own page for it.
- [ ] The method exists in one place, and the ticket says how drift is prevented.
- [ ] The composer never lectures: no request produces an unasked-for summary of a framework.

## Verification
`/review` + CI, then three real asks on ARCA, with the replies recorded in the ticket:

1. *"Card prices look stale"* — a maintenance ask. No framework question. Unchanged from today.
2. *"I want to add a paid tier for serious collectors"* — a pricing and positioning ask. Should ask
   what a competitor would have to give up to copy it, and should be able to point at
   `09-seven-powers`.
3. *"Who should we be selling to first?"* — should reach for the beachhead idea rather than
   generalities.

The judgement to record honestly in the ticket: did the question make the resulting work better, or
did it just make the conversation longer?
