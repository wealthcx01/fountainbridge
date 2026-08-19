# FB-115 — The lane cannot see the gate it is judged by

**Status:** Done — not yet on a box · **Phase:** 2 · **Found by:** ARCA-34's CI meeting the lane's first PRs, 2026-08-19
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

- [x] A lane change that introduces a lint error on a file it touched fails the lane's own VALIDATE
      and goes to a repair round rather than to a PR.
- [x] A venture with pre-existing lint debt does not have that debt attributed to the lane — the
      baseline guard on the whole-repo run is untouched, and the new check reads only the branch.
- [x] A toolchain with no changed-files lint reports `none`, which passes and says so. A step that
      cannot run must not look like a step that ran.
- [x] Verified against the real case — `changed_lint` returns **1** on
      `foundry/ARCA-053-card-detail-blank-identity`, the branch ARCA's CI refused, and **0** on a
      clean checkout.
- [ ] **Watched end to end on the box**: ARCA-053 re-run through the lane, fixing its own
      `noArrayIndexKey` before opening a PR. Needs the sync (FB-116) and a lane wake.

## How it works

`changed_lint` asks the venture's CI's own question — *are the files this change touched clean?* —
and `venture_regression` requires **zero**, with no baseline comparison. That distinction is the
whole fix: on a repo carrying debt the baseline is already dirty, so a comparison can never fire,
which is exactly why lint was silently unchecked on ARCA while its CI failed every lane PR.

Three things it deliberately keeps:

- **The whole-repo baseline guard.** It is right — a venture's pre-existing red is not the lane's
  fault — and it answers a different question. Both are asked.
- **`--no-errors-on-unmatched`.** biome exits 1 when it processes no files, and a ticket-only change
  touches nothing it lints. Without it every ticket the composer files would read as a lint failure
  — the same trap ARCA-34's CI had to handle.
- **An honest `none`.** A toolchain with no changed-files linter says so in the probe output rather
  than passing quietly.

A probe written before this field exists still passes, so a box mid-upgrade is not broken by it.
