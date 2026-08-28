# FB-147 — An id that does not parse as a number is not a non-collision

**Status:** Done · **Area:** Composer / ticket-filer · **Depends on:** FB-118

## What happens

FB-118 made `mustRenumber` compare collisions by **parsed number** rather than by the id as written,
so `ARCA-74` and `ARCA-074` would be recognised as one number in two spellings. That part is right.

What it did not keep is the behaviour for ids that are not a prefix and digits. `idNumber` requires
`\d+` followed by a hyphen, a dot, or the end of the name, so:

- `ARCA-68a` — a lettered sub-ticket — parses as nothing.
- `ARCA-NEW` — the unnumbered placeholder — parses as nothing.

Both then match no filename at all, `sharing` is empty, and the function returns "the id is yours to
keep" for a genuine clash. Verified against `main`: `mustRenumber('ARCA-68a', 'zzz',
['ARCA-68a-aaa.md'])` returned `'arca-68a-aaa.md'` before FB-118 and `null` after it.

Both shapes are ones this codebase still recognises elsewhere — `withTicketId` and `idOf` both match
`\d+[a-z]?`, and `isUnnumbered` exists precisely to spot `-NEW` — so this is not a narrowing, it is
collision detection switched off for two live shapes.

Found by the `/review` pass on PR #161.

## Scope

- Compare by number only when the id is a prefix and digits. Anything else keeps the string-prefix
  comparison it had before FB-118.
- Do not widen it in the other direction: `ARCA-68a` and `ARCA-68` did not collide before and must
  not start, or the filer would renumber tickets that never clashed.

## Acceptance criteria

- [ ] `mustRenumber('ARCA-68a', 'zzz', ['ARCA-68a-aaa.md'])` reports the clash.
- [ ] `mustRenumber('ARCA-NEW', 'zzz', ['ARCA-NEW-aaa.md'])` reports the clash.
- [ ] `ARCA-68` and `ARCA-68a` are still two different tickets.
- [ ] `ARCA-74` and `ARCA-074` are still one, which is what FB-118 added.
