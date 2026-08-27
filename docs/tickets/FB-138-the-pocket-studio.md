# FB-138 — The pocket studio

**Status:** Todo · **Area:** Studio / mobile · **Depends on:** FB-128, FB-129
**Design:** `docs/design/foundry-desk/` — screen 11; `screens/11-Pocket_studio.txt`.

## Why this matters (for the founder)

A founder is the blocker on three things and is not at a desk. The pocket studio is the studio that
fits in the hand: *"The same events, one column: the blocker banner, the live office, the queue, the
prompt. A founder keeps this open all day."*

The line that matters most: **"Decisions work exactly as on the desk: read it, one press, grant
signed."** Not a cut-down view — the same authority, on a phone. A founder who can only *read* on
mobile is a founder who stays the bottleneck until they get home.

## What is true today

FB-009 made the studio usable at 390×844. That is a responsive pass, not this: there is no one-column
composition, no mobile-shaped decision flow, and no notification of any kind.

## Scope

- One column at phone widths: blocker chip → live office plate → queue with "Decide →" per row → prompt bar.
- **Deciding works.** Approve and refuse, with the same signed grant and the same required note.
  Same actions, same gate, laid out for a thumb.
- Filing and discussion open the same composer.
- A persistent way back to the full desk.
- The office plate is the FB-124 placeholder until FB-139.

## Out of scope

- The PWA shell and push — FB-141 (G8). This is the layout and the parity; that is the pocket becoming
  an app.
- A native app. There isn't one and this ticket does not start one.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx playwright test    # the UI gate, at phone viewport
make design-lint && make ticket-drift
```

On a real phone viewport, on production, before review:

```
# 390×844 and 430×932: approve one item and refuse one item, end to end
```

## Acceptance criteria

- [ ] One column at phone widths, in the design's order, with no horizontal scroll.
- [ ] A founder can approve and refuse from a phone, through the same signed path as the desk.
- [ ] Refusing still requires a note.
- [ ] The prompt bar opens the same composer.
- [ ] There is always a way back to the full desk.
- [ ] Driven on a real phone viewport on production — one approval and one refusal — before the PR.
