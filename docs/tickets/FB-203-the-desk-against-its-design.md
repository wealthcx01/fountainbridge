# FB-203 — the desk against its design, read from the template rather than the picture

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-07

## Where this came from

John compared the design's **The desk** screen against production at 1200px, **reading the
artifact's template markup directly** — so every value below is the design's own, not measured off a
picture. This replaces the first pass with the fuller review he sent on 2026-09-07, which adds exact
CSS, an item the first pass missed entirely, and an order of work.

His summary of what has landed: *"the palette, type pairing, sidebar, amber banner, prompt bar, queue
rows and surfaces are all recognisably the design."*

And of what has not: *"the page shell, the vertical hierarchy, and a quantity of explanatory text and
status chrome that the design deliberately omits."*

## 1. The shell — the content is flush against the rail. Fix this first.

**This is a bug, and it is the one people see first.** The first pass missed it entirely by
reviewing the parts rather than the frame.

The shell is `main.main` (36px padding) → a flex row → `nav.rail` (250px) + a **second, nested
`<main>`**. The rail's right edge is at x=286 and the content begins at x=286: no gutter, and the
rail has no right border, so the copy touches the nav column.

Worse, because the outer `.main` carries the only padding, children measure from **two different
ancestors**. The H1, summary and office start at x=286 and run 877px. The amber banner and the
"Where things stand" box start at x=36 and run 1127px — *underneath the sidebar's column*. **Nothing
on the page shares a right edge.**

Rebuild:

- Wrapper: `display:grid; grid-template-columns:250px 1fr; min-height:100vh;` — no padding.
- Rail: `border-right:1px solid var(--rule); padding:26px 22px 22px; position:sticky; top:0;
  height:100vh; box-sizing:border-box; overflow-y:auto;`
- Content: `padding:32px 36px 64px; max-width:1080px;` Every section is a direct child. Nothing
  inside gets its own horizontal margin or max-width, except the summary (`max-width:38em`).
- **One `<main>` per page.** Remove the nested one.
- The founder-preview strip sits inside the pane at the same left edge as plain 13px text — not a
  full-bleed grey bar.

**Acceptance:** eyebrow, H1, summary, banner, prompt bar and every H2 share one left edge; banner,
prompt bar and section rules share one right edge.

### Done, 2026-09-08 — measured before and after at 1200px

| | rail | H1 | banner | prompt bar | office | queue | surfaces | `<main>` |
|---|---|---|---|---|---|---|---|---|
| before | 36–286 | **286**–423 | **286–1022** | 286–1164 | 286–1164 | 286–1164 | 286–1164 | **2** |
| after | 0–250 | **286**–423 | **286–1164** | 286–1164 | 286–1164 | 286–1164 | 286–1164 | **1** |

A 36px gutter where there was none, one right edge where the banner was 142px short of everything
else, and one landmark instead of two — which also closes FB-168, because they were the same fault
seen from two directions.

One detail of the review did not reproduce: it recorded the banner starting at x=36 and running
1127px, *wider* than its neighbours. Measured here it started at 286 and ran 736 — **narrower**,
because it carried a `max-width: var(--content-narrow)` of its own. The fault is the same one (no
section agreed with any other) and the reading of it was different, so it is written down rather than
quietly corrected.

### The two things that broke, and what they were

Neither was found by looking. Both were found by the suite, and both are worth keeping.

**A `1fr` track is `minmax(auto, 1fr)`.** Its minimum is the widest thing inside it, so one wide
diagram pushed the whole page sideways — a handbook chapter took the phone out by 275px. This is the
grid form of the flex `min-width: 0` problem and the fix is `minmax(0, 1fr)`.

**`margin: 0 auto` on a grid item is not what it is on a block.** It stops the item stretching to its
track and makes it fit-content, so the pane grew to whatever was inside it: **668px wide inside a
393px track.** The margin was carried over from the old rule, where it sat on a plain block and was
harmless. There is nothing to centre in any case — the phone measure is 64rem and the query only runs
below 60rem, so it never binds.

