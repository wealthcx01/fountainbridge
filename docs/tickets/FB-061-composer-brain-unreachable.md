# FB-061 — The composer could never reach the venture brain

**Status:** In review · **Phase:** 3 · **Depends on:** FB-050 (the venture brain) · **Repo:**
fountainbridge (+ venture box) · **Branch:** `fb-061-brain-bridge-compose-network`
One ticket = one branch = one PR.

## Why this matters (for the founder)
When you ask the composer something about your venture, it should answer from everything the venture
knows — the tickets, the context you deposited, the code — not from the conversation in front of it.
That was built in FB-050 and has never once worked.

## Context
Found while answering "can I start dogfooding ARCA?" — by opening the box rather than by reading the
code, which is the only reason it was found at all. **Three independent faults**, each of which alone
was enough to break it, and the failure was silent to everyone except a log line nobody read.

1. **ufw dropped the traffic.** A venture box runs ufw with SSH/80/443 and nothing else. The
   composer's container → host bridge port was DROPPED, which presents as a connect *timeout* rather
   than a refusal — the shape of failure that looks like "the service is down" for an afternoon. The
   installer never opened it.

2. **The bridge bound the wrong address, for a subtle reason.** `host.docker.internal:host-gateway`
   resolves to Docker's **default** bridge (`docker0`), not to the gateway of the container's own
   compose network. Once every container sits on a compose network, `docker0` has nothing attached,
   goes NO-CARRIER, and **`os.networkInterfaces()` stops listing it** — so the one correct address
   became invisible to the obvious API and the bridge fell back to 127.0.0.1.

3. **The box's LibreChat config predated FB-050.** No `extra_hosts`, no `brain-mcp` mount, no
   `venture-brain` MCP server, and the composer agent had five tools rather than six. FB-050 merged
   in git and never landed on the box.

I got fault 2 wrong on the first attempt — assumed `host-gateway` meant the container's own network
and made the bridge *prefer* the compose bridge. The box disproved it in one command: the container's
`/etc/hosts` maps `host.docker.internal` → `172.17.0.1`, and only that address answers.

## Scope
- `brain-bridge.mjs`: prefer `docker0`, and fall back to `ip -4 -o addr show docker0` — which reports
  a down interface's address perfectly well — before giving up. A compose bridge is used only when
  there is no `docker0` at all.
- `install-gbrain.sh`: open the bridge port to the docker subnets on an active ufw. Scoped to
  `172.17/16` and `172.18/16`, never `Anywhere` — the venture's whole knowledge index sits behind one
  bearer token and this port has no business facing the internet.
- Deploy the current `deploy/librechat/` to the box (compose with `extra_hosts`, `brain-mcp`, the
  `venture-brain` MCP server) and re-seed the composer agent.

## Out of scope
- The embedding timeouts on four vendor JS bundle pages (an ignore-list question — its own ticket).

## Acceptance criteria
- [x] The bridge auto-detects the right address on a box whose containers are all on a compose
      network, with no `FOUNDRY_BRAIN_BIND` override.
- [x] A fresh `install-gbrain.sh` leaves the port reachable from the composer's container.
- [x] The composer's `search_venture_brain` tool initialises and the agent carries it.
- [x] Verified on ARCA's box: `[MCP][venture-brain] Tools: search_venture_brain`, agent seeded with
      six tools, bridge listening on `172.17.0.1:3131`, health reachable from inside the container.

## Verification
8 unit tests over the address detection, including the exact `os.networkInterfaces()` output from
ARCA's box with `docker0` absent. Then the real thing: ufw opened, bridge restarted with no override,
`fetch('http://host.docker.internal:3131/health')` from inside `librechat-api` returning
`{"ok":true}`.

## The lesson worth keeping
This is the third time today a box-side change passed lint, review and CI while being completely
non-functional in reality. The common thread is that **every one of these faults is at a seam a unit
test mocks away** — a firewall, a network namespace, a stale file on a server. Anything touching
`deploy/*` is unverified until it has been exercised on the box.
