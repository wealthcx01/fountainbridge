# FB-194 — say which side ended the office socket

**Status:** Done · **Phase:** 3 · **Found by:** FB-193's open question, 2026-09-05

## The question this answers

FB-193 made the desk honest: if the office cannot be reached, a founder gets the drawn plate instead
of a frame that says "Loading…" for ever. It left the cause open, on purpose, rather than guessing.

What was known:

- **The box is fine.** A plain client from a laptop connects in 42ms, sends `webviewReady`, and gets
  the whole office back — twenty agents, every sprite sheet — and holds for as long as it is asked to.
- **The studio's own connection to the box is fine, from Railway.** `/venture/arca/office-ready`,
  running inside the production container, answers `{"ready":true}`.
- **The browser's socket dies in about five milliseconds**, with close code 1006 — an abnormal close
  with no close frame, which is not what the studio's own shutdown would produce.
- **Nothing crashes.** Three connections in one window produced no restart and no uncaught exception.

So the studio can reach the box, and the browser cannot reach the studio, from the same container, at
the same moment.

## Why the log could not say more

`shut()` was called from four places and said nothing about which one:

```js
client.on('close', shut);
client.on('error', shut);
upstream.on('close', shut);
upstream.on('error', (err) => { console.error(…); shut(); });
```

So the only line in the production log was:

```
[office] could not reach the venture office { venture: 'arca',
  message: 'WebSocket was closed before the connection was established' }
```

That message is the **consequence** of shutting down while the box connection is still being made.
It names no cause. It sent the whole of FB-163 down the wrong road — it reads like the box being
unreachable, and the box was never unreachable.

## What it says now

One line, once, naming the side, the age of the connection and the state of both ends:

```
[office] the office socket ended {
  venture: 'arca',
  endedBy: 'the browser closed it (1006)',
  afterMs: 14995,
  browser: 3,
  box: 1
}
```

`endedBy` is a sentence, not a code: *the browser closed it*, *the browser's socket errored*, *the box
closed it*, *the box could not be reached* — each carrying whatever the underlying event knew.
`afterMs` separates "never got going" from "ran for a while and stopped", which no status code does.

That is the difference between "something closes it" and a sentence someone can act on.

## What this does not do

It does not fix the production socket. It makes the next step one request instead of a guess, and it
stops the studio reporting a consequence as if it were a cause.

## Heights

Not applicable. This changes no screen — the desk already draws the plate whenever the office cannot
be reached (FB-193), and it does that on production today.

## Found on the way, not fixed here

`e2e/tickets-view.spec.ts:38` fails about one run in five, on unchanged code: it clicks a ticket and
the URL never gains the `t=` parameter. It is the same family as FB-191 — a page that is
server-rendered and then hydrated, and a test that acts on it before React has attached its handlers.
Filed separately rather than folded in.
