# FB-269 — Hand FB-239's machines to Cowgate

**Status:** Todo (writing the seam); the removal waits for Cowgate's CG-0004 · **Phase:** 3 ·
**Kind:** a short document now, then a medium clean-up · **Raised by:** the October re-baseline
(section 5, ticket 7), filed 2026-10-21 at John's request · One ticket = one branch = one PR.

## Why

FB-239 built "one machine per ticket" for the studio: a Railway provider (`lib/machine-railway.ts`),
a Hetzner provider, a machine service and store, a budget store, the `/api/machines` routes and an
admin page. It is switched off. Cowgate now builds the same thing for the whole factory: CG-0030
makes and destroys Railway runners, CG-0031 removes leftovers, CG-0006 will cap how many run and
what they spend. Two copies of that would mean fixing every lesson twice.

## What to do

**Part 1, now: write down the seam** (`docs/machines-and-cowgate.md`, about a page):

- **Cowgate owns:** the runner image, which secrets a runner gets (`secrets/manifest.yaml`),
  making and destroying runners, removing leftovers, and the caps on how many run and what they
  spend.
- **Fountainbridge keeps:** the check that a machine gets one venture's credentials and no
  other's, the cross-venture isolation test, and the budget John approves for each venture, as a
  founder and John see it.
- **For each FB-239 file:** keep, hand over, or remove, with one line why.

**Part 2, once Cowgate's CG-0004 runs real tickets on runners:** remove the studio's duplicate
Railway and Hetzner providers and machine service, keep what part 1 kept, and point the budget
view at Cowgate's cost records.

## Acceptance

- [ ] Part 1: the seam document is merged, and John agrees it.
- [ ] Part 2: the duplicate code is removed; the kept checks still pass; the admin budget page
      still reads correctly, looked at at both sizes.
- [ ] FB-239 is never switched on as it is.

## Out of scope

- Building anything Cowgate builds.
- The venture lane itself (FB-268).
