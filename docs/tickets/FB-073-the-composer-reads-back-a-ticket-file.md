# FB-073 — The composer reads a ticket file back at the founder

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-065 (the composer inside the studio) ·
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
- [ ] A founder never sees `##`, `- [ ]`, `Status:`, or a raw fence in the conversation.
- [ ] The read-back for a typical ask fits on one screen without scrolling.
- [ ] The full draft is available on request and collapsed by default.
- [ ] A question the composer asks is one the composer waits for.
- [ ] An ask too large to summarise is met with "this is really two things" rather than an essay.

## Verification
`/review` + CI, then the same walk on ARCA with the same sentence — *"Card prices on the market page
look stale"* — and a screenshot showing the whole reply on one screen. Then a deliberately vague ask
("make the app better") to confirm the composer splits it rather than writing four thousand
characters about it.
