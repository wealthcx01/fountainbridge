# FB-073 — The composer reads a ticket file back at the founder

**Status:** Done · **Phase:** 3 · **Depends on:** FB-065 (the composer inside the studio) ·
**Repo:** fountainbridge (+ venture box) ·
**Branch:** `fb-073-the-composer-reads-back-a-ticket-file` · One ticket = one branch = one PR.

## Why this matters (for the founder)
You said one sentence: *"Card prices look stale — I want them fresh."* You got back four thousand
characters, most of it a document written for engineers, complete with `## Scope`, `## Acceptance
criteria`, `- [ ]` boxes and a line reading `Status: Todo · Area: Pricing/ETL · Depends on: ARCA-24,
ARCA-4`.

You are not supposed to read that. The whole promise of this surface is that you describe what you
want in plain English and it reads the work back **in plain English**. Instead it hands you the
engineering artifact and asks you to approve it.

## What was found
Walked on 2026-08-01 as a founder, on ARCA, through the real composer.

**The ask:** "Card prices on the market page look stale — some are weeks old. I want them fresh."

**The reply:** 4,282 characters in a single block. Its shape:

1. Two paragraphs of genuinely good plain-English diagnosis — the best part of the answer, and the
   part a founder actually wants.
2. Two questions, asked together, mid-flow.
3. A complete markdown ticket: `# ARCA-NEW — Market page price freshness & staleness indicator`,
   then `Status:`, `## Why this matters`, `## Context`, `## Scope`, `## Out of scope`,
   `## Acceptance criteria` with unticked `- [ ]` boxes.
4. A closing question: *"Want me to file this as-is, or adjust the refresh window…?"*

Three separate problems live in that.

**The draft is shown at all.** The ticket is how the *lane* receives work. It is a contract between
the composer and the machine. A founder does not need to see it any more than they need to see the
JSON that goes to GitHub. What they need is: what I understood, what I would do, what I would not do,
and what it will cost you to be wrong. Four short paragraphs.

**The markdown is not rendered, so it reads as broken.** FB-065 added inline formatting for `**bold**`
and `` `code` ``, but not for fenced blocks, headings or lists. So the founder sees literal `##`,
literal `- [ ]`, and stray backtick fences rendered as `…`. Even if we wanted to show the draft, this
is showing it badly.

**The questions are buried.** The two clarifying questions sit above a wall of text, and the decision
question sits below it. A founder scanning the reply will meet the questions last, or not at all. The
composer then says it will "draft assuming both, unless you tell me otherwise" — so it asks, does not
wait, and drafts anyway. Asking a question you do not wait for is worse than not asking.

## Scope
- **Stop showing the ticket draft in the conversation.** Replace it with a short, structured
  read-back: *what I understood*, *what I would do*, *what I would deliberately not do*, and *what
  I still need from you*. Four blocks, none longer than a short paragraph.
- **The draft still exists** — it is what gets filed, and the founder must be able to see it if they
  ask. Put it behind a plain control ("Show me exactly what will be filed"), collapsed by default.
- **Render markdown properly wherever it does appear**: headings, lists, fenced blocks. Still as
  React nodes, never as HTML — the model must not be able to put markup into a founder's browser.
- **One question at a time, and wait for it.** If the composer needs to know something, it asks and
  stops. If it can proceed on an assumption, it states the assumption in one line and does not ask.
- **Cap the read-back.** If the answer cannot be said in roughly 150 words, that is a signal the ask
  was too big and should be split, and the composer should say so rather than write an essay.

## Out of scope
- The agent's underlying reasoning quality. It diagnosed this correctly and found the related
  tickets; the problem is entirely in what it chooses to *show*.
- The "file it" control (FB-075) — this ticket is about what the founder reads, that one is about
  what they press.

## Acceptance criteria
- [x] A founder never sees `##`, `- [ ]`, `Status:`, or a raw fence in the conversation. Verified
      against the live reply.
- [~] The read-back fits on one screen — 1.5 screens, down from 2.3. Closer, not there.
- [x] The full draft is available on request and collapsed by default. Unit-tested; **not yet seen
      working on the box**, because the composer declined to draft on the verification run.
- [~] A question the composer asks is one it waits for. The prompt now requires it; not yet proven
      against a case where it wants to ask two.
- [ ] An ask too large to summarise is met with "this is really two things". Instructed, untested.

## What was built, and where the guarantee lives
Two halves, and only one of them can be trusted.

**The prompt** now asks for a fixed four-part read-back — *what I understood*, *what I'd do*, *what
I'd leave alone*, *before I file* — with a hard 150-word limit and an instruction to say "this is
really two pieces of work" rather than write an essay. It also forbids asking two questions or
asking one and proceeding anyway.

**The rendering** splits the reply into blocks: prose, headings, list items, and the ticket draft.
The draft is folded behind *"Show me exactly what will be filed"* and never shown by default.
Headings render as headings, checkboxes lose their `[ ]`, and each bold label starts its own block so
the four parts stay four parts.

The second half is the one that holds. The agent's instructions **already** said "2 to 3 sentences"
before this ticket, and it produced 4,282 characters anyway. A surface that depends on a model
obeying a word count is not a surface with a guarantee; the parsing is what makes the promise real.

## Measured, before and after
Same founder, same sentence — *"Card prices on the market page look stale — some are weeks old. I
want them fresh."* — against the real ARCA box.

| | Before | After |
| --- | --- | --- |
| What the founder reads | 4,282 characters | **2,091 characters** |
| Page height | 2.3 screens | **1.5 screens** |
| `##`, `- [ ]`, `Status:`, fences visible | yes | **none** |
| Ticket draft | in front of the button | folded away |

The four-part shape came through intact, and *"What I'd leave alone"* did the job it was added for:
*"I won't touch the full 19k-card catalog expansion or the historical-price-chart work — those are
separate, already-tracked pieces of work."* That is the sentence that stops a founder worrying.

## What is NOT fixed, stated plainly
- ⚠ **The 150-word limit is not obeyed.** It produced 345 words. Better than 700, still over. A word
  count in a prompt is a request, not a constraint, and this ticket does not add a real one. If it
  matters, the honest fix is to measure the read-back in the studio and fold the overflow the same
  way the draft is folded — which is more machinery than this warranted today.
- ⚠ **The folded draft has not been seen against a real draft.** On the verification run the composer
  decided ARCA-24 already covered the ask and declined to draft a ticket at all — correct behaviour,
  and it means the collapse control was never exercised live. It is covered by unit tests and by the
  UI gate's recorded stream; it has not been watched working on the box.
- ⚠ **The reply still runs past the four parts.** After "Before I file" it continued with further
  reasoning about ARCA-24. The prompt says "NOTHING else"; the model added more.
- ⚠ **The same action can appear twice.** "Looking through what your venture knows" rendered twice in
  one reply. Two brain searches probably did happen, so it may be accurate — but it reads as a
  stutter and nothing collapses repeats.

## Verification
38 unit tests over the parser: the draft in its own block, headings, checkbox markers stripped,
bullets and numbers, an unterminated fence treated as a draft rather than prose, an empty fence
inventing nothing, and the labelled-line split with its two negative cases.

Then the real walk on ARCA, measured above.
