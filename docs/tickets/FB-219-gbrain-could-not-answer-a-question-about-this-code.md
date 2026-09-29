# FB-219 — gbrain could not answer a single question about this code, and said it could

**Status:** Done · **Phase:** 3 · **Raised by:** John, 2026-09-25 ("please fix gbrain to work")
· **Branch:** `fb-219-gbrain-could-not-answer-a-question` · One ticket = one branch = one PR.

## What was wrong

gbrain is meant to be the searchable memory of this repo: ask it where something is handled and it
tells you, instead of you guessing a word and grepping for it. Asked anything about this codebase, it
returned either nothing or a file from an unrelated project. A search for the office screen returned a
script from **sd3**, a different venture.

Three separate faults were stacked on top of each other. **Each one reported success while doing
nothing**, which is why this survived so long. That is the same shape as the failures in
`docs/tickets/FB-151` and FB-156: a green reading taken from something that was not measuring the
thing.

### Fault 1 — the schema pack had no code in it

gbrain decides what a file *is* using a "schema pack" — a list of page types. Symbol lookup
(`code-def`, `code-refs`, `code-callers`) only works if that list contains a `code` type marked
`extractable`.

No bundled pack does:

```
$ gbrain schema diff gbrain-base gbrain-base-v2
Only in gbrain-base: architecture, calendar-event, civic, code, extract_receipt, ...
```

`gbrain-base-v2` — the pack that was active — **dropped the `code` type entirely**. Its predecessor
`gbrain-base` has it, but declares it `extractable: false`, so it cannot produce symbols either. This
was box-wide, not specific to this repo: grassmarket and sd3 have the same problem.

Under either pack, `gbrain code-def rowReason` returns `count: 0`. That is indistinguishable from
"there is no function called rowReason".

### Fault 2 — no code was ever imported

`gbrain sources add --path` does a **markdown-only** walk. The source had 267 pages and every one of
them was a note: tickets and docs, not one line of TypeScript.

Importing code needs `gbrain sync --strategy code`, a flag that does not appear in `gbrain sync
--help` (it is documented under CODE INDEXING in `gbrain --help`). Without `--full` it prints

```
sync preview: 0 changed source(s), 1 unchanged
OK code synced fountainbridge (page_count=267)
```

and exits clean, having looked at nothing. `gbrain reindex-code` does not help — it only reprocesses
code pages that already exist, and answers "No code pages to reindex".

### Fault 3 — the call graph phase was skipped

`code-callers` and `code-callees` need a phase called `resolve_symbol_edges`. It is **global-scope**, so
scoping a cycle to this source skips it:

```
$ gbrain dream --source fountainbridge
  - resolve_symbol_edges  excluded from implicit non-default source cycle (global scope)
Dream cycle (partial) in 1.7s
```

"Dream cycle" and a tick, having resolved nothing.

### And a stale source poisoning the results

A July copy of this repo at `/home/dev/fountainbridge` (last commit `ab9052e`, FB-003) was registered
as `gstack-code-9f9de6f8-df2810` and **federated**, so it answered searches. The real worktree at
`/home/dev/projects/fountainbridge` had no source at all. That is why an unrelated sd3 script
outranked this repo's own files.

## What was done

1. **A local schema pack that can see code.** Forked `gbrain-engineer` to `bcap-engineer` at
   `~/.gbrain/schema-packs/bcap-engineer/pack.json` and declared `code` with `extractable: true`.
   `gbrain schema update-type` cannot do this: a fork copies only the pack's *own* types, and `code`
   arrives through `borrow_from`, so `update-type code` fails with "not declared in pack". The type has
   to be added outright and removed from `borrow_from`.
2. **Imported the code.** `gbrain sync --strategy code --source fountainbridge --full` — 415 files,
   2,142 chunks, 160 seconds.
3. **Extracted the edges.** `gbrain extract --stale --source-id fountainbridge` — 682 pages, 20 links.
4. **Built the call graph.** `gbrain dream --phase resolve_symbol_edges --once` — 3.6 seconds, 958
   edges resolved. Naming the phase explicitly is what gets past Fault 3, and it avoids a bare
   `gbrain dream`, which would run LLM phases against gpt-5.2 across every source on the box.
5. **Archived the stale July source** (`gbrain sources archive`, recoverable for 72h) and **federated
   the real one**, so other repos on this box can search it too.
6. **Rewrote the guidance block in `CLAUDE.md`** so the next session does not repeat this. The old
   block was the generic one and pointed at a `gstack-brain-<user>` source that does not exist here.

## Proof it works

Not "the command exited 0". The measurement was checked against the code:

```
$ gbrain code-def rowReason
  lib/ledger.ts:110-135  export statement rowReason

$ gbrain code-callers rowTone
  rowReason, LedgerRowView, ledgerSummary      (count: 3)
```

Cross-checked with grep: those are exactly the three functions that call `rowTone`. Test files are
excluded from callers by design, so **grep is still the right tool for an exhaustive list of call
sites** — that is written into the CLAUDE.md block.

Before: 267 pages, all notes, zero symbols. After: 682 pages — 415 code, 267 notes — and 958 symbol
edges.

## What this does not fix

- **`grassmarket` and `sd3` still return 0 symbols.** Their 312 code pages were chunked before the pack
  could see code. Each needs `gbrain reindex-code --force` run in its own worktree. That is work in
  those repos, not this one.
- **`/sync-gbrain` still cannot fix any of the three faults.** Its orchestrator reported
  `OK synced fountainbridge (page_count=267)` on a no-op pass, and passes `--strategy code` to a `sync`
  call the mtime fast-path has already short-circuited. Worth reporting upstream to gstack; not this
  ticket.
- **A `gbrain self-upgrade` can reset the active pack.** `gbrain schema active` should read
  `bcap-engineer`. The CLAUDE.md block says how to check and how to put it back.

## Acceptance criteria

- [x] `gbrain code-def` resolves a symbol in this repo to the right file and line range.
- [x] `gbrain code-callers` returns the calling functions, cross-checked against grep.
- [x] A semantic search returns this repo's files, not another venture's.
- [x] The source is pinned by `.gbrain-source` so no `--source` flag is needed, and federated so other
      repos can reach it.
- [x] `CLAUDE.md` states what is indexed, the three faults, and the exact command that fixes each — in
      words a non-technical reader can follow.
- [x] No secret and no generated index committed to the repo.

## Verification

No screen changed, so non-negotiable 11 does not apply. Saying so rather than leaving it blank.
