# FB-230 — PR environments enabled on the arca project, and the one step it still needs

**Status:** Shipped in part · **Phase:** 3 · **Approved by:** John, 2026-09-29 — *"yes enable PR
environments on arca"* · **Follows:** FB-228 (D11) · One ticket = one branch = one PR.

## What was changed on the live Railway account

One mutation, on the project `arca` (`4df47e04-f7ed-4d81-8243-2b00b5d44153`):

| flag | before | after | why |
|---|---|---|---|
| `prDeploys` | `false` | **`true`** | the switch itself |
| `botPrEnvironments` | `false` | **`true`** | **the one that actually mattered** |
| `focusedPrEnvironments` | `true` | `true` | untouched; already on |

`arca` now matches `foundry-studio` exactly on all three.

### `botPrEnvironments` was the trap

Its description is *"Enable/disable pull request environments for PRs created by bots"*. **Every ticket a
founder cares about arrives as a PR opened by the lane**, with a token — so setting `prDeploys` alone
would have looked correct, produced nothing for any lane PR, and been very hard to explain. Found by
reading the input type rather than setting the one flag with the obvious name.

### What was checked before changing anything

- **Variables that a cloned environment would inherit.** All 14 on arca production are Railway's own
  `RAILWAY_*` values. **No secrets, no venture credentials.** Names were read; values deliberately were
  not.
- **The volume.** `arca-volume` has one instance, bound to production's environment id, 84.9 MB. Volume
  instances are per-environment, so a PR environment gets its own rather than production's. A preview's
  database therefore starts **empty** — the app will run and show no data, which is worth knowing before
  someone reads an empty preview as a bug.
- **Afterwards**, with a fresh query rather than the mutation's own answer: production's environment and
  volume are unchanged, still one environment and 84.9 MB on production's id.

## What it still needs, and why it stopped here

**The arca Railway service is not connected to a GitHub repository.** Verified three ways:

- `serviceInstances { source }` is `null`.
- Its production deployment's `meta` has **no `repo`, `branch` or `commitHash`** — only build fields. A
  GitHub deploy carries all three; `foundry-studio`'s PR deployment does.
- `GET /repos/wealthcx01/arca/deployments` returns **0**, while the same call on `fountainbridge` returns
  deployments created by `railway-app[bot]`.

So arca is deployed by `railway up` from a machine, not from git. **PR environments are triggered by
GitHub pull-request webhooks, so with no repo connection the flags now set cannot fire.** They are
necessary and not yet sufficient.

### Why connecting the repo was not done in the same breath

Two reasons, and the second is a rule rather than a preference.

1. **It may need a GitHub permission only John can grant.** `githubRepos` returns `Not Authorized` for
   this credential, and listing the org's app installations needs `admin:org`, which this token does not
   have. Railway's app clearly works on `fountainbridge`, so the likely gap is that it was never granted
   access to the `arca` repository.
2. **Connecting a repo creates a deploy path with no approval gate.** Once connected, a merge to `main`
   deploys arca production. Non-negotiable 4 puts **deploys** among the external actions that require a
   recorded human approval, and today an arca deploy is a deliberate act at a terminal. Turning it into
   "whatever merges, ships" is a change to how a live venture releases, and it is not what "enable PR
   environments" asked for.

   **There is a clean way to have both.** `serviceInstanceAutoDeployUpdate` sets auto-deploy per service
   instance, and a service instance is per environment. So the repo can be connected with auto-deploy
   **off on production**: pull requests get their own environments, and production keeps deploying only
   when someone deploys it. That preserves today's behaviour exactly and adds the previews.

That is one decision, not a design problem — but it changes release behaviour on a live venture app, so it
is John's rather than mine to assume.

## What a founder gets once it is connected

The rest of the chain already works and is verified in FB-228: Railway publishes the app's hostname in a
commit status description, `previewUrlFrom` extracts it, refuses the console URL, and `lib/trail.ts`
renders the hop as *"A preview built and is running"* → "see it running". Nothing else has to be built.

So the remaining gap between a founder and seeing their own work run is **one repo connection**, not code.

## Also worth naming: only `arca` has a Railway project

`arca-marketing` and `arca-ops` — the Sell and Scale surfaces — have **no Railway project at all**. Even
once `arca` is connected, a SELL or SCALE ticket gets no preview, because there is nothing to deploy it
to. Those surfaces produce documents and sends rather than a running app, so a preview may be the wrong
idea for them entirely; naming it here so the absence is a decision rather than a surprise.

## Acceptance criteria

- [x] `prDeploys` and `botPrEnvironments` are `true` on the arca project, verified by a fresh query.
- [x] `focusedPrEnvironments` left as it was.
- [x] Production's environment and volume unchanged, verified after.
- [x] No variable values were read, and none were changed.
- [x] The before and after states are recorded here.
- [ ] The arca service is connected to `wealthcx01/arca`. **Needs John** — a GitHub grant, and a decision
      on production auto-deploy.
- [ ] A lane-opened PR on arca produces an environment, and its preview URL appears on the ticket's trail.
      Verifiable end to end only after the step above.

## Verification

No screen and no code changed — this is an infrastructure record. Non-negotiable 11 does not apply, said
rather than left blank.

The change is one `projectUpdate` mutation and is reversible by the same call with `false`. Everything
else in this ticket came from reading.
