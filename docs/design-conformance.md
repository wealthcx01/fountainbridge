# The studio, measured against its design

**Taken 2026-09-02**, against `main` at `64f3eaa`, on production
(`foundry-studio-production-4a73.up.railway.app`) signed in as ARCA's founder.

Both sides were rendered in a real browser and looked at — the design prototype was clicked through
screen by screen, not read as markup. This is the scorecard CLAUDE.md rule 11 asks every screen
change to add a line to.

## How to take it again

Sign in to production as the venture's founder, and for each route record
`document.documentElement.scrollHeight` and
`scrollWidth - clientWidth` at **1440×1000** and on an **iPhone 13** profile. Open the design
artifact in the same browser and click through to the matching screen. Then *look at both.*

Height is not the point — it is the cheapest visible proxy for "this screen shows more than it was
designed to". Every gap below was found by the number and then confirmed by reading the picture.

## The scorecard

| screen | design | desktop | phone | verdict |
| --- | --- | --- | --- | --- |
| Sign in | one screen | **1,000px** | **851px** | **compared, FB-189** — matched on height, wrong on everything else |
| The desk | ~1,900px | **1,984px** | **2,228px** | rows not cards (FB-183), one block (FB-186), full width (FB-188), FB-203 items 1–13 |
| Tickets | 1,090px | **1,325px** | **1,600px** | fixed FB-185, widened FB-188, FB-208 (was 6,864 / 8,008) |
| a ticket | — | **1,202px** | **1,945px** | fixed FB-185, widened FB-188 (was 6,864 / 8,859) |
| What happened | ~1,000px | **1,264px** | **2,836px** | fixed FB-180, widened FB-188 (was 3,556 / 6,536) |
| Memory | ~1,000px | **1,096px** | **1,988px** | fixed FB-181, widened FB-188 (was 1,570 / 2,881) |
| Composer | ~1,000px | **1,096px** | 1,142px | **matches** |
| Handbook | 1,000px | **1,096px** | **1,581px** | **explained and fixed, FB-190** — see below |
| a chapter | ~1,000px | **3,318–16,198px** | — | **the 1,188px reading was wrong** — see below |
| The pocket studio | ~600px | — | **2,228px** | **fixed, FB-160** (was 4,221px), FB-203 items 1–13 — the desk's phone row IS this screen |

No screen scrolls sideways at either size. That was not true two weeks ago (FB-153, FB-124).

## What the numbers turned out to mean

**The desk's gap was not the approval cards.** FB-183 turned them into rows, which is right and is
what the design asks for — and the desk barely moved: 3,217px to 3,185px. On ARCA that is one card
removed, while the design's own row shape adds a line of meta to all ten waiting rows. The two
roughly cancel.

Reading the screen rather than the number found the real cause: the venture's three surfaces are
stated **twice**, as a 505px block of cards and then again as a list underneath it, with the same
counts in different words. Filed as FB-186. This is the clearest case yet of the thing this
scorecard says about itself — height found a screen showing too much, and only the picture said
what.

**Tickets was the worst screen, at six to eight times its design. FB-185 fixed it** — 6,864px to
1,471px on desktop, 8,008px to 1,470px on a phone.

The ticket predicted one cause and there were two.

