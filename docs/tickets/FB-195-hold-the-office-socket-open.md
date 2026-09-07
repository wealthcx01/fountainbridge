# FB-195 — the studio said nothing for the first half second, and the socket was dropped for it

**Status:** Done · **Phase:** 3 · **Found by:** FB-194's log, 2026-09-05

## What the log said

FB-194 made the studio name the side that ended the office socket. One connection to production, and
the answer arrived:

```
[office] the office socket ended {
  venture: 'arca',
  endedBy: 'the browser closed it (1006)',
  afterMs: 239,
  browser: 3,
  box: 0
}
```

Read it in order.

- `endedBy: the browser closed it` — not the box, and not the studio. Every earlier reading of this
  fault blamed the box, because the only message in the log used to be *"could not reach the venture
  office"*.
- `1006` — an abnormal close with no close frame. Nobody said goodbye; the connection was cut.
- `afterMs: 239` — a quarter of a second after the studio answered the handshake.
- `box: 0` — the box connection was still **CONNECTING**. It had not finished, so the studio had not
  sent the browser a single byte.

## The fault

The studio accepted the browser's socket and then went quiet while it dialled the box.

From a laptop that gap is about 40ms and nobody notices. From Railway to Hetzner it is roughly 400ms
of TLS — and the browser's connection was being cut at around 240ms, every time, before the box had
answered. So the studio was still waiting to speak when the connection it was going to speak on was
already gone.

A proxy that drops an upgraded connection carrying no traffic is ordinary. A socket that says nothing
for half a second while it waits on somewhere else is what makes that ordinary behaviour fatal. The
bug is the silence, not the proxy.

This is also why every earlier experiment said the parts were fine, and they were: the box answers in
42ms, the studio's own connection to the box works from inside the production container
(`/venture/arca/office-ready` returns `{"ready":true}`), and the proxy holds for fifteen seconds when
it is run on a laptop where the gap is 40ms instead of 400ms. Each half worked. The join did not, and
only under the one condition nobody had reproduced: distance.

## What changed

The studio speaks the moment it has the socket, and keeps speaking.

A **ping** is the right thing to say. It is part of the WebSocket protocol rather than part of the
office's, so the app never sees it, there is nothing for it to misparse, and the browser answers
automatically. One immediately, then one every twenty seconds for the life of the connection — which
also holds the socket through the quiet spells when nobody's team is doing anything, and those are
most of the day.

Measured locally, against the real box:

```
 18ms upgrade 101
 20ms OPEN
 36ms PING from the studio      <- the studio speaks
120ms MSG#1 providerCapabilities <- the box speaks
```

84ms of silence closed. On Railway the same change closes about 400ms of it.

## Heights

Not applicable. This changes no screen. The desk draws the room when the office answers and the plate
when it does not (FB-193), and that is unchanged.

## The four tickets this took, and why

FB-163 recorded *"pixel-agents' own client will not hold a socket through the studio proxy"* and
treated it as a fault in the office. It was not. Getting from there to here needed:

- **FB-192** — the office is drawn, sized, and stripped of controls a founder cannot use, and the
  suite's real problem (a custom server silently running Next in development mode) fixed.
- **FB-193** — the desk stops drawing a room it cannot reach, so a broken socket costs a founder
  nothing.
- **FB-194** — the log names the side that ended the connection, instead of reporting a consequence
  as a cause.
- **FB-195** — this: the studio says something straight away.

Three of those four were about being able to see the fault. The fault itself was one line.
