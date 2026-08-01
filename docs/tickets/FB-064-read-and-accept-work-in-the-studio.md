# FB-064 — Read and accept work without leaving the studio

**Status:** Done · **Phase:** 3 · **Depends on:** FB-007 (the attention queue), FB-020 (GitHub App),
FB-046 (the approve pattern) · **Repo:** fountainbridge ·
**Branch:** `fb-064-read-and-accept-work-in-the-studio` · One ticket = one branch = one PR.

## Why this matters (for the founder)
You described what you wanted, the composer drafted it, you approved it — and then there was nowhere
to go. To see the work, read it, or accept it, you had to open github.com. This is the ticket that
means you never have to.

## What is actually broken
Found by dogfooding ARCA end to end on 2026-07-31 and then asking the obvious question: *now what?*

The Attention page says, in our own words:

> **Awaiting review.** Everything across your ventures waiting on your OK. Nothing goes live until
> you approve it.

Underneath that promise, the only thing a founder can click is `PR #10 ↗` — a link out of the
product, into a developer tool they were never meant to open. Seven steps in the loop, and **three of
them happen somewhere else**:

```
describe it → composer drafts → you approve →  [ leave for GitHub → read a diff → merge ]  → come back
```

There is a second, quieter problem hiding in the same place. The studio has **two kinds of decision**
that look nothing alike. An *external action* — a send — has a real Approve button, a cost, a
provenance line and a recorded grant (FB-044/046/051). A *piece of work* has a hyperlink. Nothing
tells the founder why one is a considered decision inside the product and the other is a trip to a
code host.

## What we already have
Most of the reading half exists. `lib/attention.ts` already resolves, per open pull request: title,
number, author, age, linked ticket, CI status, and a `previewUrl` field that has had nothing behind it
until now (Railway PR environments were enabled 2026-07-31, so it can be populated). `lib/github.ts`
already has `getFileContent`, `getFileWithSha`, `listDir` and `putFile`.

Missing: **what changed**, and **accept**.

## Scope
- **A work detail view inside the studio.** From the attention queue, a founder opens a piece of work
  and sees: what it does in plain language (the ticket body, not the commit log), what changed, the
  checks and whether they passed, and the preview link when one exists.
- **Show the change in a way a founder can judge.** Most of what a founder's tickets produce is
  prose. Render that so they can read it. For source code, do not pretend: say plainly that this part
  is code, say what it touches, and give them the preview and the check results instead — that is the
  evidence they can actually act on. **Never dress a diff up as something it is not.**
- **An Accept button that merges**, using a write-scoped credential the read App does not hold —
  the same split FB-046 established for `STUDIO_APPROVAL_GITHUB_TOKEN`.
- **Refuse to merge what should not be merged**, in the founder's language: checks still running,
  checks failed, conflicts, or a branch that has moved since the page was rendered — the same
  render-vs-click binding FB-058 added to approvals.
- **One shape for both kinds of decision.** A send and a piece of work should differ in *what they
  say*, not in *what kind of object they are*. The founder learns one pattern.
- **Populate `previewUrl`** from the Railway PR environment now that they exist.

## Out of scope
- Line-level code review, comments, requesting changes. A founder is accepting an outcome, not
  reviewing an implementation — that is what the lane's own `/review` and CI are for.
- Anything that lets a founder edit code in the studio.

## Acceptance criteria
- [x] **A founder can go from the queue to accepted without leaving the studio.** The attention
      queue's title now opens `/venture/<id>/work/<repo>/<number>` instead of github.com, and the
      route carries the short repo name so no founder-facing URL contains an owner.
- [x] **The view shows what changed, the checks, and the preview.** Preview is a separate link now
      rather than the only thing to click.
