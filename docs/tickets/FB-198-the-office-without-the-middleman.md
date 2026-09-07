# FB-198 — the office without the middleman

**Status:** Done · **Phase:** 3 · **Found by:** John, 2026-09-07

## The idea, and it was the founder's

Six tickets had gone into making the studio carry the office's live picture from a venture's machine
to a founder's browser, and FB-197 ended with the honest answer that it could not: Railway's edge
will not hold that connection. Measured at ~75ms to a cut, with the box disconnected, from two
continents.

John's question was the right one:

> we hait just an iframe or something or own api of the agents and ambed that to the site hosted on
> railway - is thay nor feasiblw?

Yes. Put the window on the venture's own box and let the browser look through it. Railway serves the
studio and is not in the live path at all, so there is nothing left to hang up.

And a piece of luck that makes it cheap: pixel-agents works out its own socket address from wherever
its page is served. Serve the page from the box and it connects to the box, unprompted, with no
change to their code.

## What that moves, and where it lands

Taking the studio out of the middle takes two things with it. Both are now on the box, in
`deploy/office/office-gate-lib.mjs`, which is where they are also tested.

**Who may watch.** The studio used to prove itself to the box with a shared header, and a browser
cannot send one. So the studio issues a **ticket** instead: signed, naming one venture, expiring
inside the hour. It is issued only to someone who has already passed `canAccessVenture`, so which
venture a person may watch is still decided by the studio and still decided server-side
(CLAUDE.md #6). The box only checks that the studio said so.

The ticket is signed with the venture's **own** office secret, never the studio's approval secret. A
venture box that was broken into must not be able to forge a grant (CLAUDE.md #4).

**Read-only.** pixel-agents accepts `closeAgent` from any connection and removes an agent. Read-only
was never a setting on the box, because there is no such setting — it has only ever been a filter,
and the filter used to run in the studio. It now runs in the gate.

This is the only lock. It is not one of two. So it was written as an allow-list of exactly one
message, and tested by trying to get past it.

## Trying to break it

Twenty-three unit tests against the gate's decisions, then the same attacks against the running gate
on ARCA's box — first over loopback, then from this laptop across the open internet.

| Attempt | Answer |
|---|---|
| No ticket | 401 |
| Rubbish ticket | 401 |
| Expired ticket, by one millisecond | 401 |
| Ticket signed with another venture's secret | 401 |
| Ticket naming another venture | 401 |
| Ticket with its expiry edited | 401 |
| A correct-length but wrong signature | 401 |
| `POST` with a perfect ticket | 405 — the office is a view |
| `/etc/passwd`, and four ways of spelling `..` | nothing; refused or normalised away |
| A good ticket | the room, 132 messages |

And the one that matters. With a good ticket, ten attempts to change the venture's machine —
including two `closeAgent`, an `installHooks`, a binary frame, and the handshake with things
smuggled alongside it:

> agents before **60** · after **60** — nothing changed.

**One test found a real hole before any of this reached a box.** The first version of the path check
allowed `/assets/a/../../b`, because a dot is a legal character in a filename and `..` is made of
legal characters. The test that tried it was written to break the gate, and it did.

## Two things the browser found that no test would have

**The frame policy.** The gate refused to be framed by the studio, and the only sign was a line in a
browser console. It is configuration now (`OFFICE_FRAME_ANCESTORS`), defaulting to `'none'` — a box
that has not been told who may frame it should refuse everyone rather than guess.

**The answer overwrote itself.** The desk's check said "unreachable" against a working office. The
office replied, the check closed its connection because the question had been answered, closing it
fired `onclose`, and `onclose` said unreachable. One `settled` guard. Only running it in a browser
showed it.

## What the studio loses, which is the best part

The custom server is gone. `server.js` existed for one reason — to carry this socket — and it is
deleted. So is the studio's office proxy, and so is `office-ready`. `npm start` is `next start`
again.

That takes with it every problem the custom server brought: the silent `NODE_ENV` that ran the whole
UI gate in development mode (FB-192), the upgrade handling, the ping, the ordering, all of it. Six
tickets of work on the studio's own plumbing, and the right answer was to have none.

## And the check moved to where the answer is

The desk asks whether there is an office to draw **from the browser**, by opening the socket and
waiting for the office to say something.

FB-193 asked from the studio. It answered `{"ready":true}` on a day when the office was unusable,
because it proved the studio could reach the box and said nothing about whether a founder could.
Only the browser knows the leg that matters. One real message is the bar — a handshake proves the
door opens, not that anything is behind it.

## Heights

Rendered against the real ARCA box at both sizes and looked at.

| Screen | Result |
|---|---|
| Desk, desktop 1440×1000, office reachable | 3,472px — the room, sixty agents |
| Desk, desktop 1440×1000, office unreachable | 3,342px — the drawn plate |
| Desk, phone 393×851 | 3,391px — the plate (FB-192: the room is wider than a phone at any height) |

Held for a minute: one socket, no drops, 265 messages.

## What a founder can now see, and what they cannot

They see their team at work, live, from their venture's own machine. They cannot change anything on
it — not a seat, not a setting, and not an agent. The address of the box is visible in the page, and
it is the same address they already use for the chat.
