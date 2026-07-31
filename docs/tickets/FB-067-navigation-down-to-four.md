# FB-067 — Four destinations, named for what the founder is doing

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-064, FB-065 (both change what a destination
is) · **Repo:** fountainbridge · **Branch:** `fb-067-navigation-down-to-four`
One ticket = one branch = one PR.

## Why this matters (for the founder)
The header offers eight places to go. Three of them — Ventures, Workstreams, Foundry — sit next to
each other, and you cannot tell them apart from the words.

## Context
From the FB-063 walkthrough. The current header is `Ventures · Workstreams · Attention · Activity ·
Foundry · Handbook`, plus a `03 — Foundry Studio` label that is a section number from our own
marketing site. The names describe our information architecture rather than the founder's day.

## Scope
- **Four destinations**, named for the job: **your venture**, **needs you**, **what happened**, and
  the **handbook**.
- **The composer becomes an action, not a destination** — it is something you do from your venture,
  not a place you visit (and after FB-065 it is not elsewhere at all).
- **"Foundry" moves to the public site.** It is the story of how the studio works; it belongs where
  people are deciding whether to join, not in a working founder's header.
- **Drop `03`.** It means something on the Bruntsfield site and nothing here.
- Keep an admin view of all ventures, and make it obviously an admin view.

## Out of scope
- Deleting the content behind the moved pages — it moves, it does not disappear.

## Acceptance criteria
- [ ] Four founder-facing destinations, each named for what the founder is doing there.
- [ ] Nothing in the header requires our vocabulary to understand.
- [ ] The admin's all-ventures view is still reachable and reads as an admin view.
- [ ] No route 404s; moved pages redirect.

## Verification
`/review` + CI, and the walkthrough repeated as a founder to confirm every remaining destination
answers "what should I do here?".
