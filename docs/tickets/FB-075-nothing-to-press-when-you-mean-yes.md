# FB-075 — There is nothing to press when you mean yes

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-065 (the composer), FB-073 (what it reads back) ·
**Repo:** fountainbridge (+ venture box) ·
**Branch:** `fb-075-nothing-to-press-when-you-mean-yes` · One ticket = one branch = one PR.

## Why this matters (for the founder)
The composer finishes by asking: *"Want me to file this as-is, or adjust the refresh window, scope,
or dependencies first?"*

There is no yes button. There is no no button. There is a text box.

So the founder has to work out, unprompted, that the way to agree is to type a sentence — and to
guess which sentence. "Yes" might do it. "File it" might do it. "Go ahead" might do it. The one
moment this entire surface exists for — a person agreeing that work should happen — is left to
free text and hope.

## What was found
Walked on 2026-08-01 on ARCA. After a full exchange the founder's options on screen were:

| Control | What it does |
| --- | --- |
| **Send** | sends whatever is typed |
| Add a document | attaches a file |
| Start again | wipes the conversation |

Nothing named the decision. And the previous day's walk showed the cost directly: asked to file, the
composer replied *"I want to make sure I file the right thing, but I don't have a drafted ticket from
earlier in this conversation"* — because the confirmation arrived in a different session. The founder
had said yes; the yes went nowhere.

Three things are wrong at once.

**The decision has no affordance.** Every other agreement in the studio has a button: *Approve* on an
external action, *Accept this work* on a piece of work. Only the composer — the surface a founder
uses most — makes them type.

**"Start again" has equal weight to "Send".** The control that throws away the whole conversation
sits next to the control that continues it, same size, same row, no confirmation. On a surface where
a founder is deliberately writing at length, a mis-click loses everything they wrote.

**Agreement is not recorded as agreement.** When a founder types "yes", nothing distinguishes it from
any other message. The composer decides for itself whether that counted. After FB-062 — where the
composer said it had filed something it had not — a decision that exists only as a sentence in a chat
log is exactly the wrong shape for the one thing that must be unambiguous.

## Scope
- **When the composer proposes filing something, show two controls**: *File this* and *Change
  something*. They appear only when there is a concrete draft to act on, so they never sit there
  meaninglessly.
- **Pressing "File this" is unambiguous** — it does not send the word "yes" into the conversation and
  hope. It carries the identity of the specific draft being agreed to, so the composer cannot file a
  different thing from the one shown.
- **What the founder agreed to is shown after it happens**, with the evidence: what was filed, and a
  way into it. FB-065 renders the tool action; this should make the outcome equally plain.
- **Demote "Start again"** — move it away from the send row, and confirm before wiping a conversation
  that has more than a couple of turns.
- **Typing "yes" must keep working.** The button is the obvious path, not the only one; a founder who
  types their agreement should still get it.

## Out of scope
- The wording of the read-back (FB-073).
- Approval of *external* actions, which already has its own gate and its own button (FB-046).

## Acceptance criteria
- [ ] When there is a draft on the table, a founder can agree with one press.
- [ ] The press is bound to that specific draft, so what is filed is what was read.
- [ ] After filing, the founder sees what was filed and can open it.
- [ ] "Start again" is not adjacent to "Send", and asks before discarding a real conversation.
- [ ] Typing agreement in words still works.

## Verification
`/review` + CI, then the full walk on ARCA: ask for something, get the read-back, press **File this**,
and confirm a real pull request appears with the founder able to open it from the conversation —
without typing a word after the original ask.

Then the adversarial case: press **File this**, and before it completes, send another message. The
thing filed must still be the draft that was on screen when the button was pressed.
