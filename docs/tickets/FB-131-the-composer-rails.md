# FB-131 — The composer rails: draft, plan, revision

**Status:** Done · **Area:** Composer · **Depends on:** FB-126, FB-127
**Design:** `docs/design/foundry-desk/` — screen 5; `screens/06-Composer.txt` for every state.

## Why this matters (for the founder)

The composer today is a conversation with a filing tool at the end. The design gives it a right-hand
rail that shows **the thing being made, while it is being made** — so a founder can see the ticket
taking shape from their own words and press once, rather than reading a wall of markdown and hoping.

Its promise is in the copy: *"Every line came from the conversation. Press File this and it lands in
Tickets as Waiting to be picked up."* And under the button: *"Nothing is built until you press it."*

## What is true today

`lib/composer.ts` streams. FB-105 seeds `?about=`. FB-065 keeps transcripts local. The filer is the
one gated write path. FB-119 settled the gate's two shapes: a reply that asks does not file, and a
founder who has already said go is obeyed without being asked again.

Open and unticketed: the composer streams tool *calls* but not tool *results* — FB-106's open
criterion. A founder sees "Used 2 tools" and not what came back. This screen shows visible actions
("Read the PRD from memory: 9 sections"), so that gap becomes visible here.

## Scope

Two panes. Thread left, and a right rail in exactly one of five states:

1. **The ticket, taking shape** — Why / Scope / Done when / Approval, every line from the conversation.
2. **The plan, taking shape** — a PRD decomposed into N tickets in dependency order, Strike/Keep per
   line, "File all N" (FB-127).
3. **The ticket under discussion** — when opened from a ticket via `?about=`; files a revision (FB-126).
4. **Nothing on the table** — *"As you talk, the ticket takes shape here: every line from the
   conversation, nothing added beyond it."*
5. **After you pressed it** — what was filed, what happens next, what happens later, and a link to it.

Plus: visible actions in the thread, "Add a document", "Start again", and the FB-119 gate unchanged.

## Out of scope

- Thread persistence (FB-126) and plan objects (FB-127) — this renders them.
- Streaming tool results (FB-106). Named here because this screen makes it visible; it is not fixed here.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run lib/__tests__/composer.test.ts
make design-lint && make ticket-drift
```

On the ARCA box before review — the FB-119 rule applies to anything touching the composer:

```
# 1. a plain ask  → the ticket rail fills; nothing files until the press
# 2. "file it, no questions" → "Filing now, as you asked"; no false gate
# 3. opened from a ticket → the revision rail, and the filed revision lands on that ticket's branch
```

## Acceptance criteria

- [x] The rail renders exactly one of the five states, and never two.
- [x] Every line in the draft is traceable to something said in the thread.
- [x] Nothing files without one explicit press, in every state, asserted by a test.
- [x] The FB-119 two shapes still hold: a reply that asks does not file; a pre-approving founder is
      obeyed without being asked again. — *untouched: the gate is the composer's prompt and the
      filer, and this ticket changed neither.*
- [x] Visible actions appear in the thread as the design shows them.
- [ ] Driven on the ARCA box across all three paths. — *blocked on the venture token (FB-072).
      The same criterion FB-127 is waiting on, and for the same reason.*


## What shipped, and what is honest about it

**Five states, decided once.** `railState` returns a discriminated union and the component renders
what it is given, so "what am I about to press" is answered in one place.

The precedence deviates from the design's tree twice, and the second one was a bug first. **What was
just filed wins over everything**, so a founder who files a revision is told so. And **a draft or a
plan beats the ticket-under-discussion**, because the first version returned `discussing` for the
life of the page and that state renders no press — the whole FB-105 revision flow (drawer → "Ask for
changes to this" → converse → draft) ended with no button anywhere. The design's tree is about what
to show; it was never about where the press lives.

**"After you pressed it" is set from evidence.** Both halves are required: the founder pressed, and
the filer actually ran. Either alone is wrong — a reply that calls the filer without a press is the
FB-119 failure, and a press whose reply shows no filing action is the FB-062 one, where the composer
told a founder it had filed something it had not.

**The press moved out of the thread and into the rail**, beside the draft it is about — so the
question is answered by what a founder is looking at rather than by a button under a wall of
markdown. `composer-decision` and `composer-file-this` are gone; the assertions moved with them.

**The plan state wraps FB-127's own panel** rather than re-implementing it. Two "file" buttons that
behaved differently would be worse than one that is slightly out of place.

**The fixture was enriched, because the test could not have failed.** The streamed ticket had only a
Scope heading, so a rail rendering three of four parts would have passed. It carries Why, Scope and
acceptance criteria now — the FB-153 lesson, applied before it cost anything rather than after.

**Not fixed here, and now more visible:** the composer streams tool *calls* and not tool *results*
(FB-106). The design shows "Read the PRD from memory: 9 sections"; the studio shows "Looking through
what your venture knows" and never what came back. Named in this ticket's own scope as out of scope,
and it is the next thing a founder will notice about this screen.
