# FB-011 — Venture VPS provisioning: runbook + script v0

**Phase:** 0 · **Depends on:** FB-003 · **Repo:** fountainbridge
**Branch:** `fb-011-vps-provisioning` · One ticket = one branch = one PR.

## Context
Decision D1: **one VPS per venture from day one**, with SSH access for both the human founder and John. Provisioning must be a documented runbook immediately and a script as fast as practical — reprovisioning has to be cheap because a founder with root can break their box (recovery path = snapshot/rebuild, not archaeology).

## Scope
- `docs/provisioning.md` runbook: Hetzner VPS creation (size per current workshop sizing — CX-class; document the choice), Ubuntu + tmux + Claude Code install, gstack + gbrain init, org GitHub auth for the venture's repos, lane setup from the venture manifest, SSH key provisioning for founder + John (keys referenced from the manifest founder identity), firewall/hardening baseline (key-only SSH, fail2ban/ufw, unattended upgrades).
- `scripts/provision-venture.sh` (or cloud-init) automating the scriptable steps, taking a venture manifest as input; idempotent enough to re-run.
- Snapshot/rebuild procedure: how to rebuild a venture box from script + git in under an hour, with gbrain state persistence decision documented (what's disposable vs backed up).
- Validation: provision a **scratch venture VPS from the ARCA manifest**, run one real ticket through a lane on it end-to-end (ticket → branch → PR), then tear down.
- **Then execute for real: THE RESET's box** (venture delivery does not wait for the studio; Reset enters the studio at Phase 1 v0): provision from `ventures/the-reset.yaml`, first lane live, Ross's SSH key + GitHub collaborator access confirmed.
- **Founder identity provisioning step:** create the venture's Google Workspace domain identities (founder account e.g. `ross@thereset.com`, assigned by Bruntsfield, managed by the founder; agent send identities per `docs/research-gtm.md` §7) and record them in the manifest (`founder.workspace_email`).
- **Claude subscription check:** document how venture lanes are powered (shared Max vs per-venture) — usage ceilings as lanes multiply and terms-of-service posture for commercial third-party ventures; per-venture monthly cost line (VPS + inference). A decision, not a default.

## Out of scope
Scheduler daemon (Phase 2); THE RESET's actual box (Phase 3 executes this runbook); multi-venture fleet tooling (Phase 5).

## Acceptance criteria
- [ ] Runbook complete; script provisions a working workshop box from a manifest with ≤3 documented manual steps.
- [ ] Scratch-box validation: PR produced from a lane on the new box; founder-key + John-key SSH both verified; teardown clean.
- [ ] Rebuild drill: box destroyed and reprovisioned, lane working again, timed and documented.

## Verification
/review + /qa; provisioning log + rebuild-drill timing attached to PR.
