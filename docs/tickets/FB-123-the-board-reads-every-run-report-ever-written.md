# FB-123 — The board reads every run report ever written, one at a time, to show twenty

**Status:** Done · **Area:** Studio / performance · **Depends on:** —

Measured on production before and after, as ARCA's founder, same page, same session:

| | before | after |
| --- | --- | --- |
| load 1 | 42.0s | 15.1s |
| load 2 | 43.8s | 8.7s |
| load 3 | 39.7s | 8.4s |

The first load after a deploy is a cold start; the settled number is **~8.5s, down from ~41s**.
The board renders identically — five cards in Just filed, 26 todo, 8 in progress, 34 done, and
"Showing the 20 most recent of 116 runs" against exactly 116 reports on the refs.

## What a founder gets

Forty seconds of blank page. Measured on production, signed in as ARCA's founder, three consecutive
loads: 42.0s, 43.8s, 39.7s. Not a cold start — `/api/health` answers in 0.3s and `/login` in 1.5s on
the same deployment. It is the board specifically, and it is every time.

Forty seconds is not slow, it is broken. A founder opening their own venture and waiting that long
concludes the studio is down, and they are not wrong to.

## Why

`loadRunReports` (`lib/runreports.ts:154`):

```ts
for (const repo of approvalRepos(venture)) {
  const names = await source.list(repo);
  for (const name of names) {
    const parsed = fromLaneRecord(await source.read(repo, name), repo);
```

One GitHub GET per run-report file, awaited one at a time, for every report that has ever been
written — and then `reports.slice(0, limit)` throws all but the newest twenty away.

Counted on the real state refs: **arca 105, arca-marketing 8, arca-ops 4 — 117 files.** One read
measured at 339ms. `117 × 339ms ≈ 39s`, against a 40s page. That is the whole of it.

Nothing caches it, so every load pays in full.

## The part that matters more than the number

**It grows without bound, and the growth is driven by the lane doing its job.** ARCA had 76 reports
yesterday and 105 today, because FB-121 got the lane working again. Every wake writes another. At
339ms each, every ~3 reports adds a second to every future page load, for every founder, forever.

So this is not "the board is slow". It is a board that gets slower the more the product works, which
will overtake any other performance work anyone does.

## Scope

- Read only what is rendered. The filenames carry sortable timestamps
  (`<slug>-YYYYMMDDTHHMMSSZ.json`, and `_heartbeat.json` for the beacon), so the newest N can be
  chosen from the listing without opening anything.
- Read those in parallel rather than in sequence.
- Keep `total` exact. It says "showing 20 of N" and must stay true — but it can be counted from the
  listing, which costs nothing.
- Keep the heartbeat. It is the only positive evidence a lane is alive (`engineState` depends on it),
  it is one known filename per repo, and it must still be read even when no run report is recent.
- Order by `started_at` as now, not by filename. Filenames record when a report was WRITTEN; the
  display orders by when the run BEGAN, and the two are not the same. Read a margin above the render
  limit so the ordering cannot be wrong at the boundary, and say why in the code.
- Cover it: a repo with more reports than the limit reads a bounded number, not all of them; `total`
  still reports the true count; the heartbeat is present even when it is not among the newest.

## Out of scope

- The other nine sequential awaits on the venture page. They are worth looking at once this is gone,
  but this one is ~39s of the ~40s and the rest is noise until it is fixed.
- Pruning old run reports on the state ref. Bounding the READ makes the count harmless; deleting
  history is a separate decision with its own consequences.
- Caching the result. Worth considering afterwards, and a cache over a 39-second miss is a plaster
  rather than a fix.

## Acceptance criteria

- [x] ~41s → ~8.5s on production with ARCA's real history.
- [x] Reads are bounded by the render limit. A 2000-report history now costs exactly what a
      200-report one does, asserted by counting reads rather than timing anything.
- [x] `total` still reports the true number — "Showing the 20 most recent of 116 runs", against 116
      non-heartbeat reports actually on the refs.
- [x] The heartbeat is read by name every time, so `engineState` still works on a venture whose runs
      are all older than it.
- [x] Ordering unchanged: newest by `started_at`, ties broken by lane, with a read margin so the
      filename-versus-start-time difference cannot bite at the boundary.

**Still ~8.5 seconds.** This ticket took out ~32 of the ~41; the rest is the nine other sequential
awaits on the venture page, which were deliberately out of scope here and are worth their own ticket
now that they are the largest thing left rather than noise behind a 39-second read loop.
