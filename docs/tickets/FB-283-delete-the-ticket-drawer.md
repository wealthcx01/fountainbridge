# FB-283 — Delete the unused ticket drawer

**Status:** Todo · **Kind:** small · **Budget:** none yet (John, 28 October 2026) · **Phase:** 3 · **Raised by:** John, 28 October 2026 (found while building FB-273) · One ticket = one branch = one PR.

## Why

`components/TicketDrawer.tsx` is not shown anywhere. FB-178 (#212) took it off the desk, and nothing
has drawn it since: no page or component imports it.

FB-273 still had to move its Accept and Send back into the shared `components/Decision.tsx`,
because its ticket asked for all three copies. So the shared component now carries a third look,
`'drawer'`, that no screen uses. Code nobody runs still has to be read, kept in step with the
screens that are used, and checked by every later change to Accept and Send back.

## What to do

- Delete `components/TicketDrawer.tsx`.
- Remove the `'drawer'` look from `components/Decision.tsx`: its branch, its words and its test ids
  (`drawer-accept`, `drawer-sendback-open`, `drawer-note`, `drawer-sendback`, `drawer-msg`).
- Remove any style, helper or test that only the drawer used. Check each one first: other things in
  the studio are also called "drawer" (the composer's rail, for one), and they stay.
- Update the comments that name the drawer, starting with the one at the top of `Decision.tsx`.

## Done when

- [ ] Nothing in `app/`, `components/` or `lib/` names `TicketDrawer` or the `'drawer'` look.
- [ ] The work page and the Tickets screen look the same before and after, at 1440×1000 and 393×851,
      with each page's height recorded.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

Any change to what the work page or the Tickets screen show or say.
