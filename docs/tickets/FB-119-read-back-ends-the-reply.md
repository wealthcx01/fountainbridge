# FB-119 — The composer says it is waiting, then files in the same breath

**Status:** Done · **Area:** Composer prompt · **Depends on:** —

Took two PRs, because the first one was wrong in a way only the box could show. #140 added the rule
and left the template that broke it — the composer still wrote "nothing — say the word" and filed in
the same reply, on ARCA, with the new rule three steps below. The second attempt is below under
"What the box taught that CI could not".

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

- [x] The prompt says a read-back ends the reply, in those terms.
- [x] The prompt says a yes predating the draft does not count as approval of it.
- [x] The prompt covers a multi-ticket ask: read back the set, stop, file all on one yes.
- [x] `method-drift.test.ts` fails if any of the three is removed.
- [x] A reply that asks "shall I file it?" never files in that same reply.
- [x] A founder who has said "file it, no questions" gets "Filing now, as you asked" and the work —
      not a question the composer then answers for them.
- [x] Both driven live on the ARCA box before shipping.

**The last criterion changed while this was open, and the original was wrong.** It read: *"a founder
who says 'file the whole set' up front still gets a read-back and a stop"*. That is not the right
behaviour and asking for it is what produced the second failed attempt — a founder who pre-approves is
entitled to be obeyed. What they are not entitled to is a reply that pretends to ask them again.

## What the box taught that CI could not

The first attempt (#140) added the rule at step 5 and left step 4's template telling the composer to
write `"nothing — say the word"`. Every test passed. On the box it filed anyway.

**The shape a model is told to output beats a rule it is told to follow.** The template is what it is
writing; the rule was three steps away and lost. So the phrase had to go rather than be argued with.

That was not enough either. With the phrase replaced by `"Nothing — shall I file it?"`, a founder who
said *"I approve in advance, no more questions please"* got the question — and the filing, in the same
reply. And on reading it back, the composer was not disobeying. It was obeying, out loud, while
reading a sentence that said otherwise.

Which moved the defect. **The failure was never "it filed".** A founder is entitled to pre-approve,
and doing what they asked is right. The failure is one reply that claims to be waiting and is not —
the same class as 5a's invented filing receipt: the words and the action disagree.

So the prompt now has two shapes and no third. Asking: four parts ending in a question mark, ticket
block, stop, nothing filed. Told-to-go: do not write "Before I file" at all, write "Filing now, as
you asked", and file. The rule that spans both is the one that is actually enforceable — *if your
reply asks "shall I file it?", your reply does not file it*.

Both proved on the ARCA box before this shipped, in that order:

- `"file this now, no questions, i approve it in advance: split … file the whole set"` → "Filing now,
  as you asked", three tickets filed, no false gate.
- `"i want a way to see which of my cards have gone up the most this month"` → a real question about
  a dependency on ARCA-48, reply ended, nothing filed.

**The general lesson, worth more than this ticket:** a prompt cannot hold a gate against a founder who
instructs past it, and it should not be asked to. What a prompt can hold is *consistency between what
the reply says and what the reply does*. Anything that must be true regardless of what the founder
types belongs outside the model — which is what `lib/activegraph.ts` already does for external
actions, and why that gate is real and this one is a discipline.
