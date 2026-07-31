# FB-064 — Read and accept work without leaving the studio

**Status:** In review · **Phase:** 3 · **Depends on:** FB-007 (the attention queue), FB-020 (GitHub App),
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
- **Show the change in a way a non-technical founder can judge.** For prose and configuration — which
  is most of what a founder's tickets produce — render the before/after readably. For source code,
  do not pretend: say plainly that this part is code, summarise what it touches, and offer the
  preview and the check results as the evidence they can actually act on. **Never dress a diff up as
  something it is not.**
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

So changes are **classified by what they mean to a founder**, not by file extension: the description
of the work, writing, something your venture knows, a change to the app, settings. The first three
are rendered. The last two are *described* — what it touches, how big it is — alongside the evidence
that actually bears on the decision: did the checks pass, is there a preview to look at.

That is not a limitation to apologise for. The lane has already reviewed and tested its own work
(FB-041's `/review` and `/qa` gates run before the PR exists). The founder is accepting an outcome,
not auditing an implementation.

## Still open
- ❌ **`previewUrl` is still not populated.** Railway PR environments were switched on the same day,
  so the field can now be filled from the deployment — but wiring it is its own change and this
  ticket did not do it. The view renders the link correctly when the value is there.
- ⚠ **The accept path has no live test against a real repository.** The unit tests cover every
  refusal and the e2e covers the rendered surface, but nothing has merged a real pull request through
  this button yet. That wants doing on ARCA before a founder relies on it.

## Verification
25 unit tests over the read model (classification, readable extraction, the honest description, and
every refusal path) plus 7 Playwright over the rendered surface — including an assertion that **no
link on either page points at github.com**, which is the regression that would undo this ticket.

Driven in a real browser: attention queue → click the title → the work view renders the ticket body
as prose, describes the code change as "a small change to the app's code (seed.ts) — 31 lines added,
8 removed", reports the checks, and offers one button. Work with checks still running shows no button
and says "give it a few minutes and refresh" instead.
