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
| The desk | ~1,900px | 3,830px | 4,221px | gap: the approval cards (FB-183) |
| Tickets | **1,090px** | **6,864px** | **8,008px** | **worst gap in the studio** |
| a ticket | — | 6,864px | **8,859px** | as above; the detail sits on the list |
| What happened | ~1,000px | **3,556px** | — | FB-180 |
| Memory | ~1,000px | 1,570px | — | FB-181 |
| Composer | ~1,000px | 1,096px | 990px | **matches** |
| Handbook | 1,000px | 1,096px | 1,782px | matches on desktop; phone unexplained |
| a chapter | ~1,000px | 1,188px | 899px | **matches** |
| The pocket studio | ~600px | — | 4,221px | FB-160 |

No screen scrolls sideways at either size. That was not true two weeks ago (FB-153, FB-124).

## What the numbers turned out to mean

**Tickets is now the worst screen, at six to eight times its design.** The design's Tickets is
1,090px — a filtered list. Ours renders every ticket the venture has ever had, finished ones
included, and the detail pane sits on the same page, so "a ticket" is the same 6,864px.

This is worth stating plainly because FB-178 made it more important, not less: the desk's board was
removed on the grounds that Tickets is where the queue lives. It is — and it is the least
design-conformant screen we have. The likely cause is the default filter; the design shows open work
and ours appears to show everything.

**The pocket studio shows two sections the design does not have on a phone.** The design's own
description is exact: *"The same events, one column: the blocker banner, the live office, the queue,
the prompt."* Four things, about 600px. Ours has those four (85 + 568 + 668 + 112 = 1,433px, already
more than twice the design's) and then adds `lane-activity` (305px) and `dept-surfaces` (1,031px),
neither of which the design puts on a phone at all.

**Three screens match and should be left alone**: the Composer, a Handbook chapter, and the Handbook
on desktop. The Composer matching matters — it is the screen with the most behaviour on it.

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
