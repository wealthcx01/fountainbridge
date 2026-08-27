# FB-145 — A ticket-id range in a commit subject is read as shipping both ends

**Status:** Done · **Area:** CI / ticket-drift · **Depends on:** —

## What happened

`main` went red the moment the desk-redesign planning PR merged. Its squash subject was:

> `The desk redesign: design bundle, two decision memos, and FB-124…FB-142 (#150)`

`ticketsShippedBy` matched **FB-124** and **FB-142** out of that range and marked both as shipped —
so `ticket-drift` demanded FB-142 be set to Done, for work that has not started.

## Why the existing rule did not catch it

The rule is sound and its own comment states the intent exactly:

> *"Returns nothing for a commit that shipped no code, whatever its message says: a ticket-filing
> commit naming five tickets is evidence about none of them."*

It implements that as `isShippingCommit`: a commit touching only `docs/tickets/` is a filing commit;
anything else did work. That planning commit also added `docs/design/` and two decision memos, so it
read as work — and then the range gave it two ids to attribute the work to.

Both halves of the miss are worth naming, because only one of them is a bug:

- **Touching `docs/` beyond `docs/tickets/` is not proof of work.** But narrowing that is dangerous:
  some tickets' deliverable genuinely *is* documentation (FB-072 is a runbook), and excluding all of
  `docs/` would swap a false positive for false negatives — the failure this check exists to prevent.
- **A range names a set nobody can enumerate from the string.** `FB-124…FB-142` is not a claim about
  FB-124 and FB-142; it is a claim about nineteen tickets, of which the message spells two. Reading
  the endpoints as "these two shipped" is reading punctuation as evidence.

The second is the bug, and fixing it needs no judgement about what documentation means.

## Scope

- Strip ticket-id **ranges** from a commit subject before matching. `FB-124…FB-142`, `FB-124...FB-142`
  and `FB-124 – FB-142` all name a set the string does not enumerate, so they are evidence about none
  of the ids in them, including the endpoints.
- A subject naming a single id, or several ids individually, is unchanged. That is the common case and
  the one the check exists for.

## Out of scope

- Changing what counts as a shipping commit. The `docs/tickets/`-only rule stays; narrowing it further
  would trade this false positive for false negatives, which is the worse direction for a check whose
  whole job is catching a ticket that lies about itself.
- The commit convention. Writing "FB-124…FB-142" in a subject is reasonable English and the checker
  should cope, rather than the writing bending around the checker.

## Validation gates

```bash
npx vitest run lib/__tests__/ticket-drift.test.ts
make ticket-drift        # must pass on main, which it does not today
npm run lint && npm run typecheck && npx vitest run
```

## Acceptance criteria

- [x] The real subject that broke `main` — `The desk redesign: design bundle, two decision memos, and
      FB-124…FB-142 (#150)` — yields no shipped ids, asserted by a test using that exact string.
- [x] Every form is handled: `...`, `..`, `…`, `–`, `—`, and the word `to`.
- [x] A subject naming one id still marks that id shipped; a subject naming two ids individually
      still marks both. Asserted, so the fix cannot quietly disable the check.
- [x] `make ticket-drift` passes on `main`.
