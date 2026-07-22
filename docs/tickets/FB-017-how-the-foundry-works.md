# FB-017 — "How the Foundry works" pages (our system)

**Phase:** 1 · **Depends on:** FB-005, FB-015 · **Repo:** fountainbridge
**Branch:** `fb-017-how-it-works` · One ticket = one branch = one PR.

## Context
Founder-facing pages that explain, in plain language, how a Foundry venture actually gets built and
sold — the real machinery, our way. This is where the "virtual co-founder" is made concrete: the
agent lanes, the tooling, and the human gates. Extensible as the system grows.

## Scope
- Pages (rendered from `content/` markdown, behind login) covering the parts of the system, accurate
  to how it really works:
  - **gstack** — the skill/workflow pack the lanes run on (plan → review → ship gates).
  - **gbrain** — durable memory the lanes and studio draw on.
  - **ActiveGraph** — the approval/event gate for external actions (email, social, CRM, payments).
  - **Ticket / branch / PR flow** — one ticket = one branch = one PR; never self-merge.
  - **Lanes on a VPS** — one venture, one box; agents doing the work in tmux.
  - **The approval matrix (D7)** — founder / Bruntsfield / dual, routed via the attention queue.
- Written in our own words, accurate, and structured so new capabilities slot in over time.
- grassmarket branding; mobile-usable.

## Out of scope
Marketing/positioning narrative (FB-016); the frameworks (FB-018).

## Acceptance criteria
- [ ] A page per system component above, accurate and legible to a non-engineer founder.
- [ ] Content in `content/`, behind login, mobile-usable; easy to extend with new sections.

## Verification
/review + /qa + UI-gate.