The desk's own column test (FB-188) measured the nested `<main>`, so it read 0px once that was gone.
Repointed at `.venture-pane`, which is what the column now is.

### Items 2 to 6 — done, 2026-09-08

The top half. Read at 1440×1000 and 393×851 on the fixture server (this branch is not deployed, so
the production numbers in `docs/design-conformance.md` stand until it merges): **3,050px desktop,
3,449px phone, no sideways scroll at either size.**

What changed, item by item:

- **2.** The heading is **The desk**; the eyebrow is `ARCA · VENTURE · ACTIVE` and the meta sits on
  the heading's own baseline. The ACTIVE pill and *"Your team — AI working on this venture's own
  machine, around the clock."* are gone.
- **3.** `description` is now an optional field on the venture manifest (schema, reader, `DeskFacts`),
  ARCA's is written, and the summary sentence opens with it. No manifest description, no clause —
  the studio does not invent a purpose for someone's company.
- **4.** One banner, one click target, a square marker instead of ⚠, `Decide now →` pushed right, no
  `Needs you:` prefix, and the clear state drawn for the first time.
- **5.** "Where things stand" is deleted. Its blocked lines are not: they name the tickets that are
  stuck, which nothing else on the desk or the phone says, so they moved into the banner's own shape
  in the banner's own amber.
- **6.** One box with Send inside it, chips as bordered pills, and one link where there were four.

### Items 7 to 9 — done, 2026-09-08

The office, its ledger, and the run history split apart. Read at 1440×1000 and 393×851 on fixtures:
**2,855px desktop, 3,193px phone** (from 3,050 / 3,449), no sideways scroll at either size.

- **7.** One heading row, then the room and the ledger side by side, which is the section's whole
  argument. Below about 1,000px of column the ledger drops under the room and takes the full width —
  what decides it is whether the ledger can be read, not what device is asking.
- **8.** The ledger is its own component (`OfficeLedger`) instead of living inside the plate. That
  was a real fault, not a tidy-up: the plate is the *fallback*, so on any venture whose real office
  loaded, the ledger — the half a screen-reader user gets — was not rendered at all. It is two
  columns and hairlines now, relative times, no repeat count and no venture tag.
- **9.** The run history is its own section under a rule, with a heading, the promise beside it, the
  heartbeat line, and four rows of when / outcome / what. The release button finally carries the
  sentence the design asks for.

**Two deviations from the design, both binding rules rather than preferences.** The ledger's column
head is **Surface**, not "Agent", and the section is **What your team did**, not "What the engine
did": FB-103 took "agent", "lane" and "engine" out of everything a founder reads, `copy-lint` fails
the build on all three, and CLAUDE.md #12 binds every word rendered in the studio. "Surface" is also
the truer word — `lib/office.ts` is explicit that one row is one surface, because a lane per surface
is what the box reports.

**One deviation found by looking.** The design puts "LIVE FROM ARCA'S MACHINE" on the heading row.
Built there, it printed *"Live from your venture's own machine"* directly above the stand-in drawing
whose own note says *"This is a stand-in"* — because `office.live` means the box is reporting, which
is a different question from whether the real room is on the screen. The label moved into
`OfficeEmbed`, one line lower, which is the only component that knows.

**FB-192 reconciled.** That ticket chose a 26rem window over a 44rem frame to clip pixel-agents' dead
space; the design asks for 300px and a border. The window keeps 26rem, because the design's 300px was
written against a room drawn to fit its frame and ours is not — the frame is taller than the window
on purpose. The border the design asks for was already there.

### Item 9, corrected on production — 2026-09-08

Items 7–9 merged, deployed, and the production reading found the fault item 9 had actually named all
along. Fixtures could not have shown it and neither could any gate:

> **Showing the 1 most recent of 3459 runs.**

