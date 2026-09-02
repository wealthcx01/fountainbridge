# FB-163 — The real pixel-agents embed (gap G6, properly)

## Correction, 2026-09-02: the blocker I recorded was the wrong blocker

The earlier investigation concluded this was "not buildable on the current stack" because **Next's
App Router cannot proxy a WebSocket**. That is true, and it is beside the point: **an iframe does not
go through Next at all.** The browser connects to the venture box directly. I rejected an
architecture I had not evaluated, on the strength of a limitation in one I had.

John was right to push: *"it links to a CLI, it should be straightforward to integrate via iframe."*

**The infrastructure this needs is already running on the ARCA box, in production, today:**

```
# /etc/caddy/Caddyfile — already there
chat.arca.bruntsfield.capital {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3080
}
```

Caddy is `active`, `chat.arca.bruntsfield.capital` resolves to the box, TLS is automatic, and Caddy
proxies WebSockets natively. Adding `office.arca.bruntsfield.capital → 127.0.0.1:<pixel-agents-port>`
is a DNS record and four lines. The pattern is proven — the composer already reaches the founder
through exactly it.

## What the REAL blockers are

Three, all ordinary work rather than architectural walls:

1. **Authentication.** pixel-agents has none. An open `office.arca…` would publish the venture's
   agent activity to anyone with the URL — and venture isolation is non-negotiable 6. Options, in
   the order I would try them: Caddy `forward_auth` against a studio endpoint that checks the
   session's venture scope; a short-lived signed URL minted per page load; `basic_auth` as a
   stopgap, which an iframe handles badly.
2. **Read-only.** `clientMessageHandler.ts` accepts `closeAgent` from any connection, so a viewer
   could kill an agent. Caddy cannot filter WebSocket payloads — this needs either a patch upstream
   or a small message-filtering proxy on the box. It is the reason a bare reverse-proxy is not
   enough, and it is the part with real work in it.
3. **`frame-ancestors`.** pixel-agents must permit being framed by the studio's origin, and by
   nothing else.

## What has NOT changed

Heuristic mode still needs no hooks install — proven on this box, `~/.claude/settings.json`
untouched. And ARCA's lane is parked at its daily budget most of the time, so the office would often
be legitimately empty; that is a fact to render honestly, not a reason to defer.

The design's own words: *"Each character is 1 agent on Arca's machine; a raised hand is a wait on
you. The studio embeds it read-only."* Read-only is in the requirement, and item 2 is how it is met.


**Status:** Todo · **Area:** Venture box + studio · **Depends on:** FB-139
**Design:** `docs/design/foundry-desk/` — screen 3, "The office"; `README.md`: *"No raster assets. The
pixel-office is a placeholder drawing; the real plate is the **pixel-agents embed** (G6)."*
**Upstream:** https://github.com/pixel-agents-hq/pixel-agents — MIT, TypeScript, ~9.2k stars.

**Shipped in part:** nothing of the embed has shipped. What has is the investigation this ticket
asked for first — the three "known unknowns" below are now answered, and two of them change what
should be built. **Read "What the box actually said" before writing any of it.**

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

## What the box actually said

Settled on the ARCA box on 2026-09-02, then removed again — the box is exactly as it was found
(binary uninstalled, `~/.pixel-agents` deleted, no process, `~/.claude/settings.json` **never
touched**, lane timer still active).

### 1. `--no-terminal` does not exist — and is not needed

The README says *"Pass `--no-terminal` to disable the embedded terminal"*. It is not a flag. In
published **1.4.1** and in `main`, `parseArgs` accepts `--port`/`-p`, `--host` and `--help`, and the
CLI's own `--help` lists exactly those three.

It does not need to. `server/src/clientMessageHandler.ts` says it plainly:

> Standalone agents are always **external (no terminal)**, so mirror the VS Code external-agent
> branch…

The terminal is a VS Code feature. **The property this ticket called non-negotiable is structurally
true in standalone**, which is a better guarantee than a flag — a flag can be forgotten.

### 2. The hooks do not need installing at all

The ticket assumed hooks, and hooks mean editing `~/.claude/settings.json` on a live venture box.
They are not required: **heuristic mode** reads the JSONL transcripts Claude Code already writes
under `~/.claude/projects/`, and the lane's are right there —

```
[Pixel Agents] Scanning project dir: /root/.claude/projects/-opt-foundry-lane-arca
```

Proven end to end: a real Claude session in a watched workspace produced `agentCreated` and
`AGENTS: 1` over the WebSocket, with the settings file untouched throughout. That is a far lighter
integration than this ticket was written around, and it removes the "what do the hooks see" unknown
by removing the hooks.

### 3. The studio cannot proxy it — and this is the one that matters

The office is Canvas 2D driven over a **WebSocket** (`/ws`). **Next's App Router route handlers do
not support a WebSocket upgrade**, and Railway runs `next start`, not a custom server. So *"the
studio proxies it; the desk never iframes the box directly"* — the isolation design in this ticket's
own scope — **is not buildable on the current stack.**

There is no HTTP fallback to poll instead: the server exposes `/api/health` and the socket, and
nothing else that carries agent state.

### 4. And a naive proxy would not be read-only anyway

Only the **hooks install** is token-gated. `closeAgent` is accepted from any connection and calls
`dismissalTracker.dismiss` + `removeAgent` — an untokened viewer can remove agents from the office,
and change its settings and layout. So a proxy would have to **filter client→server messages**
(allow the `webviewReady` handshake, drop the rest), not merely forward them.

### 5. ARCA's office would be empty most of the time regardless

The lane is parked at its daily budget of 20 wakes: it writes a `blocked` report every five minutes
*without starting a Claude session at all*. There is nothing for the office to draw for most of a
day. That is a fact about the lane's budget, not about this integration, and it is worth knowing
before anyone judges the result.

## So what should be built

One of these, and it is a decision rather than a detail:

- **A second process next to the studio** that can hold a WebSocket — a small proxy service on
  Railway that terminates the founder's socket, checks the session against the venture, and opens
  its own socket to the box, forwarding only frames from box→browser and only `webviewReady` the
  other way. Keeps isolation server-side, at the cost of a service to run.
- **A per-venture subdomain with the box serving it directly**, which this ticket explicitly
  rejected — and the rejection still stands: isolation would rest on the box's own auth rather than
  on the studio's session, and the bearer token would have to reach a browser.
- **Upstream a read-only mode**, which is the cleanest long-term answer and the slowest.

Until one is chosen, FB-139's plate stays. It is a drawing, it says so in its own header, and it is
live and honest.

## Acceptance criteria

- [x] `pixel-agents` runs on the ARCA box, bound to localhost. Proven, then removed — there is no
      service until the proxy question above is settled, because a service with nothing reading it is
      a process to forget about.
- [x] The `--no-terminal` requirement is **withdrawn**: the flag does not exist and standalone has no
      terminal to disable.
- [x] A real Claude session appears as a character, in **heuristic mode with no hooks installed**.
      Proven in a scratch workspace rather than a lane's, so nothing about the lane was disturbed.
- [ ] The *lane's own* sessions appear. Not observable today: ARCA's lane is parked at its daily
      budget and starts no Claude session.
- [ ] The studio embeds it read-only through a server-side proxy. **Blocked on a decision** — Next's
      App Router cannot proxy a WebSocket. See "So what should be built".
- [ ] No token, host or port of the box reaches the browser.
- [ ] A venture with no embed shows FB-139's plate, still saying what it knows.
- [ ] The ledger is unchanged and still readable without the picture.
- [ ] Proven on the ARCA box before the PR: a wake starts, a character moves, a hand goes up when it
      waits.
