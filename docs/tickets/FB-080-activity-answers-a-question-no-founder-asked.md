# FB-080 — "Activity" answers a question no founder has ever asked

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-008 (CI status and activity), FB-042 (run
reports) · **Repo:** fountainbridge ·
**Branch:** `fb-080-activity-answers-a-question-no-founder-asked` · One ticket = one branch = one PR.

## Why this matters (for the founder)
There is a page in the studio called **Activity**. A founder clicking it reasonably expects to find
out what has been happening in their company.

What they find is three and a bit screens beginning **"CI & activity"** and then, for each
repository: *"no CI runs · unprotected · active"*.

`unprotected` is a GitHub branch-protection setting. `no CI runs` means nobody has configured
automated tests. Neither is a thing that happened. Neither is a thing a founder can act on. The page
is a repository administration report wearing the word "Activity".

## What was found
Walked on 2026-08-01, signed in, on `/activity`. Measured rather than eyeballed:

- **2,994 pixels tall** — 3.3 full screens at a normal window.
- **55,846 characters** of text.
- **61 rows and blocks.**

The first 500 characters, verbatim:

> CI & activity · refresh · ARCA · arca · arca · no CI runs · unprotected · active · arca-marketing ·
> no CI runs · unprotected · active · arca-ops · no CI runs · unprotected · active · Modernisation
> Engine · modernisation-engine · no CI runs · unprotected · active · THE RESET · thereset-platform ·
> Repository wealthcx01/thereset-platform not found · thereset-marketing · Repository
> wealthcx01/thereset-marketing not found…

Four separate problems.

**The heading is machine vocabulary.** "CI & activity" names a system, not a question. A founder does
not know what CI is and should not need to.

**Every repository reports its branch protection.** `unprotected` is true, is an engineering concern,
and is genuinely important — to Bruntsfield, not to Ross. It belongs on an operations surface.

**"No CI runs" reads as a fault.** It is the normal state for a young venture that has not set up
tests yet. FB-064 already learned to phrase this honestly on the work view — *"this work has no
automatic checks"*. The same fact is a red flag here and a plain statement there.

**The failures repeat.** `Repository wealthcx01/thereset-platform not found` appears here, and on the
attention queue (FB-076), and on the venture board. One setup problem, told three times, in three
slightly different wordings.

The page also duplicates what the venture board already shows. FB-042 put the lane activity strip and
the founder brief on the board, which is where a founder actually is. This page predates that and was
never revisited.

## The question it should answer
"What has been happening?" — a single, readable stream, newest first, in the founder's language:

- *"Your team finished the price-refresh work. It is waiting for your OK."*
- *"Nothing has happened on the marketing side for two weeks."*
- *"A check on the pricing work failed, so nothing shipped."*

Things that happened, in order, each with a next step where there is one. Everything currently on the
page — branch protection, CI configuration, repository reachability — is state, not activity, and
belongs somewhere a founder is not.

## Scope
- **Rewrite the page around events, not state.** One stream, newest first, in plain language.
- **Move repository administration off it.** Branch protection and check configuration are real
  concerns with a real audience; the studio should have somewhere for Bruntsfield to see them, and it
  is not the founder's Activity page.
- **Say "no automatic checks" the way the work view says it**, and only where it is relevant to
  something the founder is looking at.
- **Stop repeating the same failure on three surfaces.** A missing repository is a setup problem: say
  it once, in the place a founder can do something about it, and let the other surfaces be quiet.
- **Decide whether this page should exist at all.** The venture board already carries the brief and
  the lane activity. If Activity is only a longer version of the strip, the honest answer may be to
  merge them and remove a destination from the header — which helps FB-067 as a side effect.

## Out of scope
- The header's size (FB-067) and the wording of the attention queue (FB-076), though this ticket
  should agree with both.
- Run report content itself (FB-060).

## Acceptance criteria
- [ ] The page answers "what has been happening", in order, in the founder's language.
- [ ] No branch-protection or CI-configuration state appears on a founder surface.
- [ ] A young venture with no tests configured reads as normal, not as broken.
- [ ] A missing repository is reported once across the studio, where it can be acted on.
- [ ] The ticket records a decision, with reasons, on whether this page survives as its own
      destination.

## Verification
`/review` + CI, then the same walk: open Activity as a founder and record the page height, the
character count and the first 500 characters, as this ticket did. Both counts should fall
substantially, and nothing in the first 500 characters should be a word a founder would have to look
up.
