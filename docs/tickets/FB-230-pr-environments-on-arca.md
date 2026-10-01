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

## Slice 3 (2026-09-30): staging created, hypothesis disproved, and the search ended systematically

**Approved by John:** *"create the staging environment and re-test."* Done. **The hypothesis was wrong**,
and rather than keep guessing the two projects were diffed field by field.

### What was created

`staging` on arca, cloned from production's configuration with `skipInitialDeploys: true` — so it arrived
with **0 deployments** and nothing was built or charged for on creation. Production stayed on its
2026-08-03 deployment and kept serving HTTP 200 throughout.

It was then deployed once from git (`serviceInstanceDeploy`, `latestCommit: true`) to answer a second
question, and **it built and deployed successfully** — so arca's repository builds fine from Railway. That
is worth knowing on its own: nothing about the repo is the obstacle.

**Staging is now asleep** (`sleepApplication: true`) so it costs nothing while unused. It wakes on request.
It is kept rather than deleted because **FB-229 needs exactly this** — its migration must deploy to staging
and be watched before production, and until now there was nowhere to do that.

### Five causes ruled out, each by experiment

| suspected cause | test | result |
|---|---|---|
| Production auto-deploy being off | enabled it briefly, re-pushed | no |
| `focusedPrEnvironments` skipping a PR affecting no service | set `false`, re-pushed | no |
| Railway's GitHub App cannot reach the repo | `railway-app[bot]` creates deployments on it; `serviceConnect` read its branch list | no |
| **arca having no non-production base environment** | created `staging`, re-pushed | **no** |
| **The service having never built successfully from git** | built staging from git — it succeeded — re-pushed | **no** |

Every setting changed for a test was restored. Both probe pull requests were closed with their branches
deleted; nothing about arca was changed or kept.

### Then the systematic check, instead of a sixth guess

Every scalar field on `Project` was compared between arca and foundry-studio. **The only difference is
`primaryEnvironmentId`**, which is each project's own production id — not a difference at all.

So the two projects are **provably identical** on every project-level setting, and one creates PR
environments while the other does not. That rules out the whole class of explanation being searched.

### What is left, and why it needs John

The remaining difference must be outside the project: the **Railway GitHub App's installation scope on the
`wealthcx01/arca` repository**. It is consistent with everything observed — Railway can read the repo and
create deployments using an account-level credential, while pull-request *webhooks* require the App to be
installed on that specific repository.

It cannot be checked from here. `GET /repos/wealthcx01/arca/installation` needs a GitHub App JWT,
`/user/installations` needs a token authorised to a GitHub App, listing the org's installations needs
`admin:org`, and Railway's own `gitHubRepoAccessAvailable` needs a user-session token rather than the
CLI's.

**What John can check in two minutes:** GitHub → Settings → Applications → Railway → Configure, and see
whether `arca` is in its repository list. If it is not, add it. If it is, this is Railway's product
behaving differently on two identically-configured projects and is worth their support rather than more
guessing here.

### State right now

- Repo connected on `master`; production auto-deploy **off**; production serving **HTTP 200** on its
  original deployment.
- `staging` exists, has built from git once, and is **asleep**.
- `prDeploys`, `botPrEnvironments`, `focusedPrEnvironments` all `true` — identical to foundry-studio.
- **No preview for a lane PR yet.** One check stands between here and a founder seeing their work run.

## Slice 4 (2026-09-30): it is Railway's, and here is what to ask them

John checked the GitHub side: **Railway's connector is set to "All repositories."** So the hypothesis in
slice 3 is dead — access was never the problem.

Two further checks, both conclusive:

- **Service-level settings are identical too.** Slice 3 compared every `Project` field; this compares every
  scalar on the `ServiceInstance` for both production environments. **The only difference is the service's
  name.**
- **Railway can read arca's pull requests.** `githubPRInfo` for arca PR 88 returns
  *"Add Bruntsfield's two working rules"* — the real title of a real open pull request. The same query
  against a foundry-studio PR works identically.

So: Railway has full access to the repository, can read its pull requests, and every project and service
setting matches the project where this works. **Six causes have now been ruled out by experiment and two by
exhaustive comparison.** There is nothing further to find from this side.

### What to ask Railway support

> Two projects on my account are configured identically and only one creates PR environments.
>
> **Works:** project `foundry-studio` (`e46a7bb4-463f-475d-a20d-78e0d5b7eedd`), repo
> `wealthcx01/fountainbridge`. A PR creates an environment and it is torn down on merge.
>
> **Does not:** project `arca` (`4df47e04-f7ed-4d81-8243-2b00b5d44153`), repo `wealthcx01/arca`, branch
> `master`. No PR environment is ever created.
>
> On the non-working project I have confirmed: `prDeploys` true, `botPrEnvironments` true,
> `focusedPrEnvironments` true; the service is connected to the repo; a `staging` environment exists; the
> service has built successfully from git; the GitHub connector is set to "All repositories"; and
> `githubPRInfo` returns real pull-request titles for that repo. Every scalar field on both `Project` and
> `ServiceInstance` is identical between the two projects apart from names and ids.
>
> Test pull requests were opened and closed on the working repo's pattern and no environment appeared.
> What else determines whether a PR environment is created?

