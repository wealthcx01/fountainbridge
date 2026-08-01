# FB-075 — There is nothing to press when you mean yes

**Status:** Done · **Phase:** 3 · **Depends on:** FB-065 (the composer), FB-073 (what it reads back) ·
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

## What was built
**Two controls, shown only when there is a real draft on the table**: *File this* and *Change
something*, with the line *"Nothing is built until you press it."* No draft, no buttons — a control
that sometimes means nothing teaches a founder to distrust it.

**The agreement names what it agrees to.** Pressing *File this* does not send the word "yes". It
sends the draft's own title, and an instruction: *"If that is not the draft you have in front of you,
stop and tell me rather than filing something else."* The whole conversation is sent every turn, so
the draft is in front of the composer either way — but naming it means a reply that has moved on can
notice, instead of filing whatever it last thought of.

That is not theoretical. It already went wrong: asked to file, the composer once answered *"I don't
have a drafted ticket from earlier in this conversation."* The agreement and the draft had come apart.

**"Start again" is demoted.** Out of the send row, and it asks before wiping a conversation of more
than two turns. A founder deliberately writing at length should not be one mis-click from losing it.

## Proven on the real box
Asked for something with no existing ticket behind it, so the composer had to draft:

> *"Add a 'last updated' time next to each price on the card page, so I can see how fresh it is."*

| | |
| --- | --- |
| What the founder reads | **940 characters, 156 words** — down from 4,282 |
| Page height | **1.3 screens** |
| Ticket draft | folded, body hidden |
| `##`, `- [ ]`, fences, `Status:` | none visible |
| Decision row | present, both controls |

Then **File this** was pressed. The composer replied:

> *"That is exactly the draft I have in front of you — filing it now, unchanged. Filed — PR #25:
> https://github.com/wealthcx01/arca/pull/25. Your team will pick it up from there. Nothing goes live
> until it's approved and merged."*

`arca#25`, filed by pressing a button. No sentence guessed, no "yes" typed.

Note the word count: **156 words against the 150 asked for.** FB-073 recorded 345 as an unfixed
problem; with a draft actually on the table it came in essentially on target. The earlier number
looks like the composer reasoning aloud about an ask it had decided not to draft, rather than the
read-back being long.

## A bug this introduced, and caught
The *File this* button was first given `data-testid="composer-file"` — already the id of the hidden
document input. Two elements, one id: it breaks Playwright's strict mode the moment a test asks for
it, and the live walk reported `File this: 2`. Renamed to `composer-file-this`. Recorded because it
was found by reading a count that looked wrong rather than by anything failing.

## Acceptance criteria
- [x] When there is a draft on the table, a founder can agree with one press.
- [x] The press is bound to that specific draft — by name, with an instruction to stop on a mismatch.
- [x] After filing, the founder sees what was filed and can open it. The composer returns the pull
      request link in its reply.
- [x] "Start again" is not adjacent to "Send", and asks before discarding a real conversation.
- [x] Typing agreement in words still works — the button is an addition, not a replacement.
- [~] **The adversarial case is not tested.** Pressing *File this* and sending another message before
      it completes: the send path disables input while in flight, so the race is hard to reach from
      the UI, but "hard to reach" is not "impossible" and it has not been proven.

## Verification
42 unit tests over the composer read model, four of them new here — the draft named, the fallback
when it has no heading, nothing to agree to without a draft, and the guard surviving a missing title.
10 Playwright over the surface, three new: the draft folded and opening on request, the decision row
with both controls, and no decision row before there is a draft.

Then the real walk above, ending in `arca#25`.
