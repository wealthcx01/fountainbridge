# FB-165 — a Build lane can read the Sell surface's private context

**Status:** Shipped · **Phase:** 2 · **Found by:** FB-156, on the ARCA box

> **Did it actually happen on ARCA?** Unknowable from the record, and that is the honest answer. The
> journal holds 62 RESEARCH runs between 18 and 27 August, each reporting "brain returned 5–6
> relevant page(s)" — **the count only. The page names were never logged.** The exposure window is
> real: ARCA's three departments each work a different repo, the brain is indexed over Build's repo,
> and `context/sell/` lives in that repo, so a Build lane querying it could receive the founder's
> Sell positioning. Whether any given run did cannot be recovered. FB-156 closes that gap from now
> on — every run records which documents it read.
>
> Found on the way: **FB-169** — the brain has indexed two of ARCA's seven corpus documents.

## What is wrong

D8 gives each department its own partition of the venture's knowledge: a Build lane plans its work
from Build's context and from shared material, never from what the founder deposited privately under
Sell. `partitionForDepartment()` in `deploy/lane/brain-lib.mjs` enforces that, and it reads a page's
owning department off the gbrain slug:

```js
const DEPT_SLUG_RE = new RegExp(`^(?:${AREAS.join('|')})-(${DEPARTMENTS.join('|')})(?:-|$)`);
```

The comment above it states the assumption plainly: *"gbrain slugs are path-derived and flattened:
`context/build/ideal-customer.md` indexes as `context-build-ideal-customer`."*

**They are not flattened.** Measured against ARCA's live index on 2026-09-02:

```
"slug": "context/sell/arca-brand-positioning"
"slug": "context/sell/market-note-terminal-wedge"
"slug": "docs/tickets/arca-004-pricing-providers"
```

The separator is `/`, not `-`. So `DEPT_SLUG_RE` matches nothing, `pageDepartment()` returns `null`
for every corpus page, and `partitionForDepartment()` reads `null` as *shared, every department may
see it*. Every department's lane can retrieve every other department's private context, and has been
able to since FB-050.

## Why it is worth a ticket rather than a one-line fix in passing

The partition is an authorization boundary, and the failure is silent in the direction that matters:
the lane gets MORE than it should and nothing looks wrong. Nobody would notice from a log, a PR body
or a RunReport — the digest simply contains a page it should not, and the plan reads slightly better
for it.

It also failed the way FB-137's fault switch failed: a rule that had never been exercised against the
real thing. `deploy/lane/__tests__/brain-lib.test.mjs` tests `pageDepartment` thoroughly — against
slugs the test file makes up in the flattened shape the comment describes. Every test passes and the
function has never once matched a real page.

## Scope

- Fix `pageDepartment` to read the department off a real gbrain slug (`context/<dept>/<name>`), and
  keep accepting the flattened form if any index still produces it.
- **A test built from a slug gbrain actually emitted**, not from one this repo invented. The current
  suite is the defect: pin at least one real slug string, sourced from a live index, as a fixture.
- Check the same assumption everywhere else a slug is parsed.
- Say in the ticket's PR body whether any ARCA plan was in fact built on another department's
  context, from the run reports — the founder is owed the answer, not a fix in silence (#10).

## Acceptance criteria

- [ ] `pageDepartment('context/sell/arca-brand-positioning')` returns `'sell'`.
- [ ] A Build-partitioned query over a result set containing that page does not return it.
- [ ] The test that proves it uses a slug captured from a real index, and says so in a comment.
- [ ] Reverting the fix turns that test red.
