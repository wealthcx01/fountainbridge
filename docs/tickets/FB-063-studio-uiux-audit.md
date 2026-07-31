# FB-063 — What the studio actually looks like to a founder

**Status:** In review · **Phase:** 3 · **Depends on:** FB-042 (the brief + activity strip), FB-045
(surfaces), FB-057 (the design contract) · **Repo:** fountainbridge ·
**Branch:** `fb-063-studio-uiux-audit` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Ross signs in for the first time in a few days. This is the list of things he will see that we would
not choose to show him.

## How this was found
Driven in a real browser (2026-07-31), signed in as a **venture founder rather than as the admin** —
`ross@bruntsfield.capital`, who sees THE RESET and nothing else, and `john@bruntsfield.capital`, who
sees the two ventures he founds. Desktop (1280) and mobile (375), across the login page, the ventures
list, both venture boards, the attention queue and the activity feed.

Venture isolation itself was verified live and holds: Ross's ventures list contains exactly one card.
That is now pinned by a test against the real manifests (FB-058) rather than being a thing we believe.

## Findings, worst first

### 1. A missing glyph on the most important button
The composer entry point renders as **`▯ Chat — describe what you want`** — the emoji falls back to a
tofu box. It appears twice: on the venture board's button and again in the "your box isn't set up
yet" note. The one control meant to feel inviting looks broken. Either ship the font that carries it
or use a glyph the stack can actually draw.

### 2. Ross's first screen is four boxes of nothing
THE RESET's board, today, top to bottom: "no agent lane running yet", then a greyed composer note,
then "No runs recorded yet", then two repos with "No tickets on the default branch". Every one is
individually well-written. Together they are a wall of absence with **no next action anywhere on the
page**. The same criticism I made of ARCA's empty Overview applies to our own front door.

### 3. The same sentence, twice, on the same screen
"No sign of an agent lane on this venture yet — it starts with your box." appears in the brief *and*
in the activity strip, verbatim. The brief exists to summarise what is below it; when there is only
one fact, it repeats rather than summarises.

### 4. The budget line is repeated on every approval card
On ARCA's board, four approval cards each carry the identical paragraph: *"Limit £4,800 this month.
The venture reports £4,000 spent, £5,200 more awaiting your OK — 192% of the limit. Limit set in the
studio; spend as reported by the venture."* Four times, in red. It is one fact about the department,
not four facts about four actions, and repeating it in the alarm colour flattens the hierarchy — the
genuinely serious card (a grant the studio could not verify) reads no louder than a routine one.

### 5. Three date formats on one page
`3:05:32 PM` in the header, `20 June 2026` on a decided approval, `2026-07-21T18:30:00Z` in the
activity strip. I chose the ISO one deliberately — a relative time computed server-side is wrong the
moment the page is cached — but a raw `T` and `Z` is a developer's format on a founder's screen.
Pick one founder-facing format and put it behind one helper.

### 6. Copy that reads like a template that did not finish
- **"Work here is approval coming."** — the Scale surface, where the gate is `tbd-fb012`. It is not a
  sentence.
- **"Ventures — Your venture"** while showing two cards.
- **"03 — Foundry Studio"** appears twice on the login page: once in the header, once as the page
  eyebrow. `03` is a section number from the Bruntsfield site's design language and means nothing to
  a founder signing in.

### 7. Unexplained badges
`⚠ 1 WARNING` beside a venture name, `⚠ 1` on a ticket card, `⚠ STALE` on a repo that has never had a
commit. Each is real information with no way to find out what it refers to. A badge a founder cannot
act on is noise that trains them to ignore badges.

### 8. Smaller
- The login page's content sits in the top third with roughly half the viewport empty below it.
- "Workstreams", "Ventures" and "Foundry" sit adjacently in the nav as three distinct destinations
  whose difference is not obvious from the words.
- The gate descriptions ("Work here is approved by review") render in the monospace face, which reads
  as code rather than as an explanation.

## Out of scope
- Any change to what the surfaces mean or how the gate works. This is how it reads and looks.
- The composer faults found the same day — FB-061 and FB-062.

## Acceptance criteria
- [x] **No missing glyph.** `💬` was the only colour emoji in the product — everything else uses
      monochrome dingbats (`⚠ ✓ ✗ ✕`) that every font we ship carries. Removed from both places; the
      words carry it.
- [x] **No sentence appears twice on the same screen.** The brief no longer prints the engine line
      when the engine is healthy AND there is something else to report — the activity strip directly
      below says it anyway. A stalled or absent lane still always appears, and so does a healthy one
      when there is nothing else to say, so a quiet venture never gets an empty brief.
- [x] **The copy defects in §6.** Gate descriptions are whole sentences rather than fragments slotted
      into `Work here is ___.` (a template can only be as grammatical as its worst case, and the worst
      case was the surface nobody has finished designing); they no longer render in the code face.
      The ventures eyebrow counts rather than assumes. The duplicated `03 — Foundry Studio` is gone
      from the login page.
- [ ] A venture with nothing in it yet offers one clear next action rather than four empty panels.
- [ ] The budget position appears once per department, not once per approval, and the alarm colour is
      reserved for what is actually alarming.
- [ ] One founder-facing date format, from one helper.
- [ ] Every `⚠` badge either explains itself on hover/click or is removed.

## What is deliberately not done here
The four unticked items are design decisions, not defects with an obvious right answer:

- **The empty first screen** needs someone to decide what a founder's first action actually is. It is
  the most valuable item on this list and it deserves more than a paragraph written at the end of a
  long session.
- **The repeated budget line** is FB-054's feature — the founder seeing the cost at approve-time —
  and that ticket took three review passes to get right. Condensing it is a judgement about that
  feature, not a typo, and unpicking it unilaterally would be the wrong way to treat carefully
  reviewed work.
- **Dates and badges** are small but want one owner each (a formatting helper, a badge component)
  rather than four call sites edited in place.

## Verification
`/review` + CI, and a repeat of this walk — signed in as a founder, not as the admin — at 1280 and
375, with the screenshots attached to the PR.
