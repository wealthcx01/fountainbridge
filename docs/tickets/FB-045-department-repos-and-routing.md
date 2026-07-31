# FB-045 — Provision Sell/Scale repos + make the loop department-generic (operationalise the 3 surfaces)

**Status:** Shipped · **Phase:** 4 · **Depends on:** FB-041 (dept routing in the lane), FB-048
(surfaces) · **Repo:** fountainbridge (+ venture repos/VM) · **Branch:** `fb-045-department-repos-and-routing`
One ticket = one branch = one PR.

## Why this matters (for the founder)
Today only *building* is worked automatically. This makes **selling** and **scaling** first-class too:
a marketing ticket you describe actually gets worked, shipped through the same discipline.

## Context
FB-048 declared Build/Sell/Scale + renders them; the composer can file to any (it's generic). But
Sell/Scale have no repos and no lane works them. This provisions the repos + points the loop at them —
the operational half of the three surfaces.

## Scope
- **Provision the department repos** for a venture (e.g. `arca-marketing`, `arca-ops`; or the-reset's
  `thereset-marketing`) with `docs/tickets/` + `context/`/`library/`; add them to the manifest `repos`
  so the surfaces flip from "coming" to active (FB-048).
- **Clone them into the lane runtime + the department's gbrain partition** (FB-050); the autonomous
  lane scans + works each department's queue (FB-041 routing).
- **Sell content (4a)** runs the normal PR loop on the venture's real domain CI (where we beat
  Cofounder — production discipline, not a review Library). **Sell sends + Scale mutations** route to
  the gate (FB-044/051); reads are free.

## Out of scope
- Real send transport (Phase 4b). The full ActiveGraph runtime (FB-051).

## Acceptance criteria
- [x] **A venture's Sell and Scale repos are provisioned and in the manifest; the surfaces read
      "active".** `wealthcx01/arca-marketing` and `wealthcx01/arca-ops` exist, seeded with the queue,
      `context/`, `library/`, a starter ticket each, and a CI job that gates the *shape of what the
      lane writes* — a ticket the studio's parser cannot read is a ticket that disappears off the
      founder's board without anyone being told.
- [x] **The lane works each department's queue.** `run-once.sh` walks `FOUNDRY_DEPARTMENTS`
      (`id:owner/repo:base:gate`) in declared order and the first workable ticket wins the wake —
      one dispatch per sweep, so a busy Build queue cannot starve Sell of every wake. An unset
      variable reproduces the single-department box exactly, so an un-migrated lane.env keeps working
      instead of finding no departments and going quietly idle.
- [x] **A Sell send routes to the approval gate rather than being performed.** The lane does the work
      in a PR like any other ticket, then files a proposal the founder approves in the studio. The
      draft is **inlined into the proposal, not referenced** — the attestation covers `proposal.json`,
      so a path could change between approval and execution while the signature still verified. A
      missing or refused proposal **blocks**: opening the PR and reporting success would leave a
      founder believing a send was queued for them when nothing was.
- [x] **The studio can see it.** Approvals are read from every department repo, not `repos[0]`. That
      was FB-054's recorded gap and it was load-bearing here: the only department that spends money
      has its own repo, so a real send waiting for the founder rendered as an empty queue and Sell's
      spend as a confident £0.

## What a lane is not allowed to say

`proposal-lib.mjs` builds the filed proposal field-by-field from a known list rather than spreading
what the lane wrote, and refuses outright — rather than sanitising — anything resembling approval,
attestation, actor identity or execution status. The opt-out check is read **off the draft text**, so
a lane that forgot the unsubscribe line cannot assert its way past it. This is the FB-051/FB-054
lesson applied at the point the input is created: a gate is only as trustworthy as its
least-protected input, and this input is written by the party being gated.

## Still open
- ⚠ **Not yet run on ARCA's box.** `install-departments.sh` clones the two repos and writes the
  `FOUNDRY_DEPARTMENTS` line; the end-to-end proof (a marketing Todo → PR on arca-marketing → a
  proposal in the studio's "Needs your OK") needs the box, and the Approve button needs
  `STUDIO_APPROVAL_GITHUB_TOKEN` on Railway.
- ❌ **Scale's gate is still `tbd-fb012`.** An unrecognised gate is treated as the strictest one
  (propose, never perform), which is the right default, but the actual operational gate is
  unspecified — `docs/research-gtm.md` governs it.
- ❌ **An approval id is unique only within its repo.** React keys and the approve call are
  repo-qualified, but the DOM test ids are not; two departments with an identically-named ticket
  would collide in the UI gate.

## Verification
35 unit tests over the proposal boundary (every forbidden field, a path passed off as a draft, a
phrase where a suppression boolean belongs, a float amount, a proposal filing itself under another
department's budget) + 7 over the multi-repo approval read. 325 tests, lint, typecheck, shellcheck,
manifest validation, design contract.
