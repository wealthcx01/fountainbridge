# FB-028 — Bruntsfield Method (jstack) doc + plain-language ticket template

**Phase:** 1 · **Depends on:** — · **Repo:** fountainbridge
**Branch:** `fb-028-jstack-method-and-ticket-template` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Every piece of work in the studio comes to you as a "ticket." This ticket makes sure every ticket
is written so **you** — not an engineer — can read it, understand it, and approve it in under a
minute. It also writes down "the Bruntsfield way" of working so everyone (and every agent) follows
the same method.

## Context
Two related deliverables:
1. **Publish the "Bruntsfield Method" (jstack)** — an **internal reference** from
   `docs/jstack-bruntsfield-method.md`. (Note: at time of writing this source doc does not yet
   exist in the repo; this ticket publishes it as an internal reference and, if absent, the ticket
   includes creating/importing the canonical version. Confirm the source with John.)
2. **Ship a plain-language ticket template** so every founder-facing ticket is easy to action.
   This operationalises the standing requirement that *every ticket be straightforward for a
   non-technical founder* — a founder should be able to read and approve it in under a minute.

The template must be consistent with the existing house style (`# FB-XXX — Title`; header block
with Phase/Depends/Repo/Branch; `## Context / Scope / Out of scope / Acceptance criteria /
Verification`; one ticket = one branch = one PR) **and** add the founder-facing affordances.

## Scope
- **jstack doc:** place/confirm `docs/jstack-bruntsfield-method.md` as the canonical internal
  reference for the Bruntsfield Method; link it from the docs read-order (README / CLAUDE.md
  normative-docs list) as an internal method reference. Internal (not a founder page).
- **Ticket template:** add a template file (e.g. `docs/tickets/_TEMPLATE.md` or
  `docs/ticket-template.md`) capturing the house structure **plus** the non-technical affordances:
  - A mandatory **"Why this matters (for the founder)"** plain-language line near the top (2–4
    sentences, no jargon).
  - Concrete, checkable **Acceptance criteria** phrased so a founder can verify them.
  - A short **"What you're approving"** framing suitable for a one-minute read.
- **Author guidance:** a brief note (in the template or CLAUDE.md/README) stating the rule: every
  founder-facing ticket must be approvable by a non-technical founder in under a minute, and how to
  meet it (plain-language line, jargon-free acceptance criteria).

## Out of scope
- Retro-fitting every existing ticket to the new template (new/founder-facing tickets adopt it;
  a bulk backfill is a separate follow-up if wanted).
- Any UI change — this is docs/process (the studio rendering of tickets is elsewhere).

## Acceptance criteria
- [ ] `docs/jstack-bruntsfield-method.md` exists as the internal Bruntsfield Method reference and
      is linked from the docs read-order.
- [ ] A ticket template file exists, matching the house structure and requiring a plain-language
      "Why this matters (for the founder)" line + founder-checkable acceptance criteria.
- [ ] The under-a-minute, non-technical-founder rule is written down as the standard for
      founder-facing tickets.
- [ ] A sample ticket authored from the template reads cleanly to a non-technical reader.

## Verification
/review + a readability check of the template against a non-technical reader standard.
