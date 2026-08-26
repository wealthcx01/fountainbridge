# FB-120 — A founder cannot see, in the studio, the work they just filed

**Status:** Shipped in part · **Area:** Studio / board · **Depends on:** —

**Shipped in part:** the board shows filed tickets and every criterion below is met in code and
covered by tests. What has NOT happened is seeing it on the real ARCA board with the six live filings
on it — the studio's Google OAuth cannot be driven headlessly from this machine, so that check is
John's to make. Everything the box could prove has been proved; this is the part it cannot.

## What a founder gets today

They open the composer, describe what they want, answer a question or two, say yes. The composer
replies with pull-request links. Then they go to the studio to look at their own backlog, and the work
they just approved is not on it.

Concretely, after the dogfood run of 2026-08-23: ARCA's board showed 67 tickets. Five more had just
been filed and approved by the founder that minute. The board showed 67.

## Why

`loadVentureTickets` reads `docs/tickets` at `HEAD` of the venture repo's default branch
(`lib/tickets.ts:222`, `expr: 'HEAD:docs/tickets'`). A ticket the composer files lives on its own
`foundry/<slug>` branch and reaches the default branch only when its pull request is merged. Until
then the file the founder approved exists, is readable, and is nowhere the studio looks.

It is not invisible, exactly — it is worse than invisible. The pull request shows up in the attention
queue, fails to match any card on the board, and falls into `unmatchedWork`
(`app/venture/[id]/page.tsx:171-176`), which renders **a pull-request number and the PR's title**.
So the founder sees `#58 Research: which auction houses we can realistically pull live listings from`
and cannot see the thing they actually approved: why it matters, what is in scope, what is explicitly
left alone, what "done" means. The acceptance criteria they were shown in chat and said yes to are not
reachable from the studio at all.

## Why this is the gap that matters most

Every other part of the loop is real. The composer researches, drafts, gates, and files. The lane
picks the work up. The approval record signs what goes out. This is the one seam where the founder is
handed a GitHub URL and told to go and read a diff — the exact thing a non-technical founder was
promised they would never have to do.

It also quietly undoes the read-back. The composer's whole discipline is "here is what I will file,
in plain English, say yes". A founder who says yes and then cannot find that text anywhere has been
asked to approve something they cannot re-read. Consent you cannot revisit is a weaker thing than it
looked at the time.

And it is the first impression. The board is where a founder goes to feel that the studio is theirs.
Filing five pieces of work and seeing the number stay the same reads as "it didn't work" — which is
the same failure as an error, arrived at by a different route.

## Scope

- Show tickets that are filed but not merged, on the board, as their own state. Not as pull requests
  — as tickets, with the id, title, why-it-matters, scope and acceptance criteria the founder
  approved, read from the branch the file is actually on.
- Distinguish that state plainly. "Filed — waiting to be picked up" is a different thing from Todo,
  and a founder should be able to tell at a glance which of their asks have landed in the backlog and
  which are still on their way in.
- Keep the dependency lines resolvable: a filed-not-merged ticket may depend on another filed-not-merged
  ticket (a set files as a chain, FB-119), and neither is on the default branch yet.
- Stay inside the request budget. The rule from FB-083 holds: bounded per page load, never repeating
  on a timer. One extra read per open ticket branch is the shape; a poll is not.
- Cover it: a board with a filed-not-merged ticket, one where the same ticket then merges (and must
  not appear twice), and one where the PR is closed unmerged (and must stop appearing).

## Out of scope

- Merging tickets from the studio. This is about seeing what was filed, not approving it — and the
  approval path for engineering work is the pull request, which is deliberate (CLAUDE.md #4 gates
  external actions; internal merges are hygiene).
- Editing a ticket from the board. Revision goes through the composer today, which is the right
  place for it.
- The composer's own confirmation copy. It hands back a link because that is all it has; once the
  board can show a filed ticket, what it should say instead is worth revisiting separately.
- Streaming tool results into the composer (FB-106's open criterion) — adjacent, separate.

## Acceptance criteria

- [x] A ticket filed through the composer appears on the venture board within one refresh, before its
      pull request is merged.
- [x] It shows the ticket a founder approved — id, title, why it matters, scope, acceptance criteria —
      not a pull-request number and title. The card opens the same drawer every other ticket does.
- [x] Its state is distinguishable from Todo in plain English: a **Just filed** column that says
      "You approved these. They join the list below once your team accepts them." The word branch
      does not appear.
- [x] When the pull request merges, the ticket stays on the board once — `withoutAlreadyOnBoard`
      covers the window where the cached PR listing and the default branch both have it.
- [x] When the pull request is closed without merging, the ticket leaves the board.
- [x] The added GitHub reads are bounded per page load, with a test that puts 200 tickets in the
      backlog and asserts the read count is 2 (FB-083).
- [ ] Seen on the real ARCA board with its six live filings. Needs a signed-in browser; John's to do.

Dropped from the original list: *"a set of tickets that depend on each other resolves those
dependencies while all of them are still unmerged"*. Dependency resolution on the board reads ids out
of `ticketTitles`, which is built from what is rendered — so filed tickets joining the board makes
this true without any code that knows about it. There is nothing to build and nothing to test that
would not be testing the existing renderer.