- [x] **Accept is refused, in plain language, with what to do about it** — checks failing ("leave it,
      the team that made it will see the failure"), checks running ("give it a few minutes"), a clash,
      or work that changed after the page rendered.
- [x] **Merging uses the write-scoped credential**; the read App stays read-only.
- [x] **A send and a piece of work present the same way** — same card shape, same single button, same
      "here is what we can and cannot tell you" line.
- [x] **Code is described, never rendered as a diff.** See below.

## The rule this ticket is really about

A founder can genuinely judge prose — a ticket, a piece of copy, something they deposited. They
cannot judge a TypeScript diff, and showing them one dressed up as a review is asking them to
rubber-stamp what they cannot read.

So changes are sorted by **what they mean to a founder**, not by file type: the description of the
work, writing, something your venture knows, a change to the app, settings.

The first three are shown. The last two are described — what it touches, how big it is. Beside them
sits the evidence that actually bears on the decision: did the checks pass, and is there a preview to
look at.

That is not a limitation to apologise for. The lane has already reviewed and tested its own work
(FB-041's `/review` and `/qa` gates run before the PR exists). The founder is accepting an outcome,
not auditing an implementation.

## Still open
- ⚠ **`fountainbridge` is not a venture repo, so the studio cannot show its own work.** The preview
  link is verified against the real Railway payload, but no founder-facing route reaches this repo's
  PRs. That is correct for now — a founder should not be reading the studio's own changes — but it
  means the preview link has never been *clicked* from inside the studio. It will be the first time a
  venture repo deploys per-PR.

## What the live test found
Nothing here was found by the unit tests or the UI gate. All of it came from pointing the built app
at real GitHub credentials and clicking the button.

**Every ARCA PR was permanently unacceptable.** GitHub answers `/commits/:sha/status` with
`state: "pending"` when a commit has *no* statuses at all (`total_count: 0`). ARCA has no CI, so the
studio told the founder "the automatic checks are still running — give it a few minutes and refresh"
forever, and the accept button never appeared. The whole surface was inert for the one venture it was
built for.

**And this studio's own PRs were being called green off the deploy alone.** The commit-status endpoint
does not include GitHub Actions at all — those are *check runs*, a separate system. PR #67 has one
commit status (the Railway deploy) and eighteen check runs (the real CI). "All automatic checks passed"
was reading the deploy and nothing else: a CI failure with a healthy deploy would have shown as clean.

Both are now read through `combineChecks`, which merges the two systems, and the fix carries into the
attention queue's CI dot, which had the same two faults. Three states are now distinguished where
there used to be one:

| | means | can the founder accept? |
|---|---|---|
| `pending` | something is genuinely still running | no — wait |
| `unknown` | this work has no automatic checks | **yes** — nothing to wait for |
| `unavailable` | the studio could not find out | no — and it says the fault is the studio's |

The last one matters: a gate that cannot read its own evidence must block rather than guess, and the
old code returned `unknown` on a failed read, which would have counted as a pass.

**Two more false-green paths closed in review.** `/check-runs` is paginated and the client does not
page, so a failing run on the second page would have read as green — the request now asks for the
maximum page and reports `unavailable` rather than a verdict if GitHub says there are more. And the
file list stops at 50, so a 300-file change announced itself as a 50-file one; the count now comes
from GitHub's own `changed_files`, which is the only honest total.

## Verification
43 unit tests over the read model — classification, readable extraction, the honest description,
every refusal path, and both ways the check reading was wrong — plus 7 Playwright over the rendered
surface, including an assertion that **no link on either page points at github.com**, which is the
regression that would undo this ticket.

Driven in a real browser against fixtures: attention queue → click the title → the work view renders
the ticket body as prose, describes the code change as "a small change to the app's code (seed.ts) —
31 lines added, 8 removed", reports the checks, and offers one button. Work with checks still running
shows no button and says "give it a few minutes and refresh" instead.

**Then driven against live GitHub, which is where the real faults were.** A production build with the
studio's own credentials, signed in as john.gallagher@wealthcx.com (Google is the only real provider;
the e2e credentials form is the one identity shortcut — every authorization check and the merge itself
ran for real):

- `arca#23` renders live: the lane's full gate evidence under "what the team says about it", the code
  change described rather than diffed, and — before the fix — a permanent "checks are still running".
- **`arca#21` was merged through the Accept button**: squash commit `9b69869`, 2026-07-31 21:18 UTC,
  by the studio's write token. The founder-facing loop now closes without github.com.
- The preview link resolves against the real Railway payload for this PR
  (`foundry-studio-fountainbridge-pr-67.up.railway.app`, health 200) — the app host is read out of the
  status *description*, because Railway puts its own dashboard in `target_url` and a "See it running"
  link that opens a deployment console is a broken promise.
