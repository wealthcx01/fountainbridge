# FB-123 — The board reads every run report ever written, one at a time, to show twenty

**Status:** Todo · **Area:** Studio / performance · **Depends on:** —

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

- [ ] The board loads in a few seconds, measured on production, with ARCA's real 117 reports.
- [ ] The number of file reads is bounded by the render limit, not by the size of the history, and a
      test says so by counting reads against a source with far more reports than the limit.
- [ ] `total` still reports the true number of runs.
- [ ] The heartbeat still drives `engineState`, including when the newest run reports are all older
      than it.
- [ ] Ordering is unchanged: newest by `started_at`, ties broken by lane.
