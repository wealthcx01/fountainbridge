# FB-153 — A long link in a ticket pushes the page sideways

**Status:** Done · **Area:** Studio / design system · **Depends on:** FB-129

## What happens

On a 393px phone, `/venture/arca/tickets?filter=needs` scrolls horizontally. Measured on production
with ARCA's real backlog:

```
clientWidth 393 · scrollWidth 471
guilty: <a> width 377px — "https://developer.ebay.com/develop/api/buy/browse_…"
```

One link, written into a ticket by the founder's own team, 377px wide in a 393px window.

`.ticket-body` is the class every rendered ticket carries — the tickets screen, the work view, the
drawer, and memory, five surfaces — and **it has no CSS rule behind it at all.** No wrapping, no
scroll container on code blocks, no cap on images. It has been a bare class name since it was first
written.

## Why nothing caught it

The e2e fixtures contain no long links, no wide tables and no images. Every automatic check passed —
including the mobile e2e, which asserts no horizontal overflow on the exact screen this was found on.
The fixture simply had nothing in it that could overflow.

That is the third time this pattern has cost something: green because nothing was looking at the
thing that was broken. Here the check WAS looking, and the data it looked at could not fail.

## Scope

- Give `.ticket-body` the rule it never had: break long tokens, scroll a code block or a wide table
  inside its own box, cap an image.
- Put a long URL in the ticket fixture, so the mobile check has something that can actually fail.

## Out of scope

- Any other change to how a ticket reads. This is the difference between wrapping and not wrapping.

## Acceptance criteria

- [x] A ticket citing a long URL does not push the page sideways at 393px.
- [x] A fixture ticket contains a link long enough to overflow, so the existing mobile assertion is
      no longer passing on data that cannot fail.
- [x] Verified on production with ARCA's real backlog, not only against the fixture.
