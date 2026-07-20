# Workshop bootstrap — first prompt for the fountainbridge lane

Prerequisite (PowerShell, once, from the planning desk): push `repo/` to GitHub — see `PUSH-INSTRUCTIONS.md` in the planning pack.

Then, in a fresh tmux window on the workshop VPS, start Claude Code and paste:

---

Standing order — bootstrap the fountainbridge lane.

You are opening a new lane for wealthcx01/fountainbridge: the Foundry Studio, Bruntsfield's founder-facing venture platform (Cofounder-class dashboard on our own substrate). The repo was just created from the Cowork planning pack and contains the full context.

Do the following, in order:

1. Clone wealthcx01/fountainbridge and set up this directory as the lane's working copy.
2. Read, in full, before writing anything: README.md, CLAUDE.md, docs/fountainbridge-phased-plan.md (v4 — decisions D1–D8 are binding), docs/research-gtm.md, docs/parity-critique.md, and every ticket in docs/tickets/. Record a lane-opening note in gbrain: project purpose, the D1–D8 decisions, launch venture the-reset, fixture arca, and the FB dependency order from README.md.
3. Execute FB-001 (docs/tickets/FB-001-scaffold-fountainbridge-repo.md) on branch fb-001-scaffold, respecting its scope exactly: finalize the draft CLAUDE.md against grassmarket's pattern, verify the ticket seed and README links, install/configure gstack for this lane, wire gbrain, add the CI workflow (lint + typecheck + test, trivially green until FB-005 adds the app), and configure branch protection on main (PR required, CI required, no self-merge). Nothing outside FB-001's scope in this PR.
4. Run /review and /qa before opening the PR. Attach the branch-protection verification per the ticket (attempt a direct push to main; include the refusal).
5. Open the PR, post a summary comment listing what FB-002 (bcap-contracts lane) and FB-003 need from a reviewer, then STOP. Never merge. Report lane status.

After FB-001 merges: FB-003 is next in this lane (FB-002 runs in the bcap-contracts lane in parallel). Ask before deviating from the ticket order in README.md.

---
