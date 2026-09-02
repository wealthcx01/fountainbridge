# FB-163 — The real pixel-agents embed (gap G6, properly)

**Status:** Todo · **Area:** Venture box + studio · **Depends on:** FB-139
**Design:** `docs/design/foundry-desk/` — screen 3, "The office"; `README.md`: *"No raster assets. The
pixel-office is a placeholder drawing; the real plate is the **pixel-agents embed** (G6)."*
**Upstream:** https://github.com/pixel-agents-hq/pixel-agents — MIT, TypeScript, ~9.2k stars.

## What FB-139 shipped, and what it is not

FB-139 built the office from what the venture box already publishes: one character per surface, four
states, a raised hand, and a ledger beside it drawn from the same array. That part is right and it
stays — it is live, it is honest, and the plate and the ledger cannot disagree.

**It is not G6.** The design says *"the real plate is the pixel-agents embed"*, and there is an
actual project it means. FB-139's characters are a drawing I made; the real thing is animated
pixel-art agents that walk to their desks, type while editing, read while searching, and raise a
speech bubble when they are waiting on a person — driven by what Claude Code is **actually doing**,
event by event, not by a run report written after the fact.

The difference a founder feels: FB-139 says *"Build is working"*. This says *"Build walked over,
sat down and started typing four seconds ago."*

## How it actually works

From the upstream README:

- A **standalone CLI** — `npx pixel-agents` — starts a local server and serves the office as a
  browser app. Canvas 2D, WebSocket, no VS Code needed. This is the mode the studio wants.
- Data comes from **Claude Code hooks**: `SessionStart`, `PreToolUse`, `PermissionRequest`, `Stop`,
  with a heuristic fallback that reads the JSONL transcripts under `~/.claude/projects/`.
- The ARCA lane already runs Claude Code on its own box, so the events exist today with nothing new
  to write.

## Scope

- `pixel-agents` as a **systemd service on the venture box**, bound to `127.0.0.1`, alongside the
  lane. It is installed the way everything else on the box is installed, which means it needs a
  delivery path — see the note below.
- **`--no-terminal`, non-negotiable.** Without it the browser app can launch and attach to agents,
  which would be a write path into the venture box from the studio. FB-139's scope says read-only
  **permanently**, and this is the flag that keeps it true.
- **The studio proxies it; the desk never iframes the box directly.** Venture isolation is
  server-side (CLAUDE.md #6), and a proxy is where that can be enforced — an iframe pointed at a box
  hostname is enforced by nothing. The proxy also means no new public hostname, no second TLS
  certificate, and no token in a URL a founder could copy.
- **The token is a bearer capability**, and the upstream README says so plainly: whoever holds it can
  approve a hook install from anywhere the server is reachable. It stays on the box, in the service's
  environment, and never reaches a browser (CLAUDE.md #8).
- **FB-139's plate becomes the fallback**, not a second office: shown when the embed is unreachable,
  which is every venture that has not been provisioned yet. It already says "not live" honestly.
- The ledger stays. *"The office is the feeling; this ledger is the record"* — the embed replaces the
  feeling, not the record, and a screen-reader user still gets the record.

## Out of scope

- Layout editing, furniture, pets, sound. The studio embeds a **view**; a founder does not decorate
  their agents' office from the desk.
- Replacing the ledger.

## Known unknowns, to settle first

- **Delivery.** Box-side work in this repo has no sync path (`deploy/lane/*` is copied by hand;
  three merged tickets are on no box today). This needs one, or it needs to be installed by hand and
  said so.
- **What the hooks see.** The lane runs Claude Code non-interactively from `run-once.sh`; whether
  the hook events fire the same way there as in a terminal has to be proven on the box, not assumed.
- **Cost per venture.** A long-running Node server per box, plus a WebSocket held open per viewer.
  FB-083's rule is about reads, not sockets, but "bounded, and only while working and visible" is
  the spirit and it should be checked.

## Acceptance criteria

- [ ] `pixel-agents --no-terminal` runs on the ARCA box as a service, bound to localhost.
- [ ] The lane's own Claude sessions appear as characters — proven by starting a wake and watching.
- [ ] The studio embeds it read-only through a **server-side proxy**, scoped per venture, with a test
      that one venture's office cannot be reached from another's desk.
- [ ] No token, host or port of the box reaches the browser.
- [ ] A venture with no embed shows FB-139's plate, still saying what it knows.
- [ ] The ledger is unchanged and still readable without the picture.
- [ ] Proven on the ARCA box before the PR: a wake starts, a character moves, a hand goes up when it
      waits.
