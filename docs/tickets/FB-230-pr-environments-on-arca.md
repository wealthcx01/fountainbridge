# FB-230 — PR environments enabled on the arca project, and the one step it still needs

**Status:** Shipped in part · **Slice 2 2026-09-30** · **Phase:** 3 · **Approved by:** John, 2026-09-29 — *"yes enable PR
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

## Slice 2 (2026-09-30): the repo is connected, production is safe, and PR environments still do not fire

**Approved by John:** *"connect the repo with production auto-deploy off."* Done, and production is
verified untouched. **The previews still do not appear**, and three plausible causes were ruled out by
experiment rather than by reasoning. The remaining hypothesis needs another spend decision, so it stopped
there.

### What was done, in order, with the rollback prepared first

The order mattered, because connecting a repo can trigger a deploy of a live venture app. Before touching
anything: `deploymentRollback` and `deploymentRedeploy` were confirmed to exist, and the good production
deployment `94638067…` (2026-08-03, SUCCESS) was confirmed `canRedeploy: true`.

1. **The first connect attempt failed usefully.** `branch: "main"` was refused —
   *"Branch `main` does not exist in the repo `wealthcx01/arca`"*. **arca's default branch is `master`.**
   Nothing changed. Worth knowing: every lane PR on arca targets `master`, so the studio's assumptions
   should not hard-code `main` anywhere.
2. **Connected** `wealthcx01/arca` on `master`. `source` is now `{repo: "wealthcx01/arca"}`.
3. **It immediately triggered a production build** (`5f1fb65b…`, BUILDING) and **defaulted auto-deploy to
   enabled** — exactly what John asked to avoid. Cancelled within the minute: `deploymentCancel` → `true`,
   and that deployment is now `REMOVED`.
4. **Disabled auto-deploy** on the production instance. Note the shape: the mutation takes a single
   `input` object, not flat arguments, and the first attempt failed validation because of it.
5. **Verified:** production still serves **HTTP 200**, its live deployment is still the 2026-08-03 one, and
   the volume is untouched at 84.9 MB on production's environment id.

So the outcome John asked for holds: the repo is connected, and production deploys only when someone
deploys it.

### Three causes ruled out, by experiment

A temporary PR was opened on arca (#89) purely to see whether an environment appeared, then closed and its
branch deleted. Nothing about arca was changed or kept.

| suspected cause | test | result |
|---|---|---|
| **Production auto-deploy being off** suppresses PR environments | enabled it briefly, re-pushed | **No.** Still no environment. Set back to off immediately; production untouched. |
| **`focusedPrEnvironments`** skipping a PR that affects no service | set it to `false`, re-pushed | **No.** Still no environment. Restored to `true`, its original value. |
| **Railway's GitHub App cannot reach the repo** | checked who creates deployments | **No.** `railway-app[bot]` created a deployment on `wealthcx01/arca`, and `serviceConnect` validated the branch list, so it has access. |

`watchPatterns` is `[]` and `rootDirectory` is `null`, so path filtering is not excluding anything either.

### The remaining hypothesis, and why it stopped here

**`foundry-studio` has a `staging` environment. `arca` has only `production`.** That is now the clearest
difference between the project where PR environments work and the one where they do not. Railway may need a
non-default base environment to clone a PR environment from, rather than cloning the production one.

Testing it means **creating a `staging` environment on arca**, which is another environment and therefore
another spend — outside what was approved, and not something to add to a venture's project on a hunch.
`baseEnvironmentId` is `null` on both projects, which is consistent with the guess but does not confirm it.

### What is true right now

- Repo connected, auto-deploy off, production serving and unchanged. **Nothing is at risk.**
- A lane PR on arca still produces no preview, so a founder still cannot see their own work running.
- The remaining gap is one experiment, gated on one decision.

## Acceptance criteria, updated

- [x] The arca service is connected to `wealthcx01/arca`, on the branch its PRs actually target (`master`).
- [x] Production auto-deploy is off, verified by a fresh query.
- [x] Production is verified still serving its original deployment, by HTTP and by deployment id.
- [x] The deploy that connecting triggered was cancelled, not merged into production.
- [x] Every setting changed for testing was restored to its original value.
- [x] The probe PR was closed and its branch deleted.
- [ ] A lane-opened PR on arca produces an environment with a preview URL on the ticket's trail. **Still
      not working** — the three ruled-out causes and the remaining hypothesis are above.

## Verification

No screen and no code changed — this is an infrastructure record. Non-negotiable 11 does not apply, said
rather than left blank.

The change is one `projectUpdate` mutation and is reversible by the same call with `false`. Everything
else in this ticket came from reading.
