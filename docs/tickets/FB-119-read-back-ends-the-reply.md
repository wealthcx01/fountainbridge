# FB-119 — The composer says it is waiting, then files in the same breath

**Status:** Todo · **Area:** Composer prompt · **Depends on:** —

## What happened

In the founder dogfood run of 2026-08-23 the composer wrote its read-back, ended it with

> **Before I file** — nothing — say the word.

and then, in the same reply, called the filing tool five times and reported five open pull requests.

The founder never said the word. The sentence offering them the choice and the action that removed it
were in one message.

## Why it happened, which is not "the model ignored the instruction"

Two things in `deploy/librechat/seed-agent.js` combined.

**The gate is stated as a property of the founder's message, not of the composer's reply.** Step 5
says "Wait for an explicit yes / go" and "Never file without an explicit yes". In the failing run the
founder's message *was* `file the whole set`. So an explicit yes existed, and the composer was not
disobeying — it was reading a yes given to a ticket that did not exist yet. **Consent given before
the draft existed is not consent to the draft**, and nothing in the prompt says so.

**Nothing covers a set.** Step 3 says "Draft exactly ONE ticket", so a founder asking for a research
ticket, three build tickets and a QA ticket is off the edge of the prompt. The composer improvised
well — the split and the dependency order were right — but it improvised the gate too, and the shape
it invented was one read-back covering five tickets, filed in the same turn.

## Why it matters more than it looks

The composer's whole claim is that a founder decides and nothing happens without them. Every other
part of that claim is real: the filing tool cannot merge, external actions gate on ActiveGraph, the
lane cannot grant its own approvals. This is the one place where the promise is made in prose by a
model, and a model that writes "say the word" and then acts has taught the founder that the sentence
is decoration. Once they learn that, the read-back stops being read.

It is also the exact failure step 5a was written to prevent one level up — "never write a line that
LOOKS like a tool call or a filing receipt". Same class: the words and the action disagree.

## Scope

- State the gate as a rule about the **reply**, not about the founder's message: a read-back ends the
  reply, and a reply that contains a read-back contains no filing.
- Say plainly that a "yes" given before the draft existed does not carry — read back and stop anyway.
- Cover a **set**. A founder asking for several pieces of work is a normal ask (it is what "split
  this so the work can run" means), and the prompt currently pretends it cannot happen. One read-back
  listing the set in order, then stop; one yes files all of them.
- Assert both in `lib/__tests__/method-drift.test.ts`, which already holds the prompt to what it must
  keep saying.

## Out of scope

- The ticket ids that run collided on — FB-117, shipped.
- The width they are rendered at — FB-118.
- Streaming tool *results* into the composer (FB-106's open criterion). Related in that the founder
  cannot see what the tools returned, but a separate piece of work.

## Acceptance criteria

- [ ] The prompt says a read-back ends the reply, in those terms.
- [ ] The prompt says a yes predating the draft does not count as approval of it.
- [ ] The prompt covers a multi-ticket ask: read back the set, stop, file all on one yes.
- [ ] `method-drift.test.ts` fails if any of the three is removed.
- [ ] Driven live on the ARCA box: a founder who says "file the whole set" up front still gets a
      read-back and a stop, and nothing is filed until they answer.
