# FB-226 — give non-negotiable 11 a mechanism

**Status:** Done · **Phase:** 3 · **Ruled by:** John, 2026-09-29 (D12) — *"compare screenshots is a
great find - good work, implement it"* · One ticket = one branch = one PR.

## Why

Non-negotiable 11 says look at the screen beside its design before the pull request. Until now that was
enforced by somebody remembering to do it, and the cost of its absence is the most expensive thing that
has happened on this project: **thirty tickets shipped with every gate green while the desk was 9,908px
against a design of ~1,900.**

D13 supplies the principle that applies here too: *"'date every entry' was followed 10% of the time as a
prompt and 94.7% once a script did it. Anything that must happen every time needs a mechanism, not a
sentence."*

This is the mechanism.

## What was taken, and from where

`visual/compare-screenshots` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT). **The framing is
theirs and it is the reason this was worth taking:**

> Decide which image is **less wrong** against what the scene should show — not whether the candidate
> matches the baseline. The baseline is just an earlier attempt; it can be wrong too.

Their script assumes a `web/` subdirectory and resolves its dependencies from there. This repo is flat,
so **the thinking is theirs and the file handling is ours** — an adaptation, not a copy.

Their "stop and ask the user when the right answer is not clear" is kept verbatim in spirit, because it
is already how design gaps are handled here.

## What shipped

- **`scripts/visual-metrics.mjs`** — the judgement, pure and tested: flatness, coverage, framing, pixel
  delta, and the words a reviewer is given. No file reading, so the part that can be wrong is the part
  with tests.
- **`scripts/visual-parity-diff.mjs`** — the I/O. Two modes: measure each capture alone (do this first),
  or pair by filename. Writes a side-by-side, a difference heatmap, `reading.md` and `metrics.json`.
- **`.claude/skills/compare-screenshots/SKILL.md`** — so an agent reaches for it instead of relying on
  memory. Carries the workflow for non-negotiable 11, what each number means, and what the tool will
  not do.
- `pngjs` and `pixelmatch` as devDependencies.

## It is not a gate, deliberately

The Playwright UI gate is the required check. **This is a measuring instrument for a person.** It never
passes or fails anything, and every output ends by sending the reader to look at the pictures — asserted
by a test, because letting a number stand in for looking is the exact failure it was written to prevent.

`readingFor()` is also tested to never contain the words pass, fail, ok or correct.

## Two things found by running it on real captures

Both were found because it was run against this repo's own 34 screenshots rather than only against
fixtures.

1. **The first threshold was wrong.** Flagging on `trailingEmptyFraction > 0.25` marked
   `03-not-authorized` and `06-venture-forbidden` as problems. They are error pages: ~400px of content
   in a 720px viewport is 44% empty and completely fine. **The fraction alone cannot tell a short page
   from the 9,908px desk; only the absolute tail can.** It now flags over 600px — about one screen of
   nothing — and the error pages stopped tripping it while nothing real started.
2. **A real limitation, now recorded rather than left to be rediscovered.** A frame more than half ink
   reports the ink as background, so its coverage reads near zero. Every capture here is 2–5% content so
   it does not bite, and a test holds the property.

A fixture bug was found the same way: "a page that fills its frame" was written as 100% dark rows, which
is a single flat colour and correctly flagged. The code was right and the fixture was not.

## Acceptance criteria

- [x] One capture can be measured with no counterpart, and says whether it is flat, empty or badly
      framed.
- [x] A pair produces a side-by-side, a difference heatmap, and a reading in words.
- [x] Differing sizes are reported with the height ratio rather than throwing — a differently-sized
      capture is usually the finding.
- [x] Nothing it outputs says pass, fail, ok or correct, asserted by a test.
- [x] Every output ends by telling the reader to look at both pictures, asserted by a test.
- [x] The skill tells an agent to stop and ask when the right answer is not clear, rather than
      defaulting to either side.
- [x] Run against this repo's real 34 captures, and the false positive it found is fixed.
- [x] 1,701 unit tests pass.

## Out of scope

- Making it a CI gate. It measures; it does not decide.
- Capturing the design side automatically. The artifact needs a sign-in click-through, which is FB-217's
  neighbourhood and its own ticket.
- Cross-viewport comparison. A desktop and a phone capture are different scenes.
- The rest of `dzhng/skills`. `launch-video` and the research skills are D12's other tickets.

## Verification

No studio screen changed — this adds an instrument, it does not touch a page. Non-negotiable 11 does not
apply to this PR, said rather than left blank.

Proof it works on real data is in the ticket above: 34 captures measured, one false positive found and
fixed.
