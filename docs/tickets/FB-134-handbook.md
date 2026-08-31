# FB-134 — Handbook

**Status:** Done · **Area:** Studio / handbook · **Depends on:** FB-124
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

- [x] A 3×3 grid of chapters with number, title and reading time. Nine chapters, three columns —
      `.grid-3`, a deliberate `repeat(3, …)` rather than the auto-filling `.grid`, which gives four
      in a wide window and breaks the shape into 4/4/1.
- [x] The reader holds a 62ch measure. `--measure: 62ch` is a token now, from the Bruntsfield design
      system, passed to the shared prose renderer rather than set on it — the playbook keeps its
      width.
- [x] `content/` is byte-identical before and after. `git diff --stat -- content/` is empty.

## What this added beyond the scope as written

**Reading the handbook no longer costs a founder their venture.** The venture routes re-exported the
global pages, so every chapter link, the back link and the prev/next pair pointed at `/handbook` —
outside the rail. A founder opening chapter three from their desk lost their desk to read it, and
had no way back except the browser's history.

The pages take a `base` now (`/handbook` or `/venture/<id>/handbook`) and the links are built from
it. The venture routes also guard their own venture, like every other route under `/venture/[id]` —
the layout guards them too, and two checks that agree cost nothing (CLAUDE.md #6).

## The design's one false sentence, not shipped

The design's index reads *"…the method your team already follows. Copy untouched, rendered from the
venture repo."* The second half is not true and this ticket already said so: the handbook is one
method across every venture and lives in the studio. It is omitted rather than reworded — a screen
is not the place to keep an aspiration.

The chapter screen's *"rendered from `content/handbook`; copy untouched"* is omitted for a different
reason: it is a note to whoever reads the design, and on a founder's screen it names a repository
path, which is engineering.

## A guard that asserted nothing, caught before it shipped

The first "three across" check counted distinct left edges. It **passed with the rule replaced by an
auto-fill**, because the column beside the rail is ~766px, which `minmax(15rem, 1fr)` also happens to
divide into three. It now asserts the computed track count as well, which fails the moment the rule
changes — verified by watching it go red at four columns and green again.

## Verified on production

Signed in as ARCA's founder, 1440×1000 and 393×851:

| | |
| --- | --- |
| Grid | `244.656px 244.672px 244.672px` — three tracks, nine chapters |
| Reading times | 22 · 29 · 29 · 20 · 12 · 30 · 19 · 17 · 5 min |
| Reader measure | 620px (62ch), inside a column that would allow 766 |
| Chapter opens at | `/venture/arca/handbook/how-to-start`, **rail still present** |
| Next → | `/venture/arca/handbook/how-to-build` |
| ← Handbook → | `/venture/arca/handbook` |
| Phone | one column, top bar back, overflow 0 |

The screens were read, not just asserted.
