# FB-067 — Four destinations, named for what the founder is doing

**Status:** Done · **Phase:** 3 · **Depends on:** FB-064, FB-065 (both change what a destination
is) · **Repo:** fountainbridge · **Branch:** `fb-067-navigation-down-to-four`
One ticket = one branch = one PR.

## Why this matters (for the founder)
The header offers eight places to go. Three of them — Ventures, Workstreams, Foundry — sit next to
each other, and you cannot tell them apart from the words.

## Context
From the FB-063 walkthrough. The current header is `Ventures · Workstreams · Attention · Activity ·
Foundry · Handbook`, plus a `03 — Foundry Studio` label that is a section number from our own
marketing site. The names describe how we organised the software, not what the founder came to do.

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
- [x] Four destinations: **Your venture · Needs you · What happened · Handbook**.
- [x] Nothing in the header requires our vocabulary. "Workstreams" and "Foundry" are gone; `03` — a
      section number from the Bruntsfield marketing site, meaningless here — is gone with them.
- [x] The admin's view reads as one: the first item says **All ventures** for an admin and
      **Your venture** for a founder.
- [x] No route 404s. Nothing redirects, because nothing needed to: the pages were unlinked, not
      moved, and both are now reachable from the handbook.

## The names match the pages they lead to
"Needs you" and "What happened" are the headings on those pages (FB-076, FB-080). A founder who
clicks a word arrives somewhere that uses the same word. That was not true before: **Attention** led
to *Awaiting review*, and **Activity** led to *CI & activity*.

The composer is deliberately absent. After FB-065 it is something you do from your venture, not a
place you visit.

## Where the two removed pages went
Neither is deleted — the ticket was explicit that they move rather than disappear.

- **Workstreams** (`/lanes`) was a cross-venture view of lanes the venture board already shows. It is
  reachable and unlinked.
- **Foundry** (`/foundry`) is the story of how the studio works. The ticket says it belongs on the
  public site, where people are deciding whether to join. **There is no public site yet**, so it
  moved to the handbook rather than to nowhere — alongside the playbook, which had the same problem
  and was not in the header either. Stated as a compromise rather than the plan.

## Verification
`/review` + CI, and the walkthrough repeated as a founder to confirm every remaining destination
answers "what should I do here?".
