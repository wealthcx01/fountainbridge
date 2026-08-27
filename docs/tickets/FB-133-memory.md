# FB-133 — Memory: what the venture knows

**Status:** Todo · **Area:** Studio / knowledge · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 7; `screens/08-Memory.txt`.

## Why this matters (for the founder)

The composer reads what the venture knows before it drafts anything. A founder has no way to see what
that is, or to add to it. This screen is both: *"Everything you have handed over or your team has
learned. The composer reads all of it before it drafts anything."*

And the empty state is an invitation rather than a shrug: *"Nothing yet. Hand over what you already
have: research, notes, a deck. It becomes what Arca knows, and every ticket will cite it."*

## What is true today

`lib/knowledge.ts` reads the venture's knowledge; `lib/routines.ts` and `components/RoutinesView.tsx`
carry the routines (FB-047). The composer reads a document per message and forgets it (FB-078). D8
defines `context/` and `library/` in the venture repo.

## Scope

- Summary sentence, then a documents table: **Document / From / Added / Last used**.
- An "Add" control. **In this ticket it is honest, not functional** — the persistent write path is
  FB-140 (G9). It says what it will do and does not pretend; a dead button is forbidden by the design
  contract, so it either works or it says why not yet.
- "What happens without you asking" — the routines, with tone dots, from FB-047.
- "Last used" is a real citation or it is absent. An invented number here would undermine the one
  screen whose job is to say what the machine actually read.

## Out of scope

- The upload path, object storage and gbrain indexing on write — FB-140.
- Editing or deleting a document.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift   # design-lint fails on dead UI, which is the point here
```

## Acceptance criteria

- [ ] The documents table renders the four columns, and the routines render with tone dots.
- [ ] The empty state is the design's invitation, not a blank panel.
- [ ] "Last used" shows a real citation or nothing at all — never a placeholder number.
- [ ] The Add control either works or states plainly that the write path is not built yet. `make
      design-lint` passes, which means no dead control shipped.
