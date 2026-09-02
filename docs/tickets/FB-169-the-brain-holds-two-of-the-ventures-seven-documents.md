# FB-169 — the venture brain holds two of ARCA's seven corpus documents

**Status:** Open · **Phase:** 3 · **Found by:** FB-165, on the ARCA box

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

## Acceptance criteria

- [ ] All seven of ARCA's corpus documents are findable in the index by keyword.
- [ ] Something fails, loudly, when a tracked corpus file is not indexed after a sync.
- [ ] The count is surfaced where a founder can see it, or the reason it cannot be is written down.
