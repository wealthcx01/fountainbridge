# GRS-0044 — Assessment wizard integrity: band honesty + autosave race

- **Loop:** 2 (Wizard Path A)
- **Status:** Fixed — found in the 2026-07-14 adversarial frontend review.
- **Severity:** High — a two-track honesty violation shown to advisors, plus an autosave race that
  can display a stale score and write after unmount.
- **Normative source:** ATLAS Methodology v1.2 §7 / ADR-0008 (honest bands); CLAUDE.md #7
  (two-track: words rate, numbers rank — a false range is a fabricated confidence interval).

## Problems

1. **False confidence interval (HIGH).** The always-on side-rail `LiveSummary` hand-formatted
   `live.v.p50` / `p10` / `p90` as a range without checking `modelled`. For an unmodelled V (the
   backend collapses p10=p50=p90 and flags `modelled=false`), the advisor saw e.g. `50.0 (50.0–50.0)`
   — a falsely-confident interval the methodology forbids — while the Summary panel (which uses
   `BandDisplay`) correctly showed a labelled point. The two disagreed.
2. **Autosave race / post-unmount writes (HIGH).** `refreshLive` and `persist` ran with no
   `AbortController` and no mounted guard; the debounced `saveTimer` was never cleared on unmount.
   Rapid edits fired overlapping `liveScore` requests that could resolve out of order (stale score
   shown); editing then navigating away within the debounce window fired a save + `setState` on an
   unmounted component.
3. **No 401 handling on refetch/mutation (MEDIUM).** Only the initial load redirected on 401; every
   refetch/mutation (wizard live-score & save, pipeline reload, engagement reload) left an expired
   session stuck on a permanent error banner.

## Change

- `LiveSummary` renders V through `BandDisplay` (the single tested honesty decision point) — an
  unmodelled band is a labelled point, never a range.
- The wizard tracks a mounted ref and aborts the previous in-flight live/save request when a new one
  starts (out-of-order responses can't win); the autosave timer and both controllers are torn down
  on unmount.
- A shared `handleAuth` redirects to `/login` (clearing the token) on any 401 — wizard, pipeline,
  and engagement refetch paths.

## Exit criteria

- `LiveSummary` shows a point for an unmodelled V and a range for a modelled one — pinned by
  `LiveSummary.test.tsx`.
- Type-check, lint, and build are green; the band-honesty guarantee lives only in `BandDisplay`.
