# What a venture box actually is, verified against ARCA

**2026-08-02.** Before duplicating ARCA for THE RESET, the running box was audited against this
repository — file by file, key by key — to answer one question: **can a new box reach ARCA's state
from the repo alone, or does it inherit a week of fixes made by hand?**

The answer is better than expected, and the exceptions are listed rather than summarised.

## Every file matches — with one exception, found later
Every configuration and script on the box is byte-identical to this repository:

| | Result |
| --- | --- |
| `librechat.yaml`, `docker-compose.yml`, `seed-agent.js` | **identical** |
| All 17 lane scripts (`supervisor.sh`, `run-once.sh`, `foundry-lib.sh`, the brain bridge, the PRP and proposal libraries…) | **identical** |
| All 5 systemd units | present on the box, all 5 referenced in the repo |

**This claim was originally stated without that qualifier, and it was too broad for its evidence.**
The comparison above covers the files listed and no others. A day later, a full sweep of `deploy/`
found `enable-agents-api.sh` on the box was **stale** — it derived the studio's key name from the
install directory (`/opt/foundry`, identical on every box) instead of `VENTURE_REPO`, so it printed
`COMPOSER_API_KEY_FOUNDRY` where the studio reads `COMPOSER_API_KEY_ARCA`. Anyone following the
script's own instructions set a variable nothing reads, which is how the studio's composer came to be
broken in production for weeks (FB-086, FB-087).

The lesson is not "check harder". It is that **"every file" must mean every file, mechanically
enumerated** — a spot-check of the files you happen to think of will always miss the one that broke.
That is why the drift sweep now walks `deploy/` rather than a remembered list.

Nothing else was fixed on the box and left there. The manual steps taken during the week — the
`remoteAgents` config, the Agents API key, the per-agent ACL grant — all landed back in the repo, the
last two as `deploy/librechat/enable-agents-api.sh`, which does all three and proves the result rather
than assuming it.

## Every environment key is documented
The box's `.env` holds no key that `.env.example` does not describe. One key is documented and
**deliberately unset**: `DEPOSIT_GITHUB_TOKEN`, which falls back to `TICKET_GITHUB_TOKEN` — which is
why depositing works today, and why it should be set properly on a new box rather than relying on the
fallback.

## Security posture, measured
| | State |
| --- | --- |
| Publicly listening | **22, 80, 443 only** — Caddy terminates TLS |
| LibreChat (3080) | bound to localhost, never exposed |
| Brain bridge (3131) | bound to the Docker bridge and firewalled to `172.17.0.0/16` — reachable by containers on this box and nothing else (FB-061) |
| `ufw` | **active**, with those four rules and nothing else |

The one credential problem is not on the box, it is the box's token: `TICKET_GITHUB_TOKEN` has admin
over the whole `wealthcx01` organisation rather than this venture's repositories (**FB-072**). That
should be fixed before a second box is handed the same token.

## Sizing — the thing that will surprise you
A venture box is **not small**, and almost all of it is one image:

```
/var/lib/docker   12G      ← rag_api ships torch and a local embeddings model
/root              2.9G
/var/log           578M    (vacuumed to 200M)
/opt/foundry       541M
disk               38G total, 7.8G free after cleanup — 79% used
swap               2G, in use
```

Docker reports 17.78GB as "reclaimable" and pruning recovers **almost none of it** — the layers are
shared by running containers. Do not plan around that number.

**For THE RESET: 38G is workable and tight.** A CPX32 (or a larger disk) is the right call if the
venture will hold a real corpus, because the vector store grows with every document deposited.

## The departments, named correctly
Worth writing down because guessing it wastes an hour: ARCA's three departments are **not** three
similarly-named repositories.

| Department | Repository | Base branch |
| --- | --- | --- |
| Build | `wealthcx01/arca` | **`master`** |
| Sell | `wealthcx01/arca-marketing` | `main` |
| Scale | `wealthcx01/arca-ops` | `main` |

Build is the original repository and still on `master`; the two departments added by FB-045 are on
`main`. There is no `arca-platform` — an audit that assumes there is will report a catastrophe that
does not exist, which is exactly what happened during this one. Lane state lives on a **`foundry-state`
branch inside each repository**, not in a separate state repository.

For THE RESET, name all three repositories at creation and put them all on `main`, so the venture
never inherits this asymmetry.

## The one defect this audit found
The lane's RunReport writer sent its API response to `/dev/null` and logged success unconditionally.
A rejected write — bad branch, revoked token, protected ref — logged **identically to a good one**.

Nothing was actually failing: the heartbeat was current and both parked tickets carried a readable
`blocked` report. But the studio's only signal that a lane is alive could have been dead for days
while `journalctl` said `runreport →` every five minutes, and the founder brief would have shown
nothing with no way to tell *quiet* from *broken*. That is precisely what CLAUDE.md #10 forbids.

The write is now checked, and the failure names the report, the ref and GitHub's own message. Proven
on the running box: a good write returns 0, a rejected one returns 1 and logs
`RUNREPORT WRITE FAILED — … — path contains a malformed path component`.

## What the audit confirmed is working
- The lane timer fires every five minutes and completes cleanly (`Consumed 2.045s CPU`).
- The circuit breaker works. Two tickets — `sign-in-tagline-fix` and `real-history-honest-gaps` —
  were tried three times, given up on, and **surfaced**: each carries a `blocked` RunReport reading
  *"The lane tried this 3 times and couldn't get it past its own review/tests. It needs a human —
  parked."* It logs the skip on every subsequent pass without re-reporting, and a human editing the
  ticket clears the attempt history so the lane retries. That is the designed behaviour, working.
- `DEPOSIT_GITHUB_TOKEN` falling back to `TICKET_GITHUB_TOKEN` now announces itself at startup
  instead of hiding, so a box audit can see the dedicated token was never provisioned.

## The order that matters
Learned the hard way; each step fails confusingly if the one before it is missing.

1. Provision the box (`scripts/provision-venture.sh`), DNS for `chat.<host>`, Caddy.
2. `docker compose up -d` — LibreChat, Mongo, Meilisearch, `rag_api`, `vectordb`.
3. **The founder signs in once.** This creates their user record, which the agent seed needs as an
   author. Seeding first produces agents nobody owns.
4. `seed-agent.js` — the composer and research agents.
5. `enable-agents-api.sh` — the `remoteAgents` grant, the API key, and a proof that `/v1/models`
   answers. It prints the key **once**; put it on the studio as `COMPOSER_API_KEY_<VENTURE_ID>`.
6. The lane, the brain, the departments.

## What is still done by hand, and should not be
- **Step 3 cannot be scripted** — a person has to sign in with Google. Everything after it can.
- **The studio variable** (`COMPOSER_API_KEY_…`) is set in Railway by a human, deliberately: it is a
  secret and it never belongs in this repository (CLAUDE.md #8).
