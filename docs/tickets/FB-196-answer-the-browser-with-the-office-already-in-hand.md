# FB-196 — answer the browser with the office already in hand

**Status:** Done · **Phase:** 3 · **Found by:** FB-195 not being enough, 2026-09-05

## Where this starts

FB-195 said the studio was silent on a freshly upgraded socket while it dialled the box, and that
the silence was what Railway's edge was killing. It sent a ping immediately to fill the gap.

The ping was not enough. On production, with the change deployed:

```
[office] the office socket ended {
  venture: 'arca', endedBy: 'the browser closed it (1006)', afterMs: 378, browser: 3, box: 0
}
```

Better than 239ms and still dead. So three more things were measured.

**The ping arrives.** The client sees it 4ms after the socket opens, and the connection is cut 3ms
after that. Railway relays frames perfectly well.

**It is not the box.** `OFFICE_HOST_ARCA` was pointed at an unroutable address so the box connection
would hang for its full ten seconds. The browser's socket still died at 77ms. Nothing about the
close depends on the box.

**It is not this machine.** The same test run from the ARCA box in Nuremberg gets the same close, so
it is not one network or one client.

And the close is not really the browser's, though `endedBy` says so. The arithmetic gives it away: the
studio saw the connection end 378ms after it wrote the `101`, and the client received that `101` about
375ms after it was written. A close the client sent would have taken another 375ms to come back. Both
ends were cut at the same moment by something in the middle.

There is a report on Railway's own forum of this exact shape — *"WebSocket handshake succeeds but the
proxy closes the connection with code 1006 after ~72ms consistently"* — on a Node custom server
wrapping Next with `ws` and `noServer: true`, which is this file exactly. It is unresolved there.

## What changed

The order. The box first, the browser second, and the office already in hand when the browser is
answered.

The studio dials the box, **sends the handshake itself** rather than waiting to be handed one, and
collects the opening burst — the office says nothing at all until it is asked, and then sends its
whole room in one go, about 52 messages. Only then is the browser's upgrade answered, and the burst
goes out immediately behind the `101`.

There is no silent period left to kill.

Measured locally against the real box:

| | Before | After |
|---|---|---|
| First message after the browser's socket opens | 85ms | **3ms** |

## Two things that fall out of it for free

**A box that cannot be reached now answers with a plain `502`.** Before, the browser got a socket that
opened and then died, which is the hardest kind of failure to read. Now the upgrade is simply refused,
and the desk was already drawing the plate in that case anyway (FB-193).

**A reconnect still works.** The browser's own `webviewReady` is forwarded when it arrives, the box
answers it again, and the second burst costs nothing anyone can feel.

## What had to be added with it

A box that accepts the connection and then says nothing would leave the browser waiting on an upgrade
that never comes — `handshakeTimeout` covers the handshake and not the silence after it, so the
silence has its own ten-second limit. And a browser that walks away while the box is being dialled
now closes the studio's connection to the venture machine behind it, rather than leaving one open for
nobody.

## Heights

Not applicable. No screen changes. The desk draws the room when the office answers and the plate when
it does not (FB-193), unchanged.

## The honest state of it

This is the change that removes the last silent window there is to remove. Whether Railway's edge is
satisfied by that is a question production answers, not a laptop — every one of the five tickets in
this run has turned on a difference between the two.

If it is still cut, the fault is not in anything the studio does with the connection, and the next
move is not more code: it is either Railway's own TCP proxy, which bypasses the HTTP edge, or moving
the office socket off Railway. Both are bigger than a ticket and neither should be started on a
guess.