### What this does not block

Nothing except the preview link itself. Everything downstream is built and tested: `previewUrlFrom` reads
the URL, refuses console links, and `lib/trail.ts` renders the hop. **The moment Railway creates one
environment, the link appears with no further work.**

## Verification

No screen and no code changed — this is an infrastructure record. Non-negotiable 11 does not apply, said
rather than left blank.

The change is one `projectUpdate` mutation and is reversible by the same call with `false`. Everything
else in this ticket came from reading.


## Slice 5 (2026-10-01): checked live before asking John again, and the message needed correcting

John: *"Double check I am actually blocking before asking."* Right to insist. Checked against the live
account rather than against this ticket, and **one sentence of the support message above was wrong.**

### What is true right now

| | arca | foundry-studio |
| --- | --- | --- |
| `prDeploys` / `botPrEnvironments` / `focusedPrEnvironments` | all **true** | all **true** |
| environments | `staging`, `production` | `staging`, `production` |
| ephemeral environments | **none** | **none** |
| open pull requests | **3** (88, 86, 83) | 0 |
| GitHub repository webhook | **none** | **none** |

**Neither repository has a webhook**, which is not a fault: Railway receives pull-request events
through its GitHub App installation, not through a per-repo hook. So that is not the difference, and
it is recorded here so nobody spends an afternoon on it.

### The correction

The message above says foundry-studio *"works"*, in the present tense. The last evidence of it
working is **2026-07-31** — PR 67, which produced a real preview at
`foundry-studio-fountainbridge-pr-67.up.railway.app` and is written up in this lane's notes. Scanning
the last **100 deployments** on foundry-studio finds **not one tied to a pull request**.

So the honest question is not *"why does one project work and the other not"*. It is **"this worked on
one project in July and has not happened on either since — what changed?"** Those get different
answers, and the first invites the reply *"your other project does not do it either"*.

### The experiment this ticket update is

This pull request is itself the test. If a preview environment appears for it, the asymmetry is real
and the corrected message is the right thing to send. If none appears, PR environments have stopped
working for the whole account and the cause is account-level — a plan change being the obvious
candidate, since Railway bills preview environments.

The result is recorded below rather than predicted.

### What is genuinely John's, and what is not

- **Not John's:** the GitHub grant. He checked it on 2026-09-30 and the connector is set to "All
  repositories". That hypothesis is dead and must not be asked for again.
- **Not John's:** anything about project or service configuration. Every scalar on both is identical.
- **Possibly John's, and cheap:** whether the Railway plan still includes preview environments. The
  public API does not expose the subscription to a CLI token; the dashboard does.


### The result: previews work, and my correction above was wrong

**A preview environment appeared for this pull request within ninety seconds** —
`fountainbridge-pr-315`, ephemeral, with a working URL at
`foundry-studio-fountainbridge-pr-315.up.railway.app` published in the commit status
**description** (the usable one of GitHub's three deploy systems).

So preview environments work on foundry-studio **today**, not only in July. The sentence I wrote
above — *"the last evidence of it working is 2026-07-31"* — was wrong, and it was wrong because a
scan of the last 100 deployments found none tied to a pull request. That scan was the wrong
instrument: a preview's deployments live in its own ephemeral environment and go with it when the
environment is torn down.

**The original support message was right and needs no correction.** Two projects, identical
configuration, one creates preview environments and one does not. That is still exactly the question
to ask.

The reason this is recorded rather than quietly fixed: the experiment was run precisely because John
said *"double check I am actually blocking before asking"*, and running it stopped a wrong message
being sent. The method worked even though my hypothesis did not.

### And it found something worse, which is now FB-243

The preview URL **redirects to production**:

    https://foundry-studio-fountainbridge-pr-315.up.railway.app/
      → 307 https://foundry-studio-production-4a73.up.railway.app/login

A reviewer opening that link sees production, not the pull request's work, and has nothing on screen
to tell them. This lane's notes describe this exact trap from 2026-08-04 and give the fix; it is back
because Railway forks each preview from production and inherits its variables, so a literal value in
production becomes a literal value in every preview.

It matters here because this ticket's own closing claim is that *"the moment Railway creates one
environment, the link appears with no further work."* The link appears. **It is a lie.** Filed as
FB-243 rather than fixed, because changing production's sign-in variable is a high-blast-radius
infrastructure change (D7: dual approval).