ARCA has 3,459 run reports and every one of them is the same park — *"Daily lane budget reached —
parked until tomorrow"* — so `collapseRepeats` merged the entire history into a single row. Item 8
says to delete the `×20` repeat tag, I deleted it, and with it went the only thing on the screen
saying this venture has been stuck in one place for seven weeks. That is the single most important
fact this section could carry (CLAUDE.md #10).

The tag stays gone; the fact is a clause in the row now — *"· the same thing 3,459 times"* — and
counts are formatted, because `3459` is a string of digits somebody has to parse and `3,459` is a
number. Two fixtures were added that repeat an existing run rather than displace it, so the four rows
the desk shows are unchanged and the collapse path is finally exercised.

**And then the corrected sentence was wrong too.** It read *"the same thing 20 times"* directly above
*"1 most recent of 3,461 runs"*, because `loadRunReports` reads the 20 most recent reports and counts
the rest by name — a repeat count can never exceed 20 however long a venture has been stuck. A founder
reads 20. Understating a seven-week outage by two orders of magnitude is the same failure as
swallowing it.

When one group accounts for every run that was read and more exist unread, it now says *"every one of
the last 20 runs says this"* — which is exactly what the studio knows and no more. It does not claim
all 3,461, because it did not open 3,461 files. The logic moved to `lib/runreports.ts`, beside the
function that creates the situation, so the branch that matters has unit tests: **a venture with 3,461
runs is not something a browser fixture can build.**

### Also found on production, filed separately

**FB-205.** The most-repeated line in ARCA's history reads *"Daily **your team** budget reached"*.
The box writes "Daily lane budget reached" and FB-103's `lane → your team` rule cannot tell a lane
that acted from a lane that is describing a budget. It is a defect in `lib/glossary.ts`, it affects
every caller of `inFounderWords`, and fixing it inside this ticket would have been scope creep.

### Items 10 and 11 — done, 2026-09-08

Read at 1440×1000 and 393×851 on fixtures: **2,220px desktop, 2,575px phone** (from 2,855 / 3,193),
no sideways scroll at either size, nor on the phone in `?full=1`.

**10.** A serif heading with `everything waiting →` beside it. The reference gets its own column, so
titles start on one edge. The whole row is the target and `Decide →` is gone — the arrow rides on how
long it has waited, which is the reason to press it. Capped at four, and it says how many are behind
the link.

**11.** Three columns divided by rules, not three bordered cards. A label, one line, and the links
that go somewhere. Deleted: the ACTIVE pills, the provenance sentence printed three times, the budget
line the rail already carries, two of the three gate sentences, the outlined Open button, and
*"Nowhere to open yet…"*.

**The cap nearly hid a whole kind of decision.** External sends lead the queue on purpose (FB-183),
and ARCA has six of them, so a cap of four showed four sends and **every piece of finished work fell
off the desk** — including the pull requests the amber banner had just counted, on the screen the
banner sends a founder to. `deskQueue` in `lib/desk.ts` reserves the last row for whichever kind the
cap would otherwise erase. Six unit tests; the browser gate asserts the result on a real page.

**Kept against the design, with reasons.** The stale flag: the design calls it noise, and it is the
only place in the studio that says a surface has gone quiet for a fortnight — the badge went, the fact
is a clause at the end of the one line, still interrogable by keyboard (FB-068). The read-failure and
empty panels: neither is in the design because the design has no failing venture in it. And the
budget line survives **only when a surface is over its limit**, because the rail can colour a figure
red but cannot say *285% of the limit*, or that £13,700 of it is still awaiting a founder's OK.

### Items 12 and 13 — done, 2026-09-08

**12, in three parts.**

- **Tickets now sits above Needs you.** Needs you is a *filter* on Tickets (FB-129), and a filter
  listed above the thing it filters reads as a separate place — which is what it used to be, and what
  FB-149 stopped it being.
- **Budgets say `Build £13,700/£4,800`,** not `build`. The rail was printing the raw manifest key
  beside a money figure, which is the studio showing a founder its own filing system. The short name
  comes from the manifest's own name (the part before the em dash), not from capitalising the id —
  that is how `growth-ops` becomes "Growth-ops" on somebody's screen.
- **The engine line has a square in its own colour.** Green when the machine is alive, amber-red when
  it has stopped. The sentence stays and stays first-class; the square is `aria-hidden`, because a
  state told only in colour is a state some readers never get.

**Two parts of item 12 are deliberately not built.**

- **"The pocket studio (mobile)", above Sign out.** There is nowhere honest to send anyone. The pocket
  studio is not a route — it is what the desk becomes below 48rem, and `?full=1` is the toggle the
  other way. The rail is `display: none` on a phone, so the link would only ever be visible on a
  desktop, where pressing it does nothing. A nav row that cannot work where it is shown is a dead
  control, which the design contract forbids and `design-lint` enforces.
- **The office thumbnail with "3 at work · 3 waiting on you".** The "waiting on you" half is already
  three rows above it on the Needs you badge, and FB-167 deleted an office block from this exact spot
  because it was a second statement about one machine, one screen apart from the first, and the two
  disagreed in production. The "at work" half is not free: it needs a run report per surface, and
  reading those in the rail is what FB-164 removed when every screen under a venture was waiting about
  six seconds for it. **What it would take:** the box publishing a per-surface summary the rail can
  read in one file, the way `_heartbeat.json` already carries liveness. That is a box-side ticket.

**13.** Every colour in the design's list already matched. Two things did not:

- **Headings were `font-weight: 500`.** The design sets Source Serif 4 at **400** for every heading
  and has no bold serif anywhere. A serif carries its weight in its own shapes; half a step extra on
  a display face reads as a slightly wrong font rather than as emphasis. Changed globally, so it
  reaches every screen and not only the desk. The wordmark keeps 500 — it is a wordmark, not a
  heading, and the rail's own BRUNTSFIELD is drawn the same way.
- **Three rounded corners survived.** Two 50% dots on Memory and the ledger, and a `0.25rem` textarea
  on the approval card. The design has no border-radius anywhere; the dots are squares now, like every
  other state mark in the studio since item 4.

The 24px section headings item 13 asks for were built in items 7 to 11 — "The office", "What your
team did", "Waiting on you" and "The company, by surface" are all serif H2s now rather than the 11px
uppercase labels the design reserves for column heads and eyebrows.

### FB-203 is complete

All thirteen items are built or written down with reasons. What is left is on other tickets: FB-205
(the mangled sentence) and the box-side per-surface summary the rail's office line would need.

The queue, the surfaces, the rail, and the token audit — in John's order.

## 2. The page header

Design: eyebrow `ARCA · VENTURE · ACTIVE` (11px sans 500, `.16em`, uppercase, `--ink-mute`; "ARCA"
in mono `--accent`), then H1 **The desk** at 30px serif 400 with `Founder: you · updated just now`
inline on the same baseline (13px `--ink-mute`, `gap:16px`).

Production: a ~60px **ARCA** H1, a separate ACTIVE pill, the founder line on its own row, and an
extra sentence *"Your team — AI working on this venture's own machine, around the clock."*

Delete the pill and that sentence. The venture's name belongs in the eyebrow and the sidebar. Keep
`refresh` as a mono 12px accent link in the meta line.

## 3. The summary sentence

Design (`deskSummary`, 20px serif, `line-height:1.5`, `margin:12px 0 20px`, `max-width:38em`) opens
with the venture's own one-line description, then the counts. Production starts at the counts.

The description field does not exist on the venture record. If none is set, fall back to the counts
alone — **but the field should exist.**

## 4. The blocker banner

One full-width click target: `display:flex; align-items:baseline; gap:16px; border:1px solid #8A5A00;
background:var(--paper-deep); padding:14px 20px; margin-bottom:20px;` hover `var(--accent-soft)`.
An **8×8px square** `#8A5A00` marker — not an emoji — the sentence in 19px serif `#8A5A00`, and
**`Decide now →`** pushed right (`margin-left:auto`, 13px sans 600, `--accent`, `white-space:nowrap`).

Drop the ⚠ and the `Needs you:` prefix in the DOM text.

**And the empty state, which we do not have:** same box with `border:1px solid var(--rule)`, a green
8×8 marker, *"Nothing is waiting on you. Your team runs on."* in 19px serif `--ink-soft`.

## 5. Delete "Where things stand"

Not in the design. Its two lines belong in the ledger (item 8). It duplicates that ledger, pushes the
prompt bar below the fold, and its bold red underlined links are the loudest thing on the page.

**The design has no red at all.** Needs-you is amber `#8A5A00`; engine faults are the same amber.

## 6. The prompt bar and its chips

One bordered container: `border:1px solid var(--rule-strong); padding:6px 8px 6px 18px;
margin-bottom:28px; display:flex; gap:14px; align-items:center;` with a borderless transparent input
(14px sans) and a flush green **Send** inside it (13px sans 600, `--accent` on `--paper`,
`padding:10px 20px`, **no radius**). Placeholder: *"Tell the studio what you want. A ticket,
research, a question…"*

Chips: `Try:` in 12px `--ink-mute`, then bordered pills (12px, `padding:5px 12px`, 1px `--rule`,
hover `--rule-strong`), flex-wrap, `margin:-16px 0 28px`.

Delete the four orphan lines beneath. If a "full conversation" entry point is needed it is **one**
13px accent link, not four.

## 7. The office, and its pairing with the ledger

Heading row: `display:flex; align-items:baseline; gap:14px; margin-bottom:10px;` — H2 **The office**
(24px serif 400) beside a 7×7 green square and `LIVE FROM ARCA'S MACHINE` (11px sans 600, `.14em`,
uppercase, `--accent`).

Layout: `display:flex; flex-wrap:wrap; gap:36px; align-items:flex-start;` — the embed left at
`flex:0 1 640px; min-width:360px; height:300px; border:1px solid var(--rule-strong);
background:var(--paper-deep);` and **the ledger on the right, in the same row.**

Caption under the embed (12px `--ink-mute`): *"Each character is 1 agent on Arca's machine; a raised
hand is a wait on you. The studio embeds it read-only."*

Production has an all-caps label as the heading, a 440px borderless embed alone, and the ledger
pushed below. The pairing is the point — *the office is the feeling; this ledger is the record.*

**Note against FB-192:** that ticket chose 26rem of window over a 44rem frame to clip dead space. The
design asks for 300px and a border. Reconcile when this is built — the design's number wins unless
looking at it says otherwise.

## 8. The ledger becomes Agent / Doing, right now

`display:grid; grid-template-columns:110px 1fr; gap:0 18px;` with uppercase 11px column heads
**Agent** / **Doing, right now** over a `--rule-strong` underline. One row per agent
(`padding:13px 0; border-bottom:1px solid var(--rule); align-items:baseline`), name 13px sans 600,
activity 13px sans `line-height:1.6`, action verbs in `--accent` 600. Clickable when the row resolves
to a ticket. **No cards.**

Production: a boxed card, a red bold sentence, a raw ISO timestamp, and `×20` / `ARCA` tags.
Timestamps become relative. The repeat count and the venture tag go — on one venture's own desk the
venture tag says nothing. The stuck ticket becomes a row, in amber.

## 9. The missing section: What the engine did

`border-top:1px solid var(--rule-strong); margin-top:36px; padding-top:20px;` then H2 **What the
engine did** (24px serif) with the inline subtitle *"every wake writes a report; nothing is
swallowed"*; a green 8×8 dot and *"The engine is running; last heartbeat 2 minutes ago."*; then the
**4 most recent runs** as rows — mono 12px time (`flex:0 0 76px`), an 8×8 status square, run text
(14px sans, `line-height:1.6`).

A run needing release shows a bordered **Go ahead with this** button with *"Releases the lane to
start; every real check still happens after."* Footer: *"Showing the 4 most recent of N runs · this
desk re-reads itself once a minute while something is being worked."* Empty: *"No runs yet. The
engine wakes when there is a ticket to work; every wake will be written down here."*

Production collapses this into the card in item 8 and shows 1 of 3,256.

## 10. Waiting on you

Serif H2 **Waiting on you** with `all tickets →` beside it. Rows: `display:flex; gap:16px;
padding:13px 0; border-bottom:1px solid var(--rule); align-items:baseline; cursor:pointer;` hover
`--paper-deep`. Mono 13px ref at `flex:0 0 76px` in `--ink-soft`; title 14px sans 500; meta 12px
`--ink-mute` below; and on the right **`waiting 38 days →`** in 13px sans 600 amber.

Delete `Decide →` — the whole row is the target and the arrow rides on the wait text. Cap the list at
3–4. Empty: *"Queue clear. Finished work lands here first."*

## 11. Surfaces become columns

H2 **The company, by surface**, then `display:grid; grid-template-columns:1fr 1fr 1fr; gap:0;`. Each
column `border-left:1px solid var(--rule); padding:4px 22px 8px;`, an uppercase 11px label
(`BUILD · THE PRODUCT`), **one** 13px `--ink-soft` line, then underlined accent links.

Production has bordered cards, serif titles, ACTIVE pills, `⚠ NOTHING HERE LATELY` badges, an
outlined button, and four to six sentences each — including *"Limit set in the studio; spend as
reported by the venture"* three times. Budgets already live in the sidebar. *"Nowhere to open yet…"*
becomes no link at all, not a paragraph.

## 12. The rail

Order and content: wordmark; eyebrow `ARCA · ACTIVE` with a rule; nav **The desk, Tickets, Needs you
(amber badge), What happened, Memory, Handbook**; rule; `■ THE OFFICE · LIVE` with a small thumbnail
carrying an amber `3 on you` tag and *"3 agents at work · 3 waiting on you"*; `BUDGETS, MONTH` in
mono as `Build £140/£500`; a green dot and *"Engine running · checked 2 min ago"*; and pushed to the
bottom **The pocket studio (mobile)** above **Sign out**.

Production swaps Tickets and Needs you, has no thumbnail, no engine line, no pocket link, lower-case
budget lanes, and puts *"Your team checked in 4 minutes ago"* where the engine line belongs.

## 13. Tokens and type

`--paper #F7F6F2` · `--paper-deep #EFEDE6` · `--ink #17191F` · `--ink-soft #3A3D45` ·
`--ink-mute #6E7079` · `--rule #DDDBD6` · `--rule-strong #B9B6AE` · `--accent #1A3B26` ·
`--accent-deep #112619` · `--accent-soft #E4EAE3` · amber `#8A5A00`.

Source Serif 4 at **400** for every heading — no bold serif, and **no border-radius anywhere**.
Section H2s are 24px serif; production uses 11px uppercase labels for "The office", "Your team",
"Waiting on you" and "Your surfaces", and the design reserves those for column heads and eyebrows.

## The order of work, which is John's

1. **The shell.** Everything else is misjudged until the columns are right.
2. Top-half hierarchy: header, summary, banner, delete the WTS box, prompt bar (2–6).
3. Office and ledger side by side, then the engine section (7–9).
4. Queue, surfaces, rail (10–12).
5. The token audit (13).

## Why this is worth doing carefully

FB-185, FB-180, FB-181, FB-186, FB-188 and FB-190 all cut height and all measured the result. Almost
nothing here is about height.

Two rules hold most of the thirteen items:

1. **Delete before adding.** Most of the drift is sentences the design chose not to write.
2. **Red is not our colour for "needs you".** Amber is. A page with three reds has nothing left to
   say something is actually wrong.

**Acceptance, when it ships:** one 1200px screenshot of the desk beside the artifact's own screen.
