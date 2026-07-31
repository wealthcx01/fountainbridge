# The founder's journey — what a founder should actually do, click by click

Grounded in a walkthrough of the running studio on 2026-07-31, signed in as a **venture founder**
rather than as the admin. That distinction is what made it useful: the admin view is the one we had
always been looking at.

Visual proposal: <https://claude.ai/code/artifact/d82294d1-2398-4907-bbaf-092f2c03b9aa>

Delivered by **FB-064** … **FB-068**.

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

Rive was raised as a way to bring this under one flow. It is the wrong tool for that, and the right
tool for something else — worth writing down so it is not re-litigated.

Rive is a real-time **animation and motion** runtime: state machines for graphics, embedded as `.riv`
assets. It does not unify applications, render pull requests, or replace a front end. Pointing it at
"the composer is a separate app and I have to go to GitHub" would be a category error — those are
missing *surfaces*, and surfaces are Next.js pages against APIs we already have.

`FB-027` already scopes Rive correctly, and already records the sharp edge: the Rust CLI is an
**authoring** tool for producing `.riv` files, never a runtime dependency. It is explicitly gated
behind substance — and it should stay there. A studio that animates beautifully while sending a
founder to github.com to accept their own work is worse than one that does neither.

Once FB-064 through FB-068 are in, Rive is exactly the right way to make the result feel made:
the state transition when work moves, the moment a ticket lands on the board, the machine running on
the Foundry page.

**Substance, then shine.**
