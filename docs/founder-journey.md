# The founder's journey — what a founder should actually do, click by click

Grounded in a walkthrough of the running studio on 2026-07-31, signed in as a **venture founder**
rather than as the admin. That distinction is what made it useful: the admin view is the one we had
always been looking at.

Visual proposal: <https://claude.ai/code/artifact/d82294d1-2398-4907-bbaf-092f2c03b9aa>

Delivered by **FB-064** … **FB-069**.

## The first action

The one thing on day one is **a conversation, not a form** — and not "file me a ticket" either.

A founder arrives with work already done: exports from other chats, research reports, competitor
notes, a deck, customer interviews. They should hand that corpus over first, and it should become the
venture's knowledge rather than context that evaporates when the tab closes.

Then the conversation should go where our own playbook goes — who exactly this is for, what they do
today instead, and the question founders skip: **what would stop someone copying this?** Durable
advantage for a new company comes overwhelmingly from **counter-positioning** or a **cornered
resource**, and the newcomer's move is only available before you have a legacy to protect. A feature
list is not a moat. Barriers, not benefits.

Out of that comes a **thesis** — who it is for, what it replaces, the power being built, what would
falsify it — saved to the venture's knowledge, feeding the founding run, and traceable from every
ticket that follows.

We already ship all of this teaching: 8 handbook chapters, 12 playbook chapters, Disciplined
Entrepreneurship's 24 steps, 7 Powers. **The composer has never been given any of it** — not one
reference in its instructions, and the brain indexes the venture's repo rather than this content. We
teach the method in one room and hand founders an assistant that has not read it. (FB-069.)

## The premise

A founder only ever does four things:

1. **Say what they want.**
2. **Watch it get picked up.**
3. **Decide when asked.**
4. **See what happened.**

Everything else is our plumbing. The studio is currently arranged around *our* concepts — repos,
surfaces, branches, approvals, workstreams — and the founder does the translating on every visit.

## The break

The loop stops the moment work exists.

```
describe it → composer drafts → you approve →  [ leave for GitHub → read a diff → merge ]  → come back
```

Three of the seven steps happen in a developer tool the founder was never meant to open. The
Attention page states the promise in our own words — *"Everything across your ventures waiting on
your OK. Nothing goes live until you approve it"* — and then offers one link, `PR #10 ↗`, out of the
product.

There is a quieter version of the same fault beside it. The studio has **two kinds of decision that
look nothing alike**: an external action has a real Approve button, a cost, a provenance line and a
recorded grant; a piece of work has a hyperlink. Nothing explains why.

**FB-064 closes this, and it is worth more than everything else on the list**, because everything
else ends here.

## The seven moments

| # | Moment | What it should be |
| --- | --- | --- |
| 1 | **Arriving** | One Google button. The venture's name, not ours. |
| 2 | **Landing** | Straight into their venture — one venture means no picker. One action alone on the page until it has been used once. |
| 3 | **Saying it** | The conversation happens *inside* the studio. Same shell, same type. The founder cannot tell where one system ends and the next begins. |
| 4 | **Watching it land** | They see it appear on their own board, with a state. Closing the loop in front of them is what makes it feel real. |
| 5 | **Checking in** | The top of the page answers one question: *does anything need me?* Everything below is evidence for that answer. |
| 6 | **Deciding** | One place, one shape, whatever the decision is: what it does in their words, what it costs, who it reaches, what we can and cannot prove. Then one button. |
| 7 | **Seeing what happened** | Sentences, one human date format, and a link that opens the work *inside* the studio. |

## Navigation

Eight destinations become four, named for the job rather than for our architecture: **your venture**,
**needs you**, **what happened**, **handbook**. The composer becomes an *action* you take, not a place
you go. "Foundry" is the story of how this works — it belongs on the public site, where people are
deciding whether to join, not in a working founder's header. (FB-067.)

## Five rules

**Every screen answers "what now?"** If it cannot, it does not belong in the founder's navigation.

**Empty is designed, not hit.** Every empty panel says what would fill it and how to start. Four blank
boxes teach a founder the product does nothing.

**Never a number we cannot stand behind.** A confident figure that means nothing is worse than an
honest gap — the same lesson ARCA is learning about its own synthetic price history.

**Nothing that reached a person vanishes.** Sent, failed, refused: it stays on screen with its state.

**Plain English, no exceptions.** No repository names, no branches, no "activegraph", no "conflation".
If a founder needs a glossary, the interface has failed.

## On Rive

Researched properly rather than dismissed, because the first answer undersold it.

**It is more capable than "animation".** Rive is an interactive runtime with **state machines** and
**data binding**: an application reads and updates values inside a `.riv` file at runtime — text,
numbers, booleans, lists (add, remove, edit, swap), image swaps, artboard swaps, responsive layouts.
Duolingo is the reference case: instead of pre-baking every reaction they built modular pieces and let
the state machine blend them live, triggered by app events like `correct_answer` or
`streak_milestone`, syncing to audio and reacting to taps. Eight head and eight body animations
compose into 64+ variations, in **under a megabyte**. That is a genuine UI runtime for stateful,
expressive components — not decoration.

**It is still not application architecture.** Rive's own documentation does not claim it replaces
HTML and CSS for forms, tables or text-heavy screens, and those are most of what the studio is. More
to the point, it cannot answer the actual problem: "the composer is a separate app and I have to go to
GitHub to accept my own work" describes **missing surfaces**, and surfaces are Next.js pages against
APIs we already have. No animation runtime fixes a hole in the flow.

So: the right tool, aimed at the wrong problem *for now*. `FB-027` already scopes it correctly and
records the sharp edge — the Rust CLI is an **authoring** tool for producing `.riv` files, never a
runtime dependency — and gates it behind substance.

Where it earns its place, once FB-064 to FB-068 are in: the moment a ticket lands on the board, the
transition as work moves between states, an approval resolving, the machine running on the Foundry
page. Those are exactly the stateful, event-driven moments Rive is built for, and they are the
difference between a studio that works and one that feels made.

**Substance, then shine** — and then shine properly, with the tool that does it well.

Sources: [Rive data binding](https://rive.app/docs/runtimes/data-binding) ·
[Duolingo's AI-powered Video Call brings Lily to life with Rive](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life) ·
[Engineering interactive mascots with Rive's state machine](https://dev.to/uianimation/engineering-interactive-mascots-with-rives-state-machine-and-runtime-architecture-4e2h)
