# FB-192 — the office on the desk: the socket was never the problem

**Status:** Done · **Phase:** 3 · **Found by:** finishing FB-163, 2026-09-05

## Where this starts

FB-163 built the venture office and did not switch it on. It left two things written down as
unsolved:

> pixel-agents' own client will not hold a socket through the studio proxy. It closes about five
> milliseconds after it sends `webviewReady`, with no error, and it reconnects for ever.

> The custom server destabilises the suite. Handling `req`/`res` errors and `clientError` improved it
> and did not settle it: the next run was 58 failures.

Both were real. Neither was what it looked like.

## The socket held all along

Three experiments, in order, each one narrowing where the fault could be.

**The box, on its own.** A plain WebSocket client from a laptop to
`wss://chat.arca.bruntsfield.capital/office/ws`, carrying the secret. It connected in 45ms, answered
the handshake in 3ms, sent 52 messages — the whole office, twenty agents, every sprite sheet — and
was still open fifteen seconds later. The box was never at fault.

**The studio's proxy.** The same plain client, through `server.js` to the box. 52 messages, held
fifteen seconds. The proxy was never at fault either.

**A real browser.** The office loaded. Sprites, furniture, twenty people at desks.

So the socket worked, and had been working. What FB-163 recorded was a real observation of a
*different* fault — and looking at the office in a browser, which FB-163 never did, found four of
them in one screenshot.

## What was actually wrong, and it was all visible

### 1. The office reset every sixty seconds

Measured: the socket closed at 60.8s and opened again at 60.9s, on a page nobody had touched.

`mintOfficeToken` put `now + 10 minutes` in the token, and the token is in the iframe's URL. So every
server render produced a different `src`. `WhileWorking` re-renders the desk once a minute while a
venture is working. A changed `src` reloads a frame; a reloaded frame closes its socket and redraws
the room from nothing.

Fixed twice over, because either alone leaves a gap:

- The expiry is now measured from the **start of the half hour the render happens in**, so every
  render inside that half hour mints an identical string and the frame is left alone. A token is
  good for between thirty and sixty minutes instead of exactly ten.
- `OfficeEmbed` keeps the address it mounted with. A frame that is already connected has no reason
  to restart because the page around it re-rendered.

### 2. The office was drawn in the wrong font

Every piece of text in the room rendered in the browser's fallback sans-serif.

The stylesheet asks for the office's own font with a relative `url(../fonts/…)`. That resolved to a
studio address carrying **no token** — a `url()` in CSS carries only what is written in it. Untokened,
the route fell through to the session check; the frame is sandboxed and has no cookie to offer; the
answer was 401. The browser reported it as a CORS failure, which is true and unhelpful: a 401 carries
no `access-control-allow-origin` header.

The stylesheet is now rewritten on the way past, the same way the document already was.

### 3. A founder was shown four controls, three of them dead

pixel-agents is an editor extension and its interface says so: **Layout**, **Settings**, an
**"Updated to v1.4! / See what's new"** card, and a **version watermark**.

Layout and Settings write to the box. The studio forwards exactly one message from a browser
(`webviewReady`) and drops everything else, so pressing them did nothing at all — dead controls on a
founder's desk. The update card is addressed to whoever installed the extension, and it would never
have gone away: dismissing it writes a setting, and that write is dropped too.

All four are hidden by a stylesheet the studio adds to the office document. The zoom buttons go with
them for a different reason, in the next item.

### 4. The room did not fit, at any height that was polite

At the frame's 19rem the founder saw the ceiling and a strip of floor. Given enough height to show
the whole room — about 44rem — more than a third of that height was empty background, because
pixel-agents draws its room low and left in whatever space it is given.

So the frame is tall and the window over it is short: 44rem of frame, 26rem of window, the dead space
clipped rather than paid for. The zoom buttons are hidden because zooming moves the room out from
under that window.

### 5. Not on a phone

At 393px the room is wider than the screen and pixel-agents does not shrink it to fit — checked at
four frame heights, all of them a corner of a floor and part of a sofa. A fragment of a room tells a
founder nothing.

The phone keeps FB-139's drawn plate. That also keeps the pocket studio what FB-160 decided it should
be: the things a founder can act on, and a live animation is not one. The frame is not mounted at
all rather than mounted and hidden — a hidden iframe still loads the app and still holds a socket
open, and a founder on a train would pay for a room they cannot see.

## The suite was never unstable either

`next start` sets `NODE_ENV=production` itself before it boots. A custom server does not, and nothing
else in the stack does it either. So `process.env.NODE_ENV !== 'production'` was true everywhere the
studio was not handed the variable, and `server.js` quietly started Next in **development** mode
against a production build.

The UI gate runs `next build` and then starts the server with no `NODE_ENV`. Every gate run against
the custom server was therefore a dev server: compiling routes on demand, serving a build it was not
reading, and running an HMR socket that `server.js` was tearing down as fast as the browser could
open one — the upgrade handler destroyed every socket whose path was not `/ws`.

Measured on one commit:

| | Result |
|---|---|
| Custom server, `NODE_ENV` unset (what CI was doing) | 3 failures in 52 tests; a run that died with `uncaughtException: [Error: aborted] { code: 'ECONNRESET' }` |
| Custom server, `NODE_ENV=production` | **280 passed, 0 failed**, no uncaught exceptions, server still alive |

`server.js` now sets `NODE_ENV` the way `next start` does, and hands upgrades it does not own to
Next's own handler instead of destroying them. `--dev` is how you ask for a dev server, so that
running one is a deliberate act rather than an accident of an unset variable.

## The box side is a script now

ARCA's office was stood up by hand. A thing that lives only in one operator's shell history is not a
thing the next venture has, so `scripts/provision-office.sh` installs the pinned version, writes the
service, prints the Caddy block, and proves the gate answers 403 without the secret and 200 with it.
It does not touch the studio's own variables: those change a running production service and are
printed as `[MANUAL]`.

## Heights

The office is new on the desk, so the desk is taller by the height of the window it adds.

| Screen | Before (plate) | After |
|---|---|---|
| Desk, desktop 1440×1000 | 3,342px | 3,472px (the office) |
| Desk, phone 393×851 | 3,371px | 3,371px (the plate, unchanged) |

The desktop desk grows by 130px, not by the whole height of the office: the window is 26rem and the
plate it replaces was already about 18rem of the page.

## What is not covered by the gate, and why

The UI gate has no venture machine to reach and must not grow one. So the rewrites, the token
scheme and the hidden-chrome list are unit tested as pure functions, and the office itself was
verified by rendering it against the real ARCA box at 1440×1000 and 393×851 and looking at it.

The hidden-chrome list is position classes, because the bundle offers no ids and no data attributes.
That is exactly as brittle as it looks, so the version is pinned on the box and the list is asserted
in a test: a version bump that moves a button turns the gate red instead of quietly showing a founder
a Settings panel they cannot use.
