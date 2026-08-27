# FB-140 — The memory write path (gap G9)

**Status:** Todo · **Area:** Studio + venture repo · **Depends on:** FB-133
**Design:** `docs/design/foundry-desk/` — screen 7, the "Add" control and the "Last used" column.
**Gap:** G9.

## Why this matters (for the founder)

Day one asks the founder to hand over what they already have: *"research, notes, a deck, exports from
other conversations. Hand it over, and it becomes what Arca knows."*

Today that is not true. The composer reads a document for one message and forgets it (FB-078). A
founder who uploads their PRD, closes the tab and comes back finds the venture knows nothing about it —
which makes the first promise the studio makes to a founder the first one it breaks.

## What is true today

FB-078 reads a document per message, in memory. D8 defines `context/` and `library/` in the venture
repo, with heavy binaries in object storage and pointers in git. gbrain indexes git. `lib/knowledge.ts`
reads what is there.

## Scope

- **A persistent upload path into the venture repo**, per D8: text and light documents into
  `library/`, heavy binaries to object storage with a pointer committed.
- **gbrain indexing on write**, so a document is findable by the agents that plan from it — which is
  the entire point of handing it over.
- **Usage citations surfaced back.** The "Last used" column becomes real: a document says when the
  composer last read it. A citation that cannot be established shows nothing rather than a guess.
- **Secrets are refused, in words.** The deposit tool already rejects them; the same rule applies here
  and the refusal explains itself (CLAUDE.md #8).
- **Venture isolation** (CLAUDE.md #6): a document lands in its own venture's repo, server-side enforced.

## Out of scope

- Editing or deleting a document.
- OCR, parsing or summarising on upload. It is stored and indexed; the composer reads it.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make ticket-drift
```

On the ARCA box before review:

```
# upload a PRD → it lands in the venture repo, gbrain finds it, the composer cites it in a draft
# upload something containing a credential → refused, with a reason
```

## Acceptance criteria

- [ ] A document uploaded from Memory persists in the venture repo per D8.
- [ ] gbrain indexes it on write, and the composer can cite it in a later session.
- [ ] "Last used" reflects a real read, or shows nothing.
- [ ] A document containing a secret is refused with an explanation, not silently stripped.
- [ ] A document can never land in another venture's repo, asserted by a test.
- [ ] Proven end to end on the ARCA box — upload, index, cite — before the PR is opened.
