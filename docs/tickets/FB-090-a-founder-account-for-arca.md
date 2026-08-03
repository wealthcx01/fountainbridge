# FB-090 — A founder account for ARCA, separate from the admin one

**Status:** Done · **Phase:** 0 · **Asked for by:** John, 2026-08-03 — *"do we have an account or demo
access where I can login to ARCA as a single founder and try the journey?"* · **Repo:** fountainbridge ·
**Branch:** `fb-090-arca-founder-account` · One ticket = one branch = one PR.

## The problem

There was no way to see what a founder sees.

`STUDIO_ADMIN_EMAILS` holds **both** of John's addresses — `john@bruntsfield.capital` and
`john.gallagher@wealthcx.com` — and `ventures/arca.yaml` named the first of them as ARCA's founder. So
whichever he signed in with, he got the Bruntsfield view: every venture, the activity page,
repository health, the admin-only wiring warnings.

That is the right access for running the studio and the wrong access for judging it. Every walkthrough
either of us had done was through an admin's eyes, on a product whose entire purpose is what a
**founder** experiences. Ross arrives today and would have been the first person to see the real
thing.

## The change

ARCA's founder is now `arca.founder@bruntsfield.capital` — an account that already existed on the
box's chat, is in no admin list, and is on the shared Bruntsfield Workspace (D3).

John keeps full admin on both his own addresses; he simply now has a third door that shows him ARCA
and nothing else. The manifest carries the reasoning, because "why is the founder not John?" is
exactly the question someone will ask in three months.

## What it actually produces, measured

Both accounts were driven through a production build carrying production environment:

| | `arca.founder@` | `john@` (admin) |
| --- | --- | --- |
| Navigation | **"Your venture"** | "All ventures" |
| Ventures listed | **ARCA only** | ARCA, modernisation-engine, the-reset |
| `/venture/the-reset` | **refused** | visible |
| Admin wiring warning | not shown | shown when it applies |
| Composer | the box's chat | the box's chat |

The refusal is server-side, before any data fetch (CLAUDE.md #6) — the founder is not merely missing a
link to another venture, the studio will not serve them its data.

This is the same shape of access Ross will have on THE RESET, whose manifest already names
`ross@bruntsfield.capital`. So exercising this account is a rehearsal for his first day, not a
simulation of one.

## Why not simply drop John's address from the admin list

That was the alternative, and it is fewer moving parts. John chose a separate account instead, which
has one clear advantage: he can hold both views at once — sign in as the founder to judge the
experience, and as himself to fix what he finds, without editing an environment variable between the
two.

## The one thing not verified

The box's chat (`chat.arca.bruntsfield.capital`) signs in through Google Workspace, which cannot be
driven headlessly. The agents carry a **public view grant**, so any signed-in user on that box sees
the composer, and `arca.founder@bruntsfield.capital` already exists there as a user — but that the
agent list renders for that specific account is reasoned, not observed. It is the first thing to check
on the real walkthrough.

## Explicitly NOT in this pull request

- Removing either address from `STUDIO_ADMIN_EMAILS`. Both stay admin, deliberately.
- Changing who owns the agents on the box. The author stays `john@bruntsfield.capital`; the public
  view grant is what makes them usable by the founder, and re-pointing ownership would risk the
  working composer for no gain today.

## Acceptance criteria

- [x] The founder account sees ARCA and no other venture.
- [x] Another venture is refused server-side, not just unlinked.
- [x] Admin-only surfaces stay hidden from it.
- [x] Both of John's addresses keep full admin.
- [x] All manifests still validate against the bcap-contracts schema.

## Verification

Driven end to end against a production build with production environment, both accounts side by side —
the table above is measured output, not intent. 658 unit tests green; 4/4 manifests valid.
