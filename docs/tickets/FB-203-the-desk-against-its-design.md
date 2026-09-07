# FB-203 — the desk against its design, read from the template rather than the picture

**Status:** Open · **Phase:** 3 · **Raised by:** John, 2026-09-07

## Where this came from

John compared the design's **The desk** screen against the live `/venture/arca`, decoding the
artifact's template to get the exact specification rather than measuring the rendered picture. That
matters: every number below is what the design *says*, not what a screenshot appears to show.

His verdict on what has landed: *"the palette, serif/sans pairing, sidebar, amber blocker banner,
prompt bar, queue rows and surfaces are all recognisably the design."*

And on what has not: *"mostly hierarchy, ordering, and a fair amount of text that the design
deliberately left out."*

That last clause is the theme. Most of the drift is **additive** — explainer sentences, status pills,
debug links — and trimming costs nothing but nerve.

## The biggest single win

> restoring the order and density of the top half — small H1, full summary sentence, the amber banner
> as a strip, prompt bar directly beneath, then office + ledger side by side.

If this ships in two PRs, that is the first one.

## 1. The page header is the wrong shape

Design: eyebrow `ARCA · VENTURE · ACTIVE`, then an H1 of **The desk** at 30px serif, with
`Founder: you · updated just now` inline beside it on one baseline.

Production: a ~60px `ARCA` H1, a separate ACTIVE pill, the founder line below, and an extra sentence
— *"Your team — AI working on this venture's own machine…"* — that is not in the design at all.

The venture's name is already in the sidebar and in the eyebrow. The design keeps the title small so
that the serif summary sentence is the first thing read.

## 2. The summary sentence lost its first clause

Design: *"**Arca gives founders one place to raise: deck, data room and investor updates, run by your
studio team.** 3 decisions wait on you; …"*

Production starts at *"9 decisions wait on you"*. The one-line description of what the venture IS is
the whole point of that paragraph, and it is missing.

**This one is not just wiring.** `ventures/arca.yaml` has no description field, so it has to be added
to the manifest and to the `Venture` contract before the desk can render it.

## 3. The blocker banner: wrong glyph, wrong weight, wrong width

| | design | production |
|---|---|---|
| marker | an 8×8 square in `#8A5A00` | a ⚠ emoji |
| text | 19px serif in `#8A5A00` | ~14px sans |
| `Decide now →` | right-aligned, `margin-left:auto`, sans 13px 600, green | inline in the sentence |
| width | full width | narrower than the content column beneath it |

Also: drop the `Needs you:` prefix in the DOM text, and make the **whole banner one click target**.

## 4. "Where things stand" is not in the design

The stuck-ticket and idle lines belong in the Agent/Doing ledger (item 7). As it stands the box
duplicates that ledger, pushes the prompt bar below the fold, and **its red underlined bold links are
the loudest thing on the page** — the design uses amber `#8A5A00` for "needs you" and never a red.

## 5. The prompt bar and its chips

Design: one bordered container (`rule-strong`) with the input and a flush green **Send** *inside* it;
placeholder *"Tell the studio what you want. A ticket, research, a question…"*; chips as bordered
pills.

Production: input and Send as separate boxes, a truncated placeholder, underlined chips.

And the four orphan lines beneath it — *Open the whole conversation · See what your venture knows ·
What happens without you asking · Or open your venture's full chat…* — are not in the design and
read as debug links. Remove them or fold them into the sidebar.

## 6. The office: heading, frame and, most of all, its neighbour

Design: a serif 24px H2 **The office** with a small green dot and `LIVE FROM ARCA'S MACHINE` beside
it; a **300px** embed with a `rule-strong` border on `paper-deep`; and — the key idea — sitting
**side by side with the ledger**: flex row, 36px gap, embed `flex:0 1 640px`.

Production: an all-caps small label as the heading, a 440px borderless embed on its own, and the
ledger pushed below.

John's line for why the pairing matters: *"the office is the feeling; this ledger is the record."*
Restore the two columns, including the caption under the ledger.

## 7. The ledger should be the Agent / Doing table

Design: a two-column grid (`110px 1fr`), uppercase heads **Agent** and **Doing, right now** with a
`rule-strong` underline, one row per agent, 13px sans, hairline dividers, **no cards**.

Production: a single boxed card with a red bold sentence, a raw timestamp (`2026-09-07T20:05:12Z`),
and `×20` / `ARCA` tags.

Timestamps become relative ("4 min ago"). The `×20` repeat count (FB-180) and the venture tag are not
in this spec — on a single venture's own desk the venture tag says nothing.

## 8. "What the engine did" is missing entirely

Design: its own section under the office and ledger — serif H2, the subtitle *"every wake writes a
report; nothing is swallowed"*, a green running line, then the **4 most recent runs** as
`mono time · dot · text` rows, then *"Showing the 4 most recent of N runs · this desk re-reads itself
once a minute…"*.

Production collapses this into the one card and shows 1 of 3,256.

## 9. "Waiting on you" is close

Heading becomes serif 24px **Waiting on you** with `all tickets →` beside it. Two fixes and a cut:

- the wait text should be amber `#8A5A00` at 600 weight; production has it grey
- **`Decide →` should not be there.** The design's affordance is the `waiting 38 days →` itself, with
  the whole row clickable and a `paper-deep` hover
- the design shows a capped list of 3–4, because the heading links to the full queue. Nine rows is a
  lot

## 10. Surfaces: columns, not cards

Design, *The company, by surface*: serif H2, three columns separated **only by a 1px left rule**,
each with an uppercase 11px label (`BUILD · THE PRODUCT`), **one** 13px line of substance, and
underlined green links (`Open the app ↗ · changes on the VM ↗`).

Production: bordered cards, serif titles, ACTIVE pills, `⚠ NOTHING HERE LATELY` badges, an outlined
*Open the terminal* button, and four to six explanatory sentences per card — including *"Limit set in
the studio; spend as reported by the venture"* repeated three times.

Cut to label, one line, links. The budget detail already lives in the sidebar.

## 11. The sidebar

- Nav order is **The desk, Tickets, Needs you, What happened, Memory, Handbook** — production has
  Tickets and Needs you the other way round
- An office thumbnail with an amber `3 on you` tag, and *"3 agents at work · 3 waiting on you"* under
  the nav — missing
- A green-dot *Engine running · checked 2 min ago* line — missing, and *"Your team checked in 4
  minutes ago"* is sitting where it should be
- Budgets as `Build £140/£500`, capitalised, with no grey mono "not set"
- A *The pocket studio (mobile)* link above Sign out — missing

## 12. Tokens

Body copy sits closer to a pure grey than the design's `--ink-soft #3A3D45`. Check the variables are
copied exactly: `--paper #F7F6F2`, `--paper-deep #EFEDE6`, `--rule #DDDBD6`, `--rule-strong #B9B6AE`,
`--accent #1A3B26`, amber `#8A5A00`.

The founder-preview strip is fine, but in the design it is plain text on the page background, not a
filled grey bar.

## Why this is worth doing carefully

FB-185, FB-180, FB-181, FB-186, FB-188 and FB-190 all cut height and all measured the result. This
ticket is different: almost nothing here is about height. It is about a page that says too much, in
the wrong order, with the wrong things shouting.

Two rules to hold while doing it, because they are what most of the twelve items reduce to:

1. **Delete before adding.** Most of the drift is sentences the design chose not to write.
2. **Red is not our colour for "needs you".** Amber `#8A5A00` is. A page with three reds on it has no
   way left to say something is actually wrong.
