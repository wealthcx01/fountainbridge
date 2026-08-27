# FB-131 — The composer rails: draft, plan, revision

**Status:** Todo · **Area:** Composer · **Depends on:** FB-126, FB-127
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

- [ ] The rail renders exactly one of the five states, and never two.
- [ ] Every line in the draft is traceable to something said in the thread.
- [ ] Nothing files without one explicit press, in every state, asserted by a test.
- [ ] The FB-119 two shapes still hold: a reply that asks does not file; a pre-approving founder is
      obeyed without being asked again.
- [ ] Visible actions appear in the thread as the design shows them.
- [ ] Driven on the ARCA box across all three paths before the PR is opened.
