# Venture VPS provisioning (FB-011)

**Decision D1: one VPS per venture, from day one**, with SSH for both the founder and John.
Reprovisioning must be cheap — a founder with root can break their box, and the recovery path is
**snapshot/rebuild, not archaeology**. This runbook + `scripts/provision-venture.sh` make the
scriptable steps repeatable; the steps that need an interactive login or a human decision are
called out as **[MANUAL]** and never automated (CLAUDE.md gates — nothing external runs silently).

> **Status:** the runbook and script are complete and reviewable. The **live validation** (actually
> provisioning a Hetzner box, the rebuild drill, creating Workspace identities, the subscription
> decision) requires credentials + a human and is tracked in the checklist at the end — it has not
> been executed by the lane.

## Prerequisites (operator machine)

| Tool | Why |
|---|---|
| [`hcloud`](https://github.com/hetznercloud/cli) | create/manage the Hetzner box |
| [`yq`](https://github.com/mikefarah/yq) | read the venture manifest |
| `ssh`, `curl` | configure the box, fetch SSH keys |
| `HCLOUD_TOKEN` | Hetzner Cloud API token (project-scoped) |

SSH keys are **pulled from GitHub** (`https://github.com/<login>.keys`) for the founder
(`founder.github_login` in the manifest) and John (`JOHN_GITHUB_LOGIN`, default `wealthcx01`), so
the box trusts exactly those accounts — no key material in the repo.

## Provision a box

```bash
# Review the plan + rendered cloud-init without touching Hetzner:
scripts/provision-venture.sh ventures/the-reset.yaml --dry-run

# Provision for real:
HCLOUD_TOKEN=… scripts/provision-venture.sh ventures/the-reset.yaml
```

Sizing: **CX-class** (`SERVER_TYPE=cx22`, 2 vCPU / 4 GB) per current workshop sizing — raise via
`SERVER_TYPE` and note the change here if a venture needs more. Image: `ubuntu-24.04`.

The script is **idempotent**: if a server named `venture-<id>` exists it skips creation and
re-applies config over SSH. It clones the venture's manifest repos into `/srv/<repo>` (best-effort —
repos that don't exist yet, e.g. THE RESET's, are skipped with a warning).

## Hardening baseline (via cloud-init)

`scripts/cloud-init.yaml.tmpl` applies on first boot:

- **Key-only SSH** — `PasswordAuthentication no`, `PermitRootLogin prohibit-password`; only the
  founder's + John's GitHub keys are authorized.
- **ufw** — deny incoming except OpenSSH (widen per-venture as services land).
- **fail2ban** — enabled.
- **unattended-upgrades** — security patches auto-applied.
- Base tooling: `git`, `tmux`, `curl`, `unzip`.

## [MANUAL] Tooling + lanes (interactive logins)

Run on the box (`ssh root@<ip>`) — these need auth and are deliberately not scripted:

1. **Claude Code** — install + `claude` login.
2. **gstack** — install the skill pack; **gbrain** — `setup-gbrain` (see below for what persists).
3. **GitHub org auth** — `gh auth login` scoped to `GITHUB_ORG`, so lanes can open PRs.
4. **tmux lanes** — one window per `lanes[]` entry in the manifest (`tmux new -s <venture>`,
   window per lane `id`), each running its standing order. `one ticket = one branch = one PR;
   never merge` holds on the box exactly as in the studio.

## Snapshot / rebuild (recovery in < 1 hour)

The box is **disposable**. Everything durable lives in git or is re-derivable:

| State | Disposable? | Recovery |
|---|---|---|
| OS + tooling | yes | cloud-init + [MANUAL] tooling on rebuild |
| venture repos (`/srv/*`) | yes | `git clone` (source of truth is GitHub) |
| in-flight branches not pushed | **back up** | push before teardown, or accept loss |
| **gbrain index** | yes (re-derivable) | re-run `sync-gbrain` after rebuild; it re-indexes git. **Durable memory/decisions should be committed to the venture repo** (D8 `context/`), not left only in gbrain — so a rebuild loses nothing important. |

**Rebuild drill:** ⚠️ `delete` is irreversible and unconfirmed — double-check the `<id>` (and push
any unpushed branches) before running it.
```bash
hcloud server delete venture-<id>              # destroy (verify the id first!)
HCLOUD_TOKEN=… scripts/provision-venture.sh ventures/<id>.yaml   # reprovision
# re-run the [MANUAL] tooling steps; sync-gbrain; restart lanes
```
Take a Hetzner **snapshot** after the [MANUAL] tooling is in place to shortcut future rebuilds
(`hcloud server create-image --type snapshot venture-<id>`), then rebuild from the snapshot image.

## [MANUAL] Founder identity (Google Workspace)

Per D3/GTM (`docs/research-gtm.md` §7): the founder operates on a **Bruntsfield-assigned
venture-domain Workspace account** (e.g. `ross@thereset.com`), never a personal `@gmail.com`. Create
it in Google Workspace, hand it to the founder to manage, and record it as `founder.workspace_email`
in the manifest. Agent *send* identities (Phase 4b) are provisioned the same way. The provision
script hard-fails if the manifest's `workspace_email` is an `@gmail.com`.

## [DECISION] How lanes are powered (subscription + cost)

A decision for John, not a default — record the outcome here per venture:

- **Shared Max vs per-venture subscription:** usage ceilings multiply as lanes multiply; a shared
  plan is cheapest but risks contention and ToS questions for commercial third-party ventures.
- **Per-venture monthly cost line:** VPS (CX22 ≈ small monthly EUR) + inference. Fill in per venture
  when the box is live.
- **ToS posture:** confirm the plan permits the venture's commercial use before a paying venture
  runs on it.

## Live-validation checklist (requires John + credentials — not done by the lane)

- [ ] **Scratch box from ARCA:** `provision-venture.sh ventures/arca.yaml`; run one real ticket
      through a lane on it (ticket → branch → PR); verify founder-key + John-key SSH both work; teardown clean.
- [ ] **Rebuild drill:** destroy + reprovision the scratch box; lane working again; **timed and
      documented** here.
- [ ] **THE RESET's box:** provision from `ventures/the-reset.yaml`; Ross's SSH + GitHub collaborator
      access confirmed; first lane live. *(Note: the plan sequences the real Reset box at Phase 3;
      this runbook is what executes it.)*
- [ ] **Founder Workspace identity** `ross@thereset.com` created + recorded in the manifest.
- [ ] **Subscription/cost decision** recorded above.
