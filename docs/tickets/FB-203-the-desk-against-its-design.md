# FB-203 — the desk against its design, read from the template rather than the picture

**Status:** Open · **Phase:** 3 · **Raised by:** John, 2026-09-07

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
