# FB-180 — "What happened" is a commit log, not an account of what happened

**Status:** Done · **Phase:** 3 · **Found by:** the FB-175 screen audit, 2026-09-02

## Both sides, rendered at 1440×1000 and read

| | design | live |
| --- | --- | --- |
| page height | ~1,000px (one screen) | **3,556px** |
| rows | 6 | 40 |
| the first 20 rows | six distinct events | **the same sentence, twenty times** |

The design's rows, verbatim:

```
Today 08:00   ARCA-12 picked up by your Build lane; 2 commits so far      Build · Product
Yesterday     ARCA-14, bulk daily price feed, filed from your conversation Build · Product
Yesterday     Stopped: ARCA-8, onboarding flow; 3 attempts, reason on file Build · Product
Monday        ARCA-11, the September investor email, approved by you and
              sent to 41 investors                                         Sell · Marketing
Monday        ARCA-16, first paid campaign, stopped at the gate: no ad
              account connected                                            Scale · Growth
Monday        3 competitor pricing notes added to what Arca knows          Research
```

Ours:

```
2 September 2026  Stopped on ARCA-061-saved-card-lists-not-persisting and needs
                  you: Daily your team budget reached — parked until tomorrow.   arca · your team
   … that exact row, nineteen more times …
27 August 2026    build: ARCA-062-arca-brand-redesign (Foundry lane) ↗           arca · shipped
27 August 2026    ARCA: ARCA-062-arca-brand-redesign (worked by the Foundry
                  lane) (#80) ↗                                                  arca · changed
```

**Earlier slice.** The six faults below were fixed, but the folding-in of the desk's "Decided" rows
was held back by PR #215, because that section was the only place a founder could see whether a
past approval's signature was genuine. FB-207 then moved it here with the signature clause intact,
and FB-183 gave each send its own page, so that scope line is done.

## Finished, 2026-10-01: the page now tells the story, not the last hour

**What was still wrong, seen on ARCA's real data.** Every box below could be ticked and the page was
still not an account of what happened. It showed **two lines**. ARCA has written 10,198 reports since
31 July, and the studio opened the newest sixty — which were all one ticket, ARCA-061, re-parked
every five minutes because the daily budget was used up. Sixty copies of one sentence collapsed to
one row ("20 times"), and five weeks of finished work sat behind it, unreachable.

**What changed.** A report's ticket and time are in its file name, so the studio can see the whole
history's shape without opening anything. It now groups the history into **stretches**: an unbroken
run of reports about one ticket. ARCA's 10,198 reports are 40 stretches — the 9,737-report park is
one of them. "What happened" opens the newest report of each stretch (the same sixty-file budget as
before) and shows one line per stretch. A long stretch says how big it was: *"the latest of 9,737
reports on this since 27 August 2026"*. It does not say they all said the same thing, because only
the newest was read. The desk is unchanged; it still reads the newest reports, which is right for
"what is happening now".

The page shows twelve lines, down from twenty, which reaches back to 26 August on ARCA. The
sentence above the list says that each line is one stretch of work, and that older entries are
still in the venture's records.

**Also fixed.** A decided send was labelled by the repository it was proposed from, so every ARCA
send read "Build — Product". It is now labelled by the department it names: "Sell — Go-to-market".

**Measured.** ARCA's real data, signed in as its founder: **1,236px** at 1440×1000 (was 1,000px
with two lines) and **2,547px** at 393×851. The UI gate's fixtures: 1,000px and 1,907px.

## Six distinct faults

1. **The same event, twenty times.** A lane at its daily budget re-parks every five minutes and each
   wake writes a record. FB-178 fixed exactly this on the desk with `collapseRepeats`; this screen
   never got it. Twenty identical rows is one fact, and it pushes everything a founder has not read
   off the bottom.
2. **Slugs where titles belong.** `ARCA-061-saved-card-lists-not-persisting` against the design's
   *"ARCA-8, onboarding flow"*. The title is in the ticket file; the row prints the filename.
3. **Commit messages and PR titles, raw.** *"build: ARCA-062-arca-brand-redesign (Foundry lane)"* and
   *"ARCA: ARCA-062-arca-brand-redesign (worked by the Foundry lane) (#80)"* are engineering
   artefacts shown to a founder unedited. Every design row is a sentence about the venture.
4. **One event, twice.** The branch push and the pull request for the same work are two rows. A
   founder reads two things happening.
5. **Absolute dates.** *"2 September 2026"* against *"Today 08:00 / Yesterday / Monday"*. On the
   screen whose whole axis is recency, the design's form is the useful one.
6. **The meta column names the repository.** Ours reads `arca · your team`; the design reads
   `Build · Product`, `Sell · Marketing`, `Research` — the surface and its department, which is the
   vocabulary the rest of the studio already uses (`surfaceOf`).

## Why this one matters more than its size suggests

This is the screen a founder opens to find out whether the thing they asked for is happening. It is
also where Claude Design has just ruled that the desk's "Decided — what happened next" belongs, so it
is about to carry more weight, not less.

And the copy faults are the drift `copy-lint` exists to catch — it passes because these strings are
data, not source. A rule that only inspects the repo's own words cannot see a slug the lane wrote.

## Scope

- Reuse `collapseRepeats` (FB-178, `lib/runreports.ts`) rather than writing a second one.
- Resolve ticket ids to titles, the way the queue does.
- Rewrite the row sentence from the event, not from the commit message. `lib/activity-kind.ts`
  already classifies; the sentence should be built from the classification.
- Fold the push and its pull request into one row.
- Relative dates, with the absolute one available on hover/`title` for anyone who wants it.
- `surfaceOf(repo)` in the meta column.
- Fold in the "Decided" rows Claude Design moved here from the desk.

## Acceptance criteria

- [x] No two consecutive rows say the same thing; a repeat is one row with a count.
      *(One row per stretch, with its size. `lib/__tests__/run-stretches.test.ts` over ARCA's real
      shape, and `e2e/venture-activity.spec.ts` on the rendered page.)*
- [x] No row contains a slug, a branch name, a PR number or the word "lane".
      *(Read on ARCA's real data, 2026-10-01: twelve rows, none.)*
- [x] The meta column names the surface and department, never the repository.
      *(A send is now labelled by its own department, not by the repository it was proposed from.)*
- [x] The page is under 1,500px on ARCA's production data at 1440×1000.
      *(1,236px on 2026-10-01.)*
- [x] A test fails if a row's text matches `/-[0-9]{3}-|\(#\d+\)|Foundry lane/`.
      *(`lib/__tests__/activity-feed.test.ts` and `e2e/venture-activity.spec.ts`.)*
