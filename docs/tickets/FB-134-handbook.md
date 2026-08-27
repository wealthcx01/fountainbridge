# FB-134 — Handbook

**Status:** Todo · **Area:** Studio / handbook · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screens 8 and 9; `screens/09-Handbook.txt`, `10-Handbook_chapter.txt`.

## Why this matters (for the founder)

The method the founder's team already follows, readable by the founder. *"How we start, build, sell
and scale: the method your team already follows. Copy untouched, rendered from the venture repo."*

The smallest ticket in the set, and it is in it because a handbook a founder cannot find is a handbook
nobody reads.

## What is true today

`app/handbook/` renders the markdown chapters (FB-023, FB-024). The content is correct and the copy is
not to be touched.

**One discrepancy between the design and the code, resolved here.** The design says the handbook is
*"rendered from the venture repo"*. It is not: `lib/handbook.ts` reads `content/handbook/*.md` from
the **studio** repo. That is the right place for it — the method is one method across every venture,
and a per-venture copy is a per-venture drift. The design's phrase describes an aspiration, not the
build, and this ticket keeps the studio as the source. If the handbook should ever become
venture-specific, that is a decision with D8 consequences and its own ticket.

## Scope

- A 3×3 chapter grid: number, title, minutes to read.
- The reader at a 62ch measure, per the design contract's prose rule.
- Restyle into the rail shell. **The copy is untouched** — it is the method, ratified elsewhere.

## Out of scope

- Any change to the handbook's words. If a chapter reads wrongly that is its own ticket.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift
git diff --stat -- content/   # expect: no output. The copy does not change.
```

## Acceptance criteria

- [ ] A 3×3 grid of chapters with number, title and reading time.
- [ ] The reader holds a 62ch measure.
- [ ] `content/` is byte-identical before and after.
