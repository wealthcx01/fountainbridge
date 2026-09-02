# FB-177 — the desk reads its repositories one at a time, and opens 60 files to show 20

**Status:** Open · **Phase:** 3 · **Raised by:** the `/admin/timing` readings, 2026-09-02

## The measurement

From `/admin/timing` on production, ARCA, real requests:

| step | median | slowest | readings |
| --- | --- | --- | --- |
| desk: what your team did | **6417 ms** | 7207 ms | 3 |
| desk: repository health | **6114 ms** | 6190 ms | 3 |
| desk: your approvals | **4625 ms** | 5072 ms | 3 |
| memory: recurring work | 2602 ms | 2602 ms | 1 |
| rail: everything | 1968 ms | 5071 ms | 12 |
| memory: the documents | 1240 ms | 1663 ms | 3 |
| root layout: open work across your ventures | 1096 ms | 1418 ms | 10 |
| memory: what has been read | 675 ms | 690 ms | 3 |
| rail: open work | **6 ms** | 1712 ms | 12 |
| desk: open work | **2 ms** | 2 ms | 3 |

Two things are visible at once. The 2ms and 6ms rows are FB-157's per-request dedupe working exactly
as intended — those are cache hits on a read another component already made. And three reads on the
desk account for essentially all of its six seconds.

## Why "what your team did" takes 6.4 seconds

`loadRunReports` (lib/runreports.ts:223):

```ts
for (const repo of approvalRepos(venture)) {     // ← SEQUENTIAL
  const names = await source.list(repo);          // the whole tree listing
  const newest = reportNames.sort().reverse().slice(0, limit * READ_MARGIN);
  const read = await Promise.all(…)               // parallel WITHIN one repo
```

`limit` is 20 and `READ_MARGIN` is 3, so it opens **60 files per repository to render 20 rows**, and
ARCA has three repositories, walked **one after another**. Three sequential waves of a large tree
listing plus sixty file fetches.

`loadLiveness` — FB-164's read, on the same data — already fans out with `.map` in parallel
(line 436). The two functions sit in one file and disagree about how to walk the same repositories.

## Why this is worth doing before FB-170

FB-170 (the read model) is the real fix and it is a week of work touching venture isolation. This is
two changes in one file, it is measurable in minutes, and it makes the studio usable meanwhile. It
also does not become wasted work: the read model still wants a bounded, parallel loader behind it.

## Scope

- Fan the repositories out in parallel, matching `loadLiveness`. One unreadable repo must still cost
  only that repo (FB-137's lesson — `Promise.all` over a throwing fetcher took whole pages down).
- Justify `READ_MARGIN` or reduce it. Opening 60 files to show 20 needs a reason in a comment, and
  the reason must be a real one — measure what the margin is actually absorbing.
- Do the same for **repository health** and **your approvals**, which are the next two rows and are
  very likely the same shape.
- Re-measure on production and record the numbers in the PR, from `/admin/timing`, with the readings
  count — a median over 3 readings is a hint, not a result.

## Acceptance criteria

- [ ] The desk renders fully in under 2s on ARCA's production data.
- [ ] Each of the three steps above is measurably faster, with before/after from `/admin/timing`.
- [ ] One unreadable repository still costs only that repository.
- [ ] `READ_MARGIN` is either justified in a comment or reduced.
