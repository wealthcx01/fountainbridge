# FB-197 — the studio was in Singapore

**Status:** Done · **Phase:** 3 · **Found by:** FB-196 being refused by Railway, 2026-09-05

## The answer

The studio's container was running in **Singapore**. ARCA's box is in Nuremberg.

Every connection the studio opened to the venture machine went most of the way round the world and
back. Measured through `/venture/arca/office-ready`, which opens the office socket, asks it for the
room and waits for the answer:

| | Round trip to the box |
|---|---|
| Container in Singapore | **832ms** |
| Container in eu-west (Amsterdam) | **84ms** |

Railway's edge cuts a WebSocket that has carried no traffic at about **375ms**. The studio could not
answer the browser inside that window because it was still waiting on Nuremberg. Nothing about the
office, the proxy, the box or `ws` was ever wrong. The container was in the wrong hemisphere.

`railway service scale --service foundry-studio southeast-asia=0 eu-west=1` is the whole fix.

It was not only the office. The studio's database is a Supabase pooler in **eu-west-1, Ireland**
(FB-170), so every query was crossing two oceans as well, and the founder is in Edinburgh:

| | Before | After |
|---|---|---|
| `/api/health`, warm | 181ms | **32ms** |
| `/venture/arca/office-ready` | 832ms | **84ms** |

## And the order goes back

FB-196 changed the order: dial the box, collect the office's opening burst, then answer the browser's
upgrade. Railway refused it, and once the log could speak it said so plainly — *"the box closed it
before the office answered"*, and *"WebSocket was closed before the connection was established"*,
which is what happens when the browser's raw socket is taken away while the box is still being
dialled.

**An upgrade has to be answered promptly or not at all.** The edge will not hold a raw socket while
the origin thinks about it. FB-163's first note said this and was disbelieved because everything else
in that note turned out to be wrong.

So the order is back: answer the upgrade at once, dial the box behind it. Two things keep the gap
that leaves as small as it can be, and both are kept from the tickets that found them:

- **A ping, straight away** (FB-195), so the connection carries traffic from its first moment, then
  one every twenty seconds — which also holds the socket through the quiet spells, and a venture
  office is still most of the time.
- **The studio asks for the room itself** (FB-196), rather than waiting for the browser's
  `webviewReady` to cross the distance twice. The burst is on its way while the browser's own
  handshake is still in flight.

With the container in Amsterdam that gap is about 52ms against a 375ms budget.

## What this run cost, and what it was

Six tickets from *"pixel-agents' own client will not hold a socket through the studio proxy"*:

| | |
|---|---|
| FB-192 | Draw the office properly — and the suite's real problem: a custom server silently running Next in **development** mode |
| FB-193 | Stop drawing a room that cannot be reached |
| FB-194 | Name the side that ended the connection, instead of reporting a consequence as a cause |
| FB-195 | Say something on the socket at once |
| FB-196 | Ask the box for the room ourselves — and learn that the upgrade must be answered first |
| FB-197 | The container was in Singapore |

Five of the six were about being able to see. The fault was a region setting nobody had looked at,
and it had been slowing down every screen in the studio, for every founder, the whole time.

## The one that would have found it sooner

`/venture/<id>/office-ready` (FB-193) answered `{"ready":true}` on production while the office was
unusable, because it proves the studio can reach the box and says nothing about whether the browser
can reach the studio. It was 832ms doing it. **A readiness check that takes 832ms to say yes is
telling you something even when it says yes**, and nobody read it that way for two tickets.

## Heights

Not applicable. No screen changes here.
