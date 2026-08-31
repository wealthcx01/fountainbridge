# FB-158 — "What happened" is the one screen still at six seconds

**Status:** Todo · **Area:** Studio / performance · **Depends on:** FB-157

## What was measured

Production, signed in as ARCA's founder, three loads each, landing path checked, median TTFB, after
FB-151 and FB-157:

| Route | Median |
| --- | --- |
| `/venture/arca` | 231 ms |
| `/venture/arca/knowledge` | 230 ms |
| `/venture/arca/tickets` | 227 ms |
| `/venture/arca/handbook` | 230 ms |
| **`/venture/arca/activity`** | **5,986 ms** |

Every screen under a venture answers in about a fifth of a second except this one, which takes
twenty-five times longer.

## Why this matters (for the founder)

A studio where four screens are instant and the fifth takes six seconds does not read as "one slow
page". It reads as *broken* — the founder learns that clicking "What happened" is the thing that
hangs, and stops clicking it. It is also the screen that answers the question the whole product
exists to answer: what has my team actually been doing.

## What is already known

`app/venture/[id]/activity/page.tsx` awaits three reads before rendering anything:

- `loadVentureHealth` — measured at **3,460 ms** on the desk (FB-157)
- `ventureRuns` — **4,268 ms**, the most expensive read in the studio
- `ventureApprovals` — **1,828 ms**

Two of the three are already shared with the rail through `lib/venture-reads.ts` (FB-157), so this is
not a duplicate-read problem. It is the same blocking-render problem the desk had, on the one screen
that did not get the treatment.

Nothing above the fold depends on any of them: the heading and the venture's name are true before a
single read returns.

## Scope

- The same shape as FB-157: a shell that renders immediately, the feed behind `<Suspense>`.
- **No controls in the fallback.** FB-157's lesson: a fallback is not hydrated, so a control there is
  both dead and duplicated in the document while the boundary resolves.
- Nothing renders a value it does not have yet. The feed's summary line is a claim about the venture
  and must not appear until it is true.

## Out of scope

- Making `loadRunReports` itself cheaper. Still the separate question FB-157 named: it reads
  `limit × READ_MARGIN` files per surface, and the rail needs only the heartbeat out of all of it.

## Acceptance criteria

- [ ] `/venture/arca/activity` is under 1s, measured on production with the landing path checked.
- [ ] The feed still arrives, and what it says is unchanged.
- [ ] Exactly one of every control on the screen; no waiting shell left in the document.
- [ ] Nothing in the shell states anything about the venture that has not been read.
