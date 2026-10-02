# FB-169 — the venture brain holds two of ARCA's seven corpus documents

**Status:** Shipped in part · **Phase:** 3 · **Found by:** FB-165, on the ARCA box

## What is wrong

ARCA's repo tracks seven founder-corpus documents. The venture brain has indexed two of them.

```
git ls-files context library          gbrain: findable?
context/README.md                     no
context/build/auction-aggregator-v1-scope.md   no
context/build/kraken-d-source-mismatch.md      no
context/build/no-fake-demo-data-policy.md      no
context/sell/arca-brand-positioning.md         YES
context/sell/market-note-terminal-wedge.md     YES
library/README.md                     no
```

Measured 2026-09-02, twenty minutes after a successful sync (`venture — 177 pages, last sync
2026-09-02T14:45:05Z`). `gbrain search "demo data"` — a keyword search, not a semantic one — returns
nothing from `no-fake-demo-data-policy.md`, whose filename and first paragraph both contain the
phrase. `gbrain search "premium because it is earned"` returns `context/sell/arca-brand-positioning`
at 0.885. The Sell pages are in; the Build pages are not findable by any query tried.

Ruled out:

- **Not gitignored, not untracked.** All seven appear in `git ls-files`; `git status` shows nothing
  untracked; `.git/info/exclude` lists only `.foundry-proposal.json`, `.gbrain-source`, `.gbrain/`.
  (`build/` as a department id colliding with a standard ignore pattern was the obvious suspect and
  is not the cause — ARCA's `.gitignore` has only `*.tsbuildinfo`.)
- **Not missing from disk.** All five are present in the indexed worktree `/opt/foundry/lane/arca`.
- **Not a stale index.** The sync ran, and reported 177 pages.
- **Not a content shape.** The skipped files are ordinary markdown with an `# ` H1, structurally
  indistinguishable from the two that indexed.

## Why it matters more than it looks

This is the quiet version of the failure the whole studio is built against. The founder deposits a
policy — *"ARCA never fills empty panels with sample data"* — the studio's Memory screen lists it,
the lane's RESEARCH step reports "brain returned 5 relevant page(s)", and the policy was never
among them. Every surface says the knowledge is there. Nothing says it is not being read.

FB-156 now records which documents each run actually read, so from today this is visible on the
Memory screen as a document that never appears in `Last used`. That is a symptom, not a fix.

## Scope

- Find why the five are skipped. Start with the sync walk in `deploy/lane/gbrain-refresh.sh` and the
  schema pack's file selection — `gbrain pages list` is not available on the pinned version
  (0.42.67.0), so getting an authoritative list of what IS indexed is step one.
- The box is four minor versions behind (0.48.1.0 available). Establish whether this is fixed
  upstream before debugging the pinned version.
- A check that fails loudly when the corpus on disk and the corpus in the index disagree. A brain
  silently holding a subset is the same class as FB-161's thousand-file cap: a correct-looking
  answer about a smaller world.

## What was wrong (found 2026-10-01)

**gbrain never reads a folder named `build`.** It treats `build/` as compiled program output, the
same as `node_modules/` and `dist/`, and skips it at every depth. There is no setting to turn that
off (gbrain `src/core/sync.ts`, `PRUNE_DIR_NAMES`). Each venture keeps its knowledge in
`context/<department>/`, and one of the departments is called Build. So **every Build document of
every venture was invisible to its brain.** The two READMEs are skipped on purpose and are only each
folder's own explanation, so the real count was three of five documents missing, not five of seven.

A second fault turned up on the way: the step that tags each page with its department matched page
names written with dashes (`context-sell-x`), but gbrain names pages with slashes
(`context/sell/x`, read from the ARCA box). It has never tagged a page.

## What this change does

- Build's documents now go in `context/product/` (and `library/product/`). The department is
  already shown as "Build — Product". The old `build/` folder still reads as Build, so nothing
  filed there disappears from the studio.
- The tool that saves a founder's document, the brain on the box, and the studio's Memory screen all
  use the same folder for each department. A test fails if they ever disagree, or if any
  department's folder is one gbrain skips.
- After every sync, the box compares the documents in git with the pages in the brain. If any are
  missing it names them, writes them to `state/brain-corpus-gap`, and the sync fails (exit code 3),
  so the timer shows red instead of "done".
- Each run's report then says the brain is incomplete and how many documents it cannot see, next to
  where it already says when the brain is stale.
- The department tagging now matches gbrain's real page names.

## The Memory screen shows the count (second pull request, 2026-10-02)

The count used to reach a founder only inside each run's report. Now it is on the Memory screen,
in one sentence under the table of documents.

- After every sync, the box writes the answer to `state/brain-corpus.json`. It writes it every
  time, **including when nothing is missing**, so "none missing" is a measured answer and not just
  the absence of a file.
- The sync holds no GitHub access, on purpose. So the lane, which already writes to the venture's
  `foundry-state` record every few minutes, copies the answer to `health/brain-corpus.json` there.
  It copies only when the answer changes, or once a day, so the record does not gain a change on
  every wake.
- The Memory screen reads it and says one of five things:
  - nothing checks yet, so the studio cannot say whether any are missing;
  - the studio could not read the check;
  - the last check did not finish;
  - your team can find all N of your documents;
  - your team cannot find N of your M documents, named, and that this is for Bruntsfield to fix.

  An answer more than two days old also says it may be out of date.

  When the machine cannot list what its index holds (for example, the wait for the index's lock
  runs out), the answer is "the last check did not finish". It is never "every document is
  missing". And when the table lists documents the check does not count — another surface's
  documents, or a folder's own README — the sentence says how many, so its count and the table
  never quietly disagree.

On ARCA today the screen says "Nothing checks yet", because the box does not have the new lane
files. That is the honest answer until they are copied there.

## What is left

- **ARCA's three files are already moved.** Checked 2026-10-02: `context/product/` in the ARCA repo
  holds `auction-aggregator-v1-scope.md`, `kraken-d-source-mismatch.md` and
  `no-fake-demo-data-policy.md`, and `context/build/` no longer exists.
- **Put the new lane files on the ARCA box** and run a full sync, then search for each of the five
  documents. This also starts the Memory screen's count. Box deploys wait for John's approval.

**Shipped in part:** the ARCA box still needs the new lane files and a full re-sync. Until then its
brain has not been shown to find every document, and the Memory screen says the count is not yet
checked.

## Acceptance criteria

- [ ] All five of ARCA's corpus documents are findable in the index by keyword. (The ticket first
  said seven. Two of those are the folders' own README files, which the index skips on purpose.)
- [x] Something fails, loudly, when a tracked corpus file is not indexed after a sync.
- [x] The count is surfaced where a founder can see it, or the reason it cannot be is written down.
  (On the Memory screen. On ARCA it reads "nothing checks yet" until the box has the new lane files.)
