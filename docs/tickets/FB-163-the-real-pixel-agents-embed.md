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


**Status:** Shipped in part · **Area:** Venture box + studio · **Depends on:** FB-139
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

- [x] `pixel-agents` runs on the ARCA box, bound to localhost. **A pinned install and a systemd
      service now, not a probe** — `foundry-office.service`, watching the Build lane.
- [x] The `--no-terminal` requirement is **withdrawn**: the flag does not exist and standalone has no
      terminal to disable.
- [x] A real Claude session appears as a character, in **heuristic mode with no hooks installed**.
      Proven in a scratch workspace rather than a lane's, so nothing about the lane was disturbed.
- [ ] The *lane's own* sessions appear. Not observable today: ARCA's lane is parked at its daily
      budget and starts no Claude session.
- [ ] The studio embeds it read-only through a server-side proxy. **Built, and not switched on.**
      The proxy carries real frames to a plain client; pixel-agents' own client will not hold the
      socket through it, and the custom server destabilises the test suite. Both written up above.
- [x] No token, host or port of the box reaches the browser. The page carries a signed token naming
      one venture and nothing else; tested.
- [x] A venture with no embed shows FB-139's plate, still saying what it knows. Verified with the
      office unset: plate present, embed absent, desk 2,395px — unchanged.
- [x] The ledger is unchanged and still readable without the picture.
- [ ] Proven on the ARCA box before the PR: a wake starts, a character moves, a hand goes up when it
      waits. **The room renders against the box directly** — canvas, floor, walls, furniture — but not
      yet through the studio, and the lane is parked for most of the day either way.

---

## 2026-09-04 — the blocker was half a blocker, and the box half is done

### The studio CAN proxy a WebSocket

Section 3 above says it cannot, because "Next's App Router route handlers do not support a WebSocket
upgrade, and Railway runs `next start`". The first half is true. **The second half was our own
`railway.json`, not a constraint** — Railway runs whatever the start command says.

So the studio holds the upgrade itself, in `server.js`, and there is no second service.

The usual objection to a custom server is losing Automatic Static Optimization. There is nothing to
lose: `next build` reports **one** static route in this app (the web manifest) and every other one is
server-rendered on demand. Checked, not assumed.

### What is on the ARCA box now, and it is proven

- `pixel-agents@1.4.1`, pinned under `/opt/foundry/office`, run by `foundry-office.service` from
  `/opt/foundry/lane/arca` — the working directory is what selects the watched lane.
- Bound to `127.0.0.1:4310`. Nothing reaches it except Caddy.
- Caddy serves it at **`chat.arca.bruntsfield.capital/office`** — a path on the hostname the composer
  already uses, so no DNS record and no second certificate. There is no wildcard record on
  `*.arca.bruntsfield.capital`, so a new subdomain would have needed a DNS change anyway.
- The path is refused without the studio's shared secret: **403 without it, 200 with it**, checked
  from off the box. The founder's composer on the same hostname still answers 200.

### What is in the studio, and what it does

- `server.js` — the upgrade handler, the token check, and the message filter.
- `lib/office-embed.ts` — a short-lived signed token naming one venture. It carries no host, no port
  and no credential, and it is minted only after `canAccessVenture` has passed.
- `app/venture/[id]/office/[[...path]]/route.ts` — the app's own files, proxied.
- `components/OfficeEmbed.tsx` — the frame, with FB-139's plate as the fallback.

**Read-only is a filter, not a setting**, for the reason section 4 gives: the box accepts `closeAgent`
from any connection. The studio forwards exactly one message from browser to box — `webviewReady` —
and drops everything else. Tested against the message names that would change the office.

**The frame is sandboxed without `allow-same-origin`.** pixel-agents' bundle is upstream code, and
code in the studio's own origin could call the studio's own server actions, including the one that
approves an external send. The cost is that the frame's fetches carry no cookie, which is why the
token authorises them and why `venture/<id>/office` is the one path excluded from the auth
middleware — the check moved into the route, it did not go away.

### Proven, and not proven

**Proven:** a plain WebSocket client, through the studio, receives real frames from the box —
`providerCapabilities`, `characterSpritesLoaded`, `petSpritesLoaded`. The proxy carries the office.

**Not proven:** pixel-agents' *own* client does not stay connected through the studio. Its socket
closes about five milliseconds after it sends `webviewReady`, with no error, and it reconnects for
ever. The same app against the same box **directly** renders the room and its furniture perfectly.

What has been ruled out, each by experiment:

| ruled out | how |
| --- | --- |
| the box | direct connection opens in ~20ms and streams frames, repeatedly |
| the upstream socket | the app fails the same way with the upstream removed entirely |
| the `<base>` injection | removed; no change |
| the sandbox / iframe | fails identically on the page loaded top-level |
| my `ws` handling | a hand-written socket on the same page, same server, held for 7s and sent fine |
| the handshake | the studio's 101 is byte-identical to the box's, extensions and all |
| a stale token | reproduced with freshly minted tokens |

So it is something about that specific client against this specific proxy, and it is not any of the
obvious things. **The next person should start by capturing the frames on both sides** — the box's
socket and the browser's — and diffing the first exchange, rather than re-deriving the list above.

### The custom server is written, and is NOT switched on

`server.js` exists and works — a plain WebSocket client reaches the box through it and receives real
frames. It is not the start command, and `package.json` still says `next start`.

Two reasons, both found by running the gate against it rather than by reasoning about it:

1. **`next start` was doing error handling that a bare `createServer` does not.** A client that walks
   away mid-request — a closed tab, a cancelled prefetch — emits `error` on the request stream, and
   an unheard `error` on a stream is an uncaught exception. The suite reported
   `uncaughtException: [Error: aborted] { code: 'ECONNRESET' }` and 49 tests failed behind it.
   Handling `req`/`res` errors and `clientError` improved it and did not settle it: the next run was
   58 failures. **Something else about running our own server still destabilises the suite, and it
   has not been found.**
2. The app does not hold its socket through the proxy anyway (below), so switching the studio's boot
   over buys nothing today and risks the one thing a founder cannot work around — the studio not
   starting.

It stays in the tree because it is the substrate and because the finding above is worth keeping. It
gets switched on when the suite is green against it AND the app connects, and not before.

### Therefore the office is OFF

`officeConfigured` needs `OFFICE_HOST_<VENTURE>` and `OFFICE_SECRET_<VENTURE>`, and neither is set on
Railway. The socket half needs `server.js`, which is not the start command. The desk shows FB-139's plate, exactly as it did before — verified: plate present, embed
absent, desk 2,395px, unchanged.

**Do not set those variables until the client connects**, or a founder gets a frame that reconnects
for ever where a working drawing used to be. That is worse than the drawing.

### One limitation worth recording

The office watches **one lane** — the working directory selects it, and `watchAllSessions` in
`~/.pixel-agents/config.json` does not change the scan at startup. ARCA's is the Build lane, which is
the only one with a session in three weeks (Sell last ran 14 August, Scale 17 August). The ledger
beside the plate still names all three surfaces, which is FB-139's own division of labour: the office
is the feeling, the ledger is the record.

### And the lane is parked most of the day

Confirmed again on 4 September: the last real Claude session was 01:37, and every wake since says
`daily wake budget reached (20) — parking`. The office will be empty for about twenty-one hours a
day until that budget changes. That is a fact about the lane, not about this integration.
