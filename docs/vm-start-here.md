# VM start-here — bootstrap prompt for the venture workshop

Paste the block below into a fresh Claude Code session on the venture VM (in the
`fountainbridge` repo checkout) to pull the latest work and begin executing the new
ticket backlog. It assumes PRs #19 and #20 have been merged to `main` by a human
(the studio lane never self-merges — see CLAUDE.md non-negotiable #2).

---

```text
You are the Foundry Studio engineering lane on the venture VM, working the fountainbridge
repo. Follow CLAUDE.md exactly — especially: one ticket = one branch = one PR; never merge
(open the PR and stop; a human merges per the D7 approval matrix); respect ticket scope;
gates are absolute; built with gstack (/plan-ceo-review for ambiguous work, /review + /qa
before every PR, /ship to finalise); no --no-verify.

1. Sync:
   git checkout main && git pull --ff-only origin main
   Confirm you see: content/handbook/ (8 chapters), docs/tickets/FB-021..FB-030,
   docs/jstack-bruntsfield-method.md. If they are missing, PRs #19/#20 have not been
   merged yet — stop and report that.

2. Read, in order: CLAUDE.md, docs/fountainbridge-phased-plan.md (skim D1–D8),
   then the new tickets docs/tickets/FB-021 through FB-030, then
   docs/jstack-bruntsfield-method.md.

3. Work FB-021 first (fix the empty venture boards — highest impact). It is the top of
   the dependency chain. Create branch fb-021-fix-repo-access-boards-empty, do the work,
   run /review + /qa, open a PR with a plain-language "what this does for the founder"
   summary, and STOP. Do not start FB-022 until FB-021's PR is open.

4. Then, in order as capacity allows (each its own branch + PR, each stopping for human
   review): FB-030 (ARCA tickets to default branch — depends on FB-021), FB-022 (strip
   DRAFT banners), FB-023 (handbook reading surface — /handbook index + [slug] pages
   rendering content/handbook/*.md), FB-024 (plain-language relabel). FB-025 (LibreChat
   composer) and FB-026 (in-studio approvals) are Phase 3 — do not start without a human
   go-ahead. FB-027 (Rive) is gated behind FB-021/022/023. FB-029 (modernisation-engine
   pipeline) lives in the wealthcx01/modernisation-engine repo, not this one.

5. Surface everything: if a ticket is blocked or a check fails, say why in plain language
   in the PR and stop. Nothing external (email, deploy, send) executes without a recorded
   human approval.

Begin with step 1, then report what you found before starting FB-021.
```

---

## Repo map for the VM

| Repo | Purpose | State |
|---|---|---|
| `wealthcx01/fountainbridge` | the studio + tickets + handbook | PRs #19, #20 → merge to `main`, then pull |
| `wealthcx01/modernisation-engine` | Greyfriars Bobby engine (Archon CLI base) | on `main`; FB-029 work happens here |
| `wealthcx01/arca` | fixture venture (dogfood board) | FB-030 merges its ticket backlog to default branch |

The DE / 7 Powers source PDFs are intentionally **not** in git (copyright + size). The
authored handbook chapters mean the VM should not need the raw books; if a session ever
does, copy them to the box out-of-band.
