# FB-064 — Read and accept work without leaving the studio

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-007 (the attention queue), FB-020 (GitHub App),
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
- [ ] A founder can go from "the composer filed it" to "it is accepted and merged" without leaving
      the studio, and without seeing a repository or branch name.
- [ ] The work detail view shows what changed, the checks, and the preview when there is one.
- [ ] Accept is refused, with a plain-language reason, when checks are failing, still running, the
      branch conflicts, or the work changed after the page was rendered.
- [ ] Merging uses the write-scoped credential; the read App stays read-only.
- [ ] A send and a piece of work present as the same kind of decision.
- [ ] Code changes are described honestly rather than rendered as a diff a founder cannot judge.

## Verification
`/review` + CI, and the walk itself: file a ticket through the composer, accept it in the studio, and
confirm the lane picks it up — with the whole path screenshotted and no github.com in it.
