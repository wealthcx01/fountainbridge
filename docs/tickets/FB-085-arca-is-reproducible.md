# FB-085 — Prove ARCA's box is reproducible, before THE RESET copies it

**Status:** Done · **Phase:** 0 (provisioning) · **Depends on:** FB-011 (the provisioning runbook),
FB-045 (the three departments), FB-065 (the Agents API) · **Repo:** fountainbridge (+ the ARCA box) ·
**Branch:** `fb-085-arca-is-reproducible` · One ticket = one branch = one PR.

## Why this exists

THE RESET's box is going to be built by copying ARCA's. That is the right plan, and it has one
assumption underneath it that nobody had checked: **that ARCA's box can be rebuilt from this
repository.**

ARCA's box was not built in one clean run. It was built over a week and fixed by hand several times —
the `remoteAgents` config, the Agents API key, the per-agent ACL grant, a firewall rule, a token that
had the wrong scope. Every one of those was a change made on a running machine at speed, and the
question that matters is whether each one came home.

If they did not, then "copy ARCA" produces a box that looks like ARCA and is missing a week of
undocumented repairs. Ross would hit them one at a time, in the worst possible week, and each would
present as *the studio is broken* rather than as *this box was provisioned differently*.

So this ticket is an audit, not a feature. It answers one question with evidence rather than
confidence: **can a new venture box reach ARCA's state from the repository alone?**

## What was checked, and how

Every configuration file and every lane script on the running box was compared byte-for-byte against
this repository. Every environment key on the box was checked against `.env.example`. Every systemd
unit on the box was checked for a corresponding file in the repository. The firewall, the listening
sockets and the container state were read from the machine rather than assumed. The lane timer was
watched through a real firing.

## What it found

**The box is reproducible.** Every file matches: `librechat.yaml`, `docker-compose.yml`,
`seed-agent.js` and all seventeen lane scripts are identical to the repository. All five systemd
units are present in the repository. Every key in the box's `.env` is documented. Nothing was fixed
on the box and left there — the manual steps all came home, the last of them as
`deploy/librechat/enable-agents-api.sh`, which performs all three and proves the result rather than
assuming it.

That is a better answer than expected, and it is the answer that makes a clean duplicate possible.

**One real defect.** The lane's RunReport writer sent its API response to `/dev/null` and then logged
success unconditionally. A rejected write — bad branch, revoked token, protected ref — logged
*identically* to a good one.

Nothing was actually failing. The heartbeat was current, and both parked tickets carried readable
reports. But the studio's only signal that a venture's lane is alive could have gone dead for days
while `journalctl` printed `runreport →` every five minutes, and the founder brief would have shown
nothing at all — with no way for anyone to tell *quiet* from *broken*. A founder blocked at 22:00 must
be able to see why (CLAUDE.md #10), and a silent writer is how that promise gets broken.

**One quiet fallback.** `DEPOSIT_GITHUB_TOKEN` is unset on the box, so deposits run on
`TICKET_GITHUB_TOKEN` instead — which is why they work, and why nobody noticed the dedicated token was
never provisioned. The fallback is kept, because a venture that can deposit is better than one that
cannot, but it now announces itself at startup so an audit can see it.

## What it confirmed is working

The circuit breaker, which is the part most worth trusting. Two tickets — `sign-in-tagline-fix` and
`real-history-honest-gaps` — were tried three times, given up on, and **surfaced**: each carries a
`blocked` RunReport reading *"The lane tried this 3 times and couldn't get it past its own
review/tests. It needs a human — parked."* The lane logs the skip on each later pass without
re-reporting, and a human editing the ticket clears the attempt history so it retries. No silent
abandonment. That is the design, working on a real box against real stuck work.

## A note on how this audit went wrong first

Half of it was spent building a case that the Build department's reports were vanishing — because the
repository was assumed to be `arca-platform`, and `arca-platform` does not exist. Build is
`wealthcx01/arca`, on `master`. Everything was fine; the alarm was an artefact of a guessed name.

This is the third time in a week the same mistake has produced a confident wrong conclusion, so the
correct names are now written down in `docs/venture-box-verified.md` where the next audit will find
them. **Check the name before building the theory.**

## Scope of this pull request

- `docs/venture-box-verified.md` — what a venture box actually is, verified: what matches, the real
  department/repository/branch table, sizing, the provisioning order, and the two steps that cannot be
  scripted.
- The RunReport write is checked, and a failure is loud and specific.
- The deposit-token fallback announces itself.
- Box hygiene: three stale `.bak` configs removed; build cache and journals reclaimed (~0.6G).

## Explicitly NOT in this pull request

- **Re-scoping `TICKET_GITHUB_TOKEN`** — it still holds org-wide admin. That is **FB-072** and it
  should be fixed before a second box is handed the same token.
- **Replacing the RunReport writer.** It is a shell function writing JSON through the contents API;
  **FB-060** replaces it with a structured hand-off. This makes the current one honest, not good.
- **Creating THE RESET's repositories or box.** John's call, and explicitly to be done together.

## Acceptance criteria

- [x] Every config and lane script on the box is proven identical to the repository.
- [x] Every environment key on the box is documented, and the one unset key is named.
- [x] A rejected RunReport write fails loudly instead of logging success.
- [x] The department → repository → branch mapping is written down.
- [x] What cannot be scripted is named rather than implied.

## Verification

Proven on the running box: a good write returns 0 and logs the report path; a rejected write returns
1 and logs `RUNREPORT WRITE FAILED — foundry-state:runreports/… — path contains a malformed path
component`. Both the healthy and failing paths were exercised against the live GitHub API, not
mocked.
