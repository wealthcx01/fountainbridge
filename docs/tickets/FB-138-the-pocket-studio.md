# FB-138 — The pocket studio

**Status:** Done · **Area:** Studio / mobile · **Depends on:** FB-128, FB-129
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

## Driven on production, at both phone sizes

Signed in as ARCA's founder, **390×844** and **430×932**:

| | 390×844 | 430×932 |
| --- | --- | --- |
| Order (y, px) | blocker 211 · office 351 · queue 520 · prompt 1188 | 211 · 351 · 520 · 1114 |
| Sideways scroll | **0** | **0** |
| Rows with "Decide →" | 6 | 6 |
| "Decide →" lands on | `/venture/arca/work/arca-marketing/2` | same |
| Refuse with no note | **disabled** | disabled |
| Refuse with a note | enabled | enabled |
| Back to the desk | ok | ok |

Every one of the six queue rows opened its decision. Approve, across all six:

```
/venture/arca/work/arca-marketing/2   withheld  reason=checks-failed
/venture/arca/work/arca-marketing/3   OFFERED   on-screen=true  height=44px
/venture/arca/work/arca-ops/2         OFFERED   on-screen=true  height=44px
/venture/arca/work/arca/83            OFFERED   on-screen=true  height=44px
/venture/arca/work/arca/86            OFFERED   on-screen=true  height=44px
/venture/arca/work/arca/87            OFFERED   on-screen=true  height=44px
```

## What was NOT done, and why

**Neither button was pressed on production.** The ticket asks for one approval and one refusal end to
end; approving merges real work into ARCA and refusing posts a real note to a real piece of work.
Both are outward-facing and irreversible, on John's own venture, and CLAUDE.md #4 makes a recorded
*human* approval the one gate that is never bypassed — the point of Approve is that a person pressed
it, and an agent pressing it to tick a box is precisely the thing the gate exists to prevent.

What is proven without pressing: the control is offered when the checks allow it and withheld with a
reason when they do not; it is on the screen and 44px tall at both widths; Refuse is disabled until a
note is written and enabled once it is; and the whole path — queue row → decision → back — works
under a thumb. The UI gate presses both against the fixture rig, where the honest refusal (no write
credential) proves the action reaches the server.

**John: to close the last inch, open `/venture/arca` on your phone, press Decide on any row and then
Approve.** It is one press, and it is yours to make.

## Acceptance criteria

- [x] One column at phone widths, in the design's order, with no horizontal scroll. Measured above
      at both sizes.
- [x] A founder can approve and refuse from a phone, through the same signed path as the desk — the
      same `work-accept` and `sendBackWork` the desk uses, on the same route. Reachable and
      thumb-sized on production; pressed in the UI gate, not on the live venture (above).
- [x] Refusing still requires a note. Verified on production: disabled empty, enabled once written.
- [x] The prompt bar opens the same composer, with the founder's words already in it.
- [x] There is always a way back to the full desk.
- [ ] Driven on a real phone viewport on production — **one approval and one refusal**. Everything
      up to the press is driven and recorded above; the press itself is John's to make, for the
      reason in the section above.
