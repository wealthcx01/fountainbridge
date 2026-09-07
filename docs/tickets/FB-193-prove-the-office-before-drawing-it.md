# FB-193 — prove the office before drawing it, and say why when it cannot be drawn

**Status:** Done · **Phase:** 3 · **Found by:** switching FB-192 on in production, 2026-09-05

## What happened

FB-192 turned the office on for ARCA. On production, a founder got this:

> **THE OFFICE — LIVE FROM YOUR VENTURE'S OWN MACHINE**
>
> *(an empty box, saying "Loading…", for ever)*

That is strictly worse than the drawn plate it replaced. The plate says what is happening in words.
The empty box says nothing and looks broken.

Measured on production: **88 sockets opened and 88 closed in 75 seconds, carrying 0 messages.** A
plain client reproduced it exactly — handshake accepted (`101`), open, closed 5ms later with code
1006, nothing received. The studio's log said:

```
[office] could not reach the venture office {
  venture: 'arca',
  message: 'WebSocket was closed before the connection was established'
}
```

The office was switched off again within the hour, and production went back to the plate at 2,395px.

## The part that matters more than the cause

**Every automated check was green, and the check the studio itself was running said the office was
fine.**

The desk decided whether to draw the office by asking the box for one HTTP file — `/office/api/health`.
That file was served, correctly, by a box whose socket was dying five milliseconds after every
handshake. So the studio asked a question it could answer and drew a room that could never load.

A view is only worth drawing if the thing it views can be reached. So the studio now makes the
connection itself, from the same place the browser's frame is proxied from, and waits for the office
to actually say something. `probeOfficeSocket` is that question, `/venture/<id>/office-ready` is where
it is asked, and the plate is the answer whenever it comes back false.

One real message is the bar. A handshake proves the door opens, not that anything is behind it — and
this whole ticket exists because a door that opened onto nothing was counted as an office.

## The probe was wrong first, and the fix is the interesting part

Written the obvious way, the probe opened a socket and listened. Against the **real, healthy** box it
timed out every time, and the desk drew the plate on an office that was working perfectly.

The office waits to be asked. It says nothing at all until `webviewReady` arrives, and then sends
everything at once. That is in the measurements taken earlier in FB-192 and I wrote the comment
backwards anyway:

```
45ms sent webviewReady
47ms MSG {"type":"providerCapabilities", …}
```

So the probe sends `webviewReady` and then waits. That is also the only message the studio ever
forwards from a browser (`OFFICE_ALLOWED_CLIENT_MESSAGES`), so the probe says exactly what a frame
would say and nothing a frame could not.

Two lessons, and the second is the one worth keeping:

- A listener is not a probe if the thing being probed only speaks when spoken to.
- The evidence was already in hand. It was read wrongly, and only running it against the real box
  found that.

## What a founder sees now

| | |
|---|---|
| The office is reachable and answers | the room |
| The box is up but the socket does not hold | **the drawn plate** |
| The venture has no box | the drawn plate |
| On a phone | the drawn plate (FB-192) |

The reason is logged and never shown. A founder does not need to read `Unexpected server response:
403`; the studio's log does.

## Heights

| Screen | Result |
|---|---|
| Desk, desktop 1440×1000, office reachable | 3,472px (the room) |
| Desk, desktop 1440×1000, office unreachable | 3,342px (the plate) |
| Desk, phone 393×851 | 3,371px (the plate) |
| Production while the office was wrongly on | an empty box, "Loading…", for ever |
| Production now | 2,395px, the plate |

## Still open: why the socket fails from Railway and not from anywhere else

Not fixed here, and not guessed at either. What is known:

- **The box is not at fault.** A plain client from a laptop connects in 42ms, sends `webviewReady`,
  and gets the whole office back in 5ms — twenty agents, every sprite sheet — and holds for as long
  as it is asked to.
- **The studio's proxy is not at fault.** The same client through `server.js` running locally gets
  the same 52 messages and holds.
- **From Railway it dies in 5ms**, with close code 1006 — an abnormal close with no close frame,
  which is not what the studio's own `shut()` would produce. Something outside the studio's code is
  ending it.

The next step is the one this ticket makes cheap: `/venture/<id>/office-ready` runs the studio's own
outbound connection and logs exactly what it hits. One request against production, with the office
variables set for a few minutes, turns "something closes it" into a sentence. That is FB-194.

Until then ARCA's office is off in production and the desk is honest about it, which is the state
this ticket was written to guarantee.
