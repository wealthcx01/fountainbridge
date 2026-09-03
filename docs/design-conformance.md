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
| Sign in | one screen | — | — | **not compared** |
| The desk | ~1,900px | **2,395px** | **4,393px** | rows not cards (FB-183), one block (FB-186), full width (FB-188) |
| Tickets | 1,090px | **1,202px** | **1,470px** | fixed FB-185, widened FB-188 (was 6,864 / 8,008) |
| a ticket | — | **1,202px** | **1,945px** | fixed FB-185, widened FB-188 (was 6,864 / 8,859) |
| What happened | ~1,000px | **1,264px** | **2,836px** | fixed FB-180, widened FB-188 (was 3,556 / 6,536) |
| Memory | ~1,000px | **1,096px** | **1,988px** | fixed FB-181, widened FB-188 (was 1,570 / 2,881) |
| Composer | ~1,000px | **1,096px** | 1,142px | **matches** |
| Handbook | 1,000px | **1,096px** | **1,760px** | matches on desktop; phone still unexplained |
| a chapter | ~1,000px | **3,318–16,198px** | — | **the 1,188px reading was wrong** — see below |
| The pocket studio | ~600px | — | **2,745px** | **fixed, FB-160** (was 4,221px) |

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

**Handbook is 1,782px on a phone against 1,096px on desktop.** A page of prose should get *shorter*
in a narrower column only if the type scales; growing by 62% suggests something is not reflowing.
Unexplained, and worth ten minutes.

**Sign in was never compared.** It is the one screen a founder sees before they trust anything, and
it is not in this table because I did not do it.

## What this scorecard cannot tell you

Height finds a screen showing too much. It cannot find a screen showing the *wrong* thing at the
right length, wrong copy, wrong order, or a control that does not work. Every one of those has been
found here by reading the picture, and three of them — the desk's finished-ticket board, "What
happened" printing one sentence twenty times, and Memory listing README files as founder knowledge —
passed every automated gate in the repository.