The predicted one was right and was the larger: the screen opened on **All**, which is every ticket
the venture ever had — 80 on ARCA, 37 of them finished — against a design that opens on **Needs you**
(`filter: 'needs'` in the wireframe's own state, twice). That is one line, and it took desktop from
7,123px to 2,967px.

The second was not in the ticket. The detail pane **rendered the whole ticket file**, at the global
heading sizes, in a column beside the list: `Context`, `Scope`, `Out of scope`, `Acceptance
criteria`, research bullets carrying full URLs. ARCA-068 is 1,730px of that on its own, sitting
directly above the box where a founder approves the work. The design's ticket detail is the opening
of the ticket and then the decision — it shows no scope list anywhere. So the opening is shown and
the rest is one press away behind **Read the whole ticket**, and nothing is removed.

A third thing the height could not have found, and the picture did: on a phone the two columns
stacked, so the screen showed the whole queue *and* the full text of whichever ticket it had selected
by default underneath it. Opening a ticket then meant scrolling past all eighty to reach it. The
design's phone treatment is one column at a time, and it is now one column at a time.

**How the after numbers were taken.** The before numbers are production. The after numbers are a
local production build running on production's own configuration and reading the same live GitHub
data — ARCA's real 80 tickets — because the change is not deployed until it merges. Same data, same
build, different host. Re-confirm on production once it has deployed.

**The pocket studio shows two sections the design does not have on a phone.** The design's own
description is exact: *"The same events, one column: the blocker banner, the live office, the queue,
the prompt."* Four things, about 600px. Ours has those four (85 + 568 + 668 + 112 = 1,433px, already
more than twice the design's) and then adds `lane-activity` (305px) and `dept-surfaces` (1,031px),
neither of which the design puts on a phone at all.

**Three screens match and should be left alone**: the Composer, a Handbook chapter, and the Handbook
on desktop. The Composer matching matters — it is the screen with the most behaviour on it.

**"What happened" was a commit log and is now an account. FB-180** took it from 3,556px to 1,487px
on desktop and 6,536px to 2,910px on a phone, and the height was the smallest part of it. All six
faults the audit named are gone: twenty identical rows are one row with a count, slugs read as
`ARCA-061, saved card lists not persisting`, commit prefixes and pull request numbers are stripped,
a push and its pull request are one row, dates are `Today 00:57 / Yesterday / 27 August` with the
calendar date still on the row for anyone who needs it, and the meta column names `Build — Product`
rather than `arca`.

Two things came out of reading it that the ticket had not named. The meta column was saying the
meaning as well as the surface — `Build — Product · shipped` — which the sentence beside it already
said, and the width that cost wrapped eleven of twenty rows onto a second line. And the summary's
`Most recently: A, B and C` names the three items that are the first three rows directly beneath it.

**Sign in matched its design exactly on height and was wrong about almost everything else.** One
screen, no scroll, 1,000px and 851px on both sides — identical numbers, before and after FB-189
changed the wordmark, the heading size, the fields, the second button, the divider and the footer.

That is the sharpest thing this scorecard can say about itself. A number that agrees with the design
is not evidence the screen does. This one was never compared because it fits on a screen, and fitting
on a screen was never the question.

What was wrong: the wordmark was `Bruntsfield` at 21.6px with no rule, against the design's 24px
`BRUNTSFIELD` over a hairline; the heading was 56px against 32px, so the page shouted the verb and
whispered whose studio it is; the fields were boxes where the design draws underlines. The product
also carried **two wordmarks** — the rail in caps, the top bar and this page in mixed case. It
carries one now.

**The pocket studio carries the four things the design names, and the rest is one press away.**
FB-160 took it from 4,221px to 2,745px at 390×844. What came off is what the design does not put on
a phone: the surfaces block, what the team has been doing, the desk summary and two header lines.
What stayed is everything a founder can act on — including "Where things stand", which names the
ticket that is stuck, and which appears nowhere else on that screen.

Two faults there that the height had not shown. The venture's **name** was rendering after the
prompt bar, because everything the pocket order does not name falls to `order: 5`. And the queue rows
put the title and `waiting 34 days Decide →` side by side in a 345px column, so every title wrapped
to three lines.

**Every screen with a rail was drawing a 1,080px design into a 766px column. FB-188 gave it the
width back.** The rail sits inside the element the 68rem measure was set on, so 68rem was the rail
plus the content and the content got 766px — 29% under the figure the stylesheet's own comment says
it is aiming at. The measure now covers the rail, the column is 1,078px against the design's 1,080px,
and five screens came down at once with no content removed from any of them:

| | before | after |
| --- | --- | --- |
| The desk | 2,603px | **2,395px** |
| Tickets | 1,471px | **1,202px** |
| a ticket | 1,508px | **1,202px** |
| What happened | 1,487px | **1,264px** |
| Memory | 1,134px | **1,096px** |

That is the desk under the 2,500px target FB-186 could not reach, and it was never about the desk's
content.

**Two things the sweep found that the audit had not.**

*Every handbook chapter scrolled sideways on a phone.* FB-153 found that `.ticket-body` was a class
name with no rule behind it, so a long URL pushed the page sideways; it fixed that class and did not
look at `.playbook-prose`, which was the identical case. Chapter one carries an ASCII diagram 644px
wide in a 393px window, and the page moved with it. The same four rules are on both classes now.

*This scorecard's "a chapter — 1,188px — matches" was wrong.* Every real chapter is thousands of
pixels: 3,318px for the shortest and 16,198px for the longest. Nothing measured 1,188px. A chapter is
long-form reading and its length is not a fault — but the line said the studio matched its design on
a screen nobody had actually measured.

**The desk stated its surfaces twice, and FB-186 made it once.** 2,912px to 2,603px. The second
block repeated the three names, the three repositories and the three ticket counts already on the
cards above, in different words, and every figure in both was correct — which is why nothing caught
it and only looking did. Each card was also saying its own ticket count twice, once in its outcome
sentence and again beside the door.

**And the rest of the desk's height is not duplication at all.** The content column beside the rail
is **766px**; the design's is **1,080px**. Ours is 29% narrower, so every sentence wraps sooner and
every block is taller — on every screen with a rail, not just this one. The stylesheet says it meant
to give the content about 1,080px, and the measure it uses includes the rail, so it does not. Filed
as FB-188, because one line there moves every screen and each one needs looking at again.

That is worth stating on a scorecard about heights: **several of these numbers are partly a column
width, not the content on the screen.**

**Memory was listing scaffolding as knowledge. FB-181** took it from eleven rows to five, and the
five are the five a founder actually handed over or their team learned. Six of the eleven were
`context/README.md` and `library/README.md` — the files committed when the corpus directories were
created, one per repository — on a screen whose own sentence is *"Everything you have handed over or
your team has learned"*. `wealthcx01` no longer appears in a column headed **From**, and every row
names its surface.

The screen's own summary told the truth about this the moment the readmes went: *"11 documents — 8
pieces of background, 3 artifacts"* became *"5 documents — 5 pieces of background"*. **All three
"artifacts" were readmes.** ARCA's `library/` holds nothing yet, and the screen had been saying
otherwise.

One thing worth recording, because only looking found it: the first fix keyed each row's surface off
its **repository**, which relabelled `context/sell/brand-positioning.md` as *"Build — Product"* —
it is a Sell document kept in the product repo. That replaced something true with something false,
on the screen whose whole complaint was rows that mislead. The document's own path wins now, and a
test pins it.

**The Handbook's "phone unexplained" was three wrong things in one line, and FB-190 unpicked them.**

It is not a page of prose. It is nine chapter cards in a 3×3, and three across becomes one across on
a phone — nine stacked cards are *expected* to be taller. Growing 62% is less than the change in
columns would suggest, not more.

The desktop number is not the content. The cards end around 660px; the page measures 1,096px because
the rail sets the floor. The comparison was a card grid against an empty space.

And the phone had nothing to compare against. The design bundle is a fixed-width prototype — at 393px
it still draws the 250px rail and the three-column grid, crushed. Its "phone" reading is the desktop
layout squeezed, not a phone design. **The design has no phone handbook.**

There was no phone defect. What there was, at both sizes, is that the design draws the chapter index
as **one block with hairline rules between the cells** and ours drew nine separately bordered cards
with gaps. That is fixed, and the phone came down to 1,581px — eight gaps and eighteen borders the
design does not spend.

**Sign in was never compared.** It is the one screen a founder sees before they trust anything, and
it is not in this table because I did not do it.

## FB-203, items 1–6: the top half of the desk

Read on **2026-09-08** at 1440×1000 and 393×851, twice: first on the fixture server while the work
was in progress, then on production once it had merged and deployed, signed in as ARCA's founder
against its real 73 tickets.

| | desktop | phone |
| --- | --- | --- |
| The desk, on fixtures, before merge | 3,050px | 3,449px |
| **The desk, on production, after merge** | **2,370px** | **2,753px** |
| The desk, on production, before this | 2,395px | 2,745px |

Sideways scroll: **0px, at both sizes, on both.**

The desktop came down 25px and the phone went up 8px, which is the honest answer: **items 2 to 6
were not about length.** They removed a heading, a pill, a sentence, a box and three links, and
added a description, a second banner row and the drawn empty state. What changed is what a founder
reads first — the venture's purpose and the two things waiting, rather than their own venture's
name. The desk is still 470px longer than the design's ~1,900, and items 7 to 13 are where that
closes.

The fixture numbers are in the table because they are what the work was checked against, and they
are **not comparable** to the production ones — fixtures carry three tickets, production carries
seventy-three.

**Looking found two faults that every gate had passed.**

The first is the one this rule keeps catching. On the phone, the blocker banner kept "Decide now →"
in its place at the right of the row, which left the sentence a column about fifteen characters
wide, and one banner ran **twelve lines down a 393px screen**. Lint, types, 1,596 unit tests and 284
browser tests were green: the banner was present, correct, linked, and in the right place. It was
also unreadable. The action now drops beneath the sentence below 30rem, and `pocket.spec.ts` asserts
the sentence gets more than 60% of the box — a proportion rather than a pixel count, so it keeps
holding as the copy changes.

The second only appeared because the first was wrong. The fix gave the sentence a full-width flex
basis, which pushed the **square marker onto a line of its own** — a small block floating above a
paragraph, reading as decoration rather than as a mark against the text. `flex-basis: 0` on the
sentence keeps the two together. Neither of these is a thing a test would have been written for.

A third fault was found by re-reading the ticket against the picture rather than by looking alone.
The stuck line was drawn in the studio's blocked tone, which is red — and item 5's complaint about
the box that line came from is precisely that *"its bold red underlined links are the loudest thing
on the page"*, followed by *"the design has no red at all."* The row is amber now, the same as the
banner above it; the two differ in what they say and where they go, not in colour.

One picture also lied, and it is worth writing down. The phone screenshot came back with the banner
in a green tint instead of its warm ground, because the login click had left the virtual pointer
resting on the banner and the screenshot caught its `:hover` state. Chasing it turned up something
real anyway: on a touch screen there is no un-hover, so a tapped banner would have kept that tint
after the founder came back from the queue and read as still selected. The hover is now behind
`@media (hover: hover)`, and the screenshot script parks the pointer before it fires.

## FB-203, items 7–9: the office, its ledger, and the run history

Read on **2026-09-08** at 1440×1000 and 393×851, on fixtures — the production reading follows when
this merges and deploys, as it did for items 2–6.

| | desktop | phone |
| --- | --- | --- |
| The desk, on fixtures, after items 2–6 | 3,050px | 3,449px |
| **The desk, on fixtures, after items 7–9** | **2,855px** | **3,193px** |

Sideways scroll: **0px at both sizes**, and 0px on the phone in `?full=1` as well, which is where the
run history is shown.

**Looking found three things.**

The first was a sentence that was not true. The design puts "LIVE FROM ARCA’S MACHINE" beside the
section heading, and built there it printed *"Live from your venture’s own machine"* directly above
the **stand-in drawing** — whose own note, two lines below, says *"This is a stand-in."* The label was
driven by `office.live`, which means the box is sending run reports; whether the real room is on the
screen is a different question, and only `OfficeEmbed` knows it. The label moved there. A label that
can be wrong about the thing beneath it is worse than no label at all.

The second: `48 days ago` wrapped onto two lines in the design’s 76px time column, leaving every run
with a ragged stub in its first column. The design’s example runs were hours old; ARCA’s fixtures are
seven weeks old and its production runs are older still. 92px.

The third: the outcome square was vertically centred in its row, so on any run whose sentence wrapped
it drifted down and ended up marking the second line. It sits on the first line’s baseline now.

**And one fault that a picture could not have found, only reading the code.** The ledger lived inside
`OfficePlate`, which is the **fallback** — the drawing shown when the real office cannot be. So on
every venture whose embed worked, the ledger was not rendered at all, and the half of this pairing a
screen-reader user gets was the half that vanished exactly when the venture was healthiest. Nothing
on the screen said so, because on fixtures the embed never loads and the plate always renders. It is
its own component now, outside the fallback, and a test asserts it is not a descendant of it.

## FB-203, items 7–9 on production, and the fault only production had

Read on **2026-09-08** at 1440×1000 and 393×851, signed in as ARCA's founder.

| | desktop | phone |
| --- | --- | --- |
| The desk, after items 2–6 | 2,370px | 2,753px |
| The desk, after items 7–9 | 2,434px | 2,562px |
| **The desk, after both corrections below** | **2,457px** | **2,562px** |

No sideways scroll at any of those readings. The phone came down 191px and the desktop went up 87px.
That is the honest shape of this work: the room and the ledger now share a row, so the section is as
tall as the room rather than as tall as both, and on the phone the run history stands down entirely —
while the desktop paid for a section heading, a rule, and two sentences that were not there before.
The desk is still about 550px longer than the design's ~1,900. Items 10 to 13 are where that closes.

**The live label was checked in both directions and is right in both.** On the desktop the real room
renders, the stand-in is absent, and the label is shown. On the phone the embed stands down by design
(FB-163 — pixel-agents draws its room at a fixed scale and a phone would show a corner of a floor), so
the stand-in renders and the label is correctly **not** shown.

**And then the number that fixtures could never have produced:**

> Showing the 1 most recent of 3459 runs.

One row. ARCA has 3,459 run reports and every one of them is the same park, so `collapseRepeats`
merged the whole history into a single line. Item 8 asked for the `×20` repeat tag to go, it went, and
with it went the only thing on the screen saying this venture had been stuck in one place for seven
weeks — which is the most important fact this section could carry. The tag stays gone and the fact is
in the row now, in words: *"the same thing 3,459 times"*.

This is the clearest case yet for the rule that says **production, not fixtures**. The fixtures have
six runs, all different. Every gate was green. The screen was rebuilt, looked at, measured, and
shipped, and the defect was in the one place a small dataset cannot reach.

**The correction needed correcting, and again only production showed it.** The new clause read *"the
same thing 20 times"* above *"1 most recent of 3,461 runs"*, because the studio reads twenty reports
and counts the rest by name — the count can never exceed twenty however long a venture has been stuck.
It now says *"every one of the last 20 runs says this"*, which is what the studio actually knows. The
logic moved into `lib/runreports.ts` so the branch has unit tests, because a venture with 3,461 runs
cannot be built as a browser fixture — the same reason the fault reached production in the first
place.

The same reading turned up **FB-205**: the most-repeated sentence in ARCA's history renders as *"Daily
your team budget reached"*, because FB-103's `lane → your team` rule cannot tell a lane that acted
from a lane describing a budget.

## FB-203, items 10–13: the queue, the surfaces, the rail and the type

Read on **2026-09-08** at 1440×1000 and 393×851 on fixtures; the production reading follows the
merge, as it did for the earlier items.

| | desktop | phone |
| --- | --- | --- |
| The desk, after items 7–9 | 2,855px | 3,193px |
| **The desk, after items 10–13** | **2,220px** | **2,611px** |

No sideways scroll at either size, nor on the phone in `?full=1`. Tickets reads 1,167px and the
Handbook 1,000px with the lighter headings.

**The cap nearly hid a whole kind of decision.** Capping "Waiting on you" at four rows is the design's
instruction, and the queue is ordered by kind — external sends first, because nothing leaves the
company without one (FB-183). ARCA has six sends. So the cap showed four sends and **every piece of
finished work fell off the desk**, including the pull requests the amber banner had just counted, on
the screen that banner sends a founder to. The browser gate caught it; a founder would have caught it
by wondering where their work went. `deskQueue` reserves the last row for whichever kind the cap would
otherwise erase.

**And the phone read as two layouts.** A long reference like `changed-proposal` took the full width
and pushed its title down, while `ARCA-1` sat beside its own — so the same list looked different
depending on how a ticket happened to be named. The reference takes its own line always.

**Item 13 found two real deviations after every colour already matched.** Headings were `font-weight:
500` against the design's 400 — a serif carries its weight in its own shapes, and half a step extra
reads as a slightly wrong font rather than as emphasis. And three rounded corners had survived: two
50% dots and a textarea. The design has no border-radius anywhere.

**Two parts of item 12 are not built, and the scorecard should say so rather than imply the screen
matches.** The rail has no pocket-studio link, because the pocket studio is not a route — it is what
the desk becomes on a phone, and the rail is hidden there, so the link could only ever be pressed
where it does nothing. And the rail has no office thumbnail: half its sentence duplicates the Needs
you badge three rows above, and the other half needs a run report per surface, which is the read
FB-164 removed when it was costing every screen under a venture about six seconds.

## FB-203, closed — the desk on production, 2026-09-08

All thirteen items merged and deployed. Read as ARCA's founder against its real 73 tickets and 3,461
run reports, at 1440×1000 and 393×851.

| | design | desktop | phone |
| --- | --- | --- | --- |
| Before FB-203 | ~1,900px | 2,395px | 2,745px |
| **After FB-203** | ~1,900px | **1,984px** | **2,228px** |

**84px from the design, with no sideways scroll at either size.** The screen this scorecard opened on
was **9,908px**.

What the thirteen items actually cost, in the order they were worked:

| after items | desktop | phone |
| --- | --- | --- |
| 1 (the shell) | 2,395px | 2,745px |
| 2–6 (the top half) | 2,370px | 2,753px |
| 7–9 (the office and the record) | 2,434px | 2,753px |
| 10–13 (the queue, surfaces, rail, type) | **1,984px** | **2,228px** |

The middle two rows are the honest part of that table: items 2 to 9 barely moved the number, because
they were not about length. They changed what a founder reads first and put three sections in the
shape the design draws. The height came out of items 10 and 11 — a capped queue and three columns
where there had been bordered cards.

**Six faults reached this screen that every automated gate passed**, and each was found a different
way. Four by looking: a banner twelve lines tall on a phone; a marker floating above a paragraph; a
"live from your machine" label printed over a stand-in drawing; a queue that read as two layouts
depending on how a ticket was named. One by reading code: the ledger living inside the fallback, so it
vanished on every venture whose office actually worked. And one only production could show: 3,461 runs
collapsed to a single row, twice — once when the count disappeared, and again when the corrected count
said 20 above a footer saying 3,461.

The fixtures have six runs, all different. That is the whole argument for rule 11's "measure
production" in one line.

## The second review — Claude Design, 2026-09-08

Read against `main` after FB-203 closed, from the code and the docs rather than from the live route
(which sits behind sign-in). The artifact:
`https://claude.ai/code/artifact/a9532879-0dbf-4273-9893-8c79cd74e202`.

**Its verdict: *"the desk is the design. Four of the five rules hold. One does not, and the screens
FB-203 did not touch carry the rest."***

| rule | verdict |
| --- | --- |
| 1 · Decided → What happened only | **Not held** — the desk still renders two ApprovalCard sections |
| 2 · Waiting items are rows | Held — two leaks: Memory's routines, and those same two sections |
| 3 · Outcomes, not counts | Held — *"Nothing invented."* |
| 4 · Office is the pixel-agents embed | Held — *"Better than the design asked."* |
| 5 · Every ticket has a terminal trace | **Partly** — the "Follow it to…" line above the decision is not rendered |

**All four of FB-203's deviations were accepted**, including the two parts of item 12 that were not
built (*"a control that works nowhere it is shown is a dead control"*), the vocabulary changes
(*"Binding"*), and the stale clause. The wireframe was updated to match our vocabulary rather than the
other way round.

Twelve findings, filed as seven tickets in the reviewer's own order:

| | ticket | what |
| --- | --- | --- |
| R-01 + R-11 | **FB-207** | decided work leaves the desk, once What happened can prove it was signed |
| R-06–R-08 | **FB-208** | the tickets screen against its design |
| R-05 | **FB-209** | the conversation on a ticket has nowhere to be read |
| R-02 | **FB-210** | squares, not glyphs, everywhere |
| R-03 | **FB-211** | amber for a decision, red only for a fault nobody can clear |
| R-09 | **FB-212** | Memory's routines are still cards |
| R-10 | **FB-213** | a surface's "open the queue" opens everybody's queue |
| R-04 | FB-184 | already open; restated with the exact copy and placement |

The order is the reviewer's: *"R-01 with R-11 first (they unblock each other), then Tickets
(R-04–R-08), then R-02 across every screen, then Memory."*

**R-01 and R-11 are one ticket for a reason the code already knew.** The desk's own comment, written
when the first instruction to move those sections arrived, says they stayed because *"it is the only
place a founder can see whether a COMPLETED approval's signature was genuine"* — and the reviewer's
R-11 says the same thing from the other side: *"This is what kept R-01 on the desk."* Giving What
happened the attestation is what unblocks the deletion.

## FB-207, and a screen production cannot yet show

Read on **2026-09-08**, after merge and deploy. **The change is not observable on production, and
that is the finding rather than a caveat.**

ARCA has **no decided approvals at all**. Every external action on it is still `proposed` — waiting in
the queue for a founder's yes — so What happened has **zero decision rows**, and there is nothing for
the attestation clause to attach to. The desk's two `ApprovalCard` sections were never rendering
there either, for the same reason: they only appear once something has been granted.

So the section that was defended twice, on the grounds that it was the only place a forged grant would
be visible, has never had anything in it on the live studio. The defence was still right — the first
approval ARCA grants would have put a completed decision on that desk and nowhere else — but it is
worth writing down that the fault it guarded against was latent, not live.

Where it *is* proven: the fixture rig, which now carries `executed-forgery` — a grant the studio did
not issue, which the executor acted on. That case had **no fixture before FB-207**, because the two
existing adversarial grants have no execution record and are therefore `proposed`, which is a queue
item and not history. It is the row pinned to the top of What happened on the rig, in amber, saying
its signature did not verify.

| | desktop | phone |
| --- | --- | --- |
| The desk, on production | **1,984px** | — |
| What happened, on production | **1,218px** | — |

Unchanged from the FB-203 reading, which is the expected result of deleting two sections that were
not rendering.

## FB-208 — the tickets screen, 2026-09-09

Read at 1440×1000 and 393×851. On fixtures **1,137px** and **1,059px**; on production, against
ARCA's 80 real tickets, **1,325px** and **1,600px**. No sideways scroll at any of them. The design is
1,090px.

The 235px between the fixture reading and production is almost entirely **title wrap**: ARCA's tickets
are named things like *"Research: which auction houses we can realistically pull live listings from"*,
which takes four lines in a list pane about 450px wide. The design's list had short titles. Nothing is
repeated and nothing is decorative — the screen is as tall as the sentences a founder actually wrote,
which is the right thing for it to be as tall as.

Tabs are text on a hairline now rather than four buttons — which had made the four most button-shaped
objects on the screen the ones that only narrow a list, beside a detail pane whose buttons merge
finished work into a founder's product. The row is title, then `ref · surface`, with the wait pushed
right in amber; status left the row because status is what the filter already selects, and progress
moved into the detail's eyebrow.

**"Proven" said the same thing about every ticket whether or not it was true.** It now reads
`ciStatus` — the same field the work page reads, so the two screens cannot tell a founder different
things about one piece of work — and it tells two silences apart: *"the studio could not read this
venture's checks"* is not *"no checks are recorded against this work"*, and neither is *"they passed"*.

**One part of R-08 cannot be built yet, and it is worth saying why.** It asks for *"Unchanged since you
last read it"*. The studio does not remember when a founder last read anything: `headSha` is the commit
at page render, and `acceptWork` compares it at accept time to refuse work that moved underneath a
decision. Comparing it to itself on render would always say "unchanged". A per-founder read record is a
store the studio does not have, and inventing the sentence without it would be the same fault the
ticket is about.

## What this scorecard cannot tell you

Height finds a screen showing too much. It cannot find a screen showing the *wrong* thing at the
right length, wrong copy, wrong order, or a control that does not work. Every one of those has been
found here by reading the picture, and three of them — the desk's finished-ticket board, "What
happened" printing one sentence twenty times, and Memory listing README files as founder knowledge —
passed every automated gate in the repository.
