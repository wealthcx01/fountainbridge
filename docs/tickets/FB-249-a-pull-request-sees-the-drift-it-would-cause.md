# FB-249 — a pull request sees the ticket drift its own merge would cause

**Status:** Done · **Phase:** 3 · **Found by:** main going red twice on 2026-10-01

## What happened

`ticket-drift` fails CI when a ticket's work is in the history but its status says neither Done nor
what is left. It reads **commit subjects on main**.

A squash-merged pull request's commit does not exist until it merges. So a PR could never see the
drift it was about to cause. It merged green, its own merge commit then named its ticket in main's
history, and **main went red** — with the failure landing on whichever unrelated PR ran next.

It happened twice in one day:

- **#321 (FB-233)** was fine on its own, but the next PR to touch FB-233 inherited the question.
- **#320 (FB-234)** merged green; main's next run failed; #322 and #324 — about other tickets
  entirely — went red for a ticket they never touched.

## And the root cause of the second one was something else

#320 was meant to be a ticket-only change. Its merge commit also contained
`library/launch-video/arca-launch-still.png`: a binary FB-233 had gitignored under D8, swept in by
`git add -A` on a branch cut before the ignore rule existed.

`ticket-drift` only counts a commit as *shipping* a ticket when it touches something outside
`docs/tickets/`. Without the stray image, #320 would not have tripped it at all. **The alarm was
correct; its trigger was an accident** — fixed separately in FB-234's follow-up, which removed the
file.

That is worth keeping as a reason for this change rather than an argument against it: with this in
place, #320 would have **failed its own CI**, and the failure would have pointed at the one file
that should not have been in a ticket-only PR.

## The change

On a pull request, CI passes the PR's **title** — which is what the squash commit's subject will be.
`ticket-drift` counts it as one more commit, first, together with the files the PR changes:

    env:
      DRIFT_PENDING_SUBJECT: ${{ github.event.pull_request.title }}

**Through `env`, never interpolated into `run`.** A PR title is text anybody opening a pull request
controls, and putting it in a shell line is how a workflow gets injected.

On a push to main there is no pull request, the variable is empty, and the check behaves exactly as
before.

## Proved

A scratch ticket at "In progress", run four ways:

| | exit | want |
| --- | --- | --- |
| no PR title — the old blind spot | 0 | 0 |
| PR title names it, PR changes real code | **1** | **1** |
| PR title names an unrelated ticket | 0 | 0 |
| it says honestly what is left | 0 | 0 |

The failure tells the author it is their own PR:

    FB-999 says "In progress" but its work has shipped ((this pull request) FB-999: finish the
    thing). Set its Status to Done — or, if part of it genuinely has not shipped, add a line
    saying so: **Shipped in part:** <what is left>.

The first attempt at that proof passed case 2 when it should have failed — because nothing was
committed yet, so the PR's diff was empty and nothing looked like shipped work. Correct behaviour, and
a wrong test: re-run with the change committed, it fails as it should.

## Acceptance criteria

- [x] A PR that would leave its own ticket drifting fails its own CI.
- [x] A PR about an unrelated ticket is unaffected.
- [x] The title reaches the check without passing through a shell.
- [x] Pushes to main behave exactly as before.

## Not done here

A check that fails when a binary is added under `library/`. That would have stopped the stray image
directly; this only stops it reaching main unnoticed. Worth doing before the next generated asset.
