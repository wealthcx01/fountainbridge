# FB-122 — A plan the lane stops to show you has no way of ever being approved

**Status:** Done · **Area:** Studio / lane handshake · **Depends on:** FB-121

Proved on the ARCA box before merging, both directions — see the last acceptance criterion.

## What is true today

When a ticket looks high-impact — auth, payments, migrations, secrets, credentials, external sends —
the lane refuses to touch it. It writes a plain-English plan of what it *would* do, surfaces that to
the founder as a run report, marks the ticket `awaiting-<slug>`, and stops. That is correct and
deliberate.

**Nothing can ever release it.** `awaiting-<slug>` is written at `run-once.sh:276` and no code
anywhere deletes it. Not the studio, not a CLI, not editing the ticket — the un-stick-on-edit rule
covers `gaveup-` and not this. Deleting the marker by hand does not help either: the sensitive check
runs *before* the marker check every wake, so the lane re-enters the same branch, spends a model
session regenerating a plan that already exists, re-creates the marker, and stops again.

So the gate is a one-way door. ARCA-054 went through it on 19 August and was still behind it a week
later, and the only way it ever got done was a person working it by hand.

## Why this is worth building rather than living with

FB-121 means a parked ticket no longer starves the queue, so this is not urgent any more. It is still
the difference between a gate and a wall. Every ticket ARCA files about auth, payments, migrations or
credentials — which is to say every ticket that most needs a considered human yes — lands behind it,
and none of them can ever come out. A stop that cannot be released teaches a founder to route around
the stop.

It is also the last piece of the loop. Composer → ticket → lane → PR works end to end today for
ordinary work. For sensitive work it runs composer → ticket → lane → **plan → nothing**.

## What this gate is, and is not

Worth stating before designing it, because getting this wrong is how FB-051 was withdrawn.

**This is a cost-and-attention gate, not a security boundary.** It exists so the lane does not spend
model time and open a pull request on high-blast-radius work before a person has read what it intends
to do. The security gates are elsewhere and stay where they are: engineering change is gated on the
pull request, and anything leaving the building is gated on a signed ActiveGraph approval
(`lib/activegraph.ts`, CLAUDE.md #4).

That matters for where the release marker can live. The lane reads the venture repo's `foundry-state`
ref and holds a token that can write to it, so **the lane could forge its own release**. There is no
arrangement that fixes this while the lane is the thing being gated and also the thing reading the
gate. Rather than pretend otherwise: the marker is unsigned and the lane trusts it, and the record of
*who actually released it* is written separately into the studio's own signed ActiveGraph, where the
lane holds no credential and cannot forge anything.

## Scope

- **Studio → a release marker.** A server action writes `approvals/plan-<slug>.json` to the venture
  repo's `foundry-state` ref, recording who released it and when, and appends a signed
  `approval.granted` event to the studio's ActiveGraph so there is one record a lane cannot write.
- **Reuse the approval matrix.** `canApprove` and `approverRoleForDepartment`
  (`lib/approval-attestation.ts`) already decide who may approve what for external actions. A plan
  release routes through the same rules rather than inventing a second answer to the same question.
- **Lane → honour it.** At the sensitive branch, check for the release marker *before* the
  already-surfaced check. Released → clear `awaiting-<slug>` and work the ticket normally. Not
  released → behave exactly as now.
- **A surface.** The founder already sees the plan as an `awaiting-approval` run report in Activity.
  The release control belongs on that report, next to the plan they are being asked to read.
- **Cover both halves**, including the case this ticket is about: a marker that appears releases the
  ticket on the next wake, and its absence changes nothing.

## Out of scope

- **FB-026 (in-studio approvals).** That is the founder approving a *pull request* — finished work,
  merged via the GitHub API, routed by the D7 matrix. This is the founder approving a *plan* so work
  can begin. Same matrix, opposite ends of the job. FB-026 stays unbuilt and unblocked by this.
- Changing what counts as sensitive (`ENGINEERING_SENSITIVE`). The classification is working; only
  the exit from it is missing.
- Any change to the external-action gate. That one is signed, verified, and not what this touches.

## Acceptance criteria

- [x] A founder can release a parked plan from the studio, without SSH and without GitHub.
- [x] With no release marker, the lane behaves exactly as it does today. Proved live on ARCA:
      `skip ARCA-057-pricing-sources-always-zero-synced — waiting on your go (held)`, and the scan
      carried on to ARCA-058 in the same wake.
- [x] A release is refused for someone the approval matrix does not permit, for a repo the venture
      does not declare, for an unsigned-in user, and for a ticket slug that is not one.
- [x] Releasing writes a signed ActiveGraph event in the studio, so the record of who said yes lives
      where the lane cannot write it.
- [x] Releasing twice is harmless, and does not report a history failure that is not one — a taken
      event position means "already released", not "the write broke".
- [x] The code says plainly that the marker is unsigned and why that is acceptable here, in the
      action's own header and in the marker file itself.
- [x] The lane reads a real marker off the real state ref. Proved on the box against the exact bytes
      the action writes: present → prints the approver and succeeds; absent → reports no release.
- [x] The release BRANCH observed firing in situ. ARCA-057 was held, then released, and the next
      free wake did this:

```
12:30:43  skip ARCA-057-pricing-sources-always-zero-synced — waiting on your go (held)
12:46:43  ARCA-057-pricing-sources-always-zero-synced released by john.gallagher@wealthcx.com
          — clearing the hold and working it
12:46:43  working ARCA-057-pricing-sources-always-zero-synced in build (full-auto RPIV)
12:46:44  claimed foundry/ARCA-057-pricing-sources-always-zero-synced
```

      The hold marker is gone from the box and the ticket is being worked normally. Both halves of
      the branch seen: held-and-not-released skips and keeps scanning, released clears and proceeds.
