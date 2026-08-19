# FB-115 — The lane cannot see the gate it is judged by

**Status:** Todo · **Phase:** 2 · **Found by:** ARCA-34's CI meeting the lane's first PRs, 2026-08-19
— a mismatch this lane created the same day · **Repo:** fountainbridge (+ every venture box) ·
**Branch:** `fb-115-the-lane-cannot-see-the-gate-it-is-judged-by` · One ticket = one branch = one PR.

## Why this matters (for the founder)

Your team keeps finishing work that then fails a check nobody told it about. Every one of those needs
you, or a person, to fix by hand — and a check that always fails is a check people start ignoring.

## What was found

ARCA got CI today (ARCA-34). Within the hour the lane opened three PRs from the audit's findings, and
the first one to run through the new gates **failed lint** — on its own new code:

```
lint/suspicious/noArrayIndexKey        ×2
lint/correctness/useExhaustiveDependencies  ×1
lint/style/useTemplate                 ×1
format (CardDetailPage.tsx)            ×1
organize imports (card-detail-identity.pw.ts) ×1
```

The first two are not style. A list keyed by array index breaks when the list reorders; a wrong hook
dependency array means the page does not update when it should. These are the "it doesn't refresh"
bugs a founder reports and nobody can reproduce.

**The lane had no way to know.** It does run the venture's linter — `toolchain_probe` calls
`bun run lint` — but `venture_regression` only fails a step when the **baseline was passing**:

```sh
if [ -n "$brc" ] && [ "$brc" = "0" ] && [ -n "$bx" ] && [ "$bx" != "0" ]; then
```

ARCA's whole-repo lint has never exited 0 (198 pre-existing errors, ARCA-65), so `brc` is `1`, the
condition is never true, and **lint is silently never checked**. That guard is correct on its own
terms — it exists so a venture's pre-existing red is not blamed on the lane — and it makes the lane
blind to the only lint signal that matters.

## The mismatch, precisely

| | What it measures | What it requires |
| --- | --- | --- |
| **The lane** (`toolchain_probe`) | the **whole repo** | no worse than the baseline |
| **CI** (ARCA-34) | **only the files this change touches** | zero |

Two gates measuring different things, so passing the first tells the lane nothing about the second.
And this is self-inflicted: ARCA-34 scoped CI to changed files precisely *because* the whole repo
cannot pass, without teaching the lane the same trick.

## Scope

- **The lane validates what CI validates.** Run the changed-files lint —
  `biome check --changed --since=<base>` where the venture uses biome — as a VALIDATE step, and treat
  a failure as a repair round like any other. The lane already knows how to fix its own work when
  told what is wrong; it has simply never been told this.
- **Derive the command, do not hardcode biome.** The probe already detects the toolchain; the
  changed-files invocation belongs beside that detection, with a documented no-op for toolchains that
  have no equivalent.
- **Keep the baseline guard for the whole-repo run.** It is right, and it is not what this replaces —
  the two answer different questions and both are worth asking.
- **Say it in the hand-off** (FB-060): if the lane could not run the venture's linter at all, that
  belongs in "what the lane could not establish", not in silence.

## Explicitly NOT here

- Fixing ARCA's 198 pre-existing lint errors — that is **ARCA-65**, in the venture's own repo.
- Making CI lenient. The gate is right; the lane's view of it is what is missing.

## Acceptance criteria

- [ ] A lane change that introduces a lint error on a file it touched fails the lane's own VALIDATE,
      and goes to a repair round rather than to a PR.
- [ ] A venture with pre-existing lint debt does not have that debt attributed to the lane.
- [ ] A toolchain with no changed-files lint is a stated no-op, not a silent pass.
- [ ] Verified against the real case: re-run ARCA-053 through the lane and watch it fix its own
      `noArrayIndexKey` before opening the PR.
