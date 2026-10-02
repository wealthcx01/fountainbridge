# FB-162 — A venture's state ref grows forever

**Status:** Shipped in part · **Area:** Venture box / housekeeping · **Depends on:** FB-161

## What is true

ARCA's `foundry-state` ref holds **1,551 run reports** and gains one every five minutes — roughly
288 a day, for as long as the lane runs. Each is a small JSON file, timestamped, never removed.

FB-161 fixed the studio's half: it can now see past the contents API's 1,000-entry cap, which had
frozen every ARCA screen's view of its own machine on 31 August. But the pile itself is real and it
only grows.

## Why it matters (for the founder)

Not disk — these are tiny. Three things:

- **Every read gets slower.** The studio reads the newest `limit × READ_MARGIN` names out of the
  whole listing; the listing is the part that grows without bound.
- **The next cap is quieter than the last.** The trees API has its own ceiling and its own
  `truncated` flag; a venture running for a year would approach it, and the failure would again be a
  correct-looking answer about a slightly older world.
- **Nothing prunes it**, so the answer to "how long can a venture run" is currently "until something
  we have not measured stops working".

## Scope

- The lane shards or expires its own reports — `runreports/YYYY/MM/` is the obvious shape, and the
  studio reads whichever months it needs.
- Whatever is chosen, **the newest wake must always be findable in one read**, because that is what
  liveness turns on.
- Nothing is deleted that a founder can still see on a screen. "What happened" reaches back as far
  as the record does, and quietly shortening that is not housekeeping, it is forgetting.

## Out of scope

- The studio's listing — FB-161.

## What was actually growing (found 2026-10-02)

By 2 October ARCA's ref held **10,213** reports, and **10,038 were one ticket, ARCA-061**: 730
re-plans of a plan John had already approved (fixed by FB-251), then **9,308** copies of "Daily lane
budget reached", one per wake once the re-planning had used up the day's allowance. Real work was
about 175 reports in two months. So the pile was not ordinary history growing; it was one loop.

## What this change does

- A spent daily budget is written as a report **once a day**. Later wakes that day update the single
  heartbeat file instead, so the team still reads as alive and nothing new is added.
- With FB-251, neither loop can fill the history again. At ARCA's real pace of work, a year is a few
  thousand reports, far below the listing limit (the trees API reads 100,000 entries).

## What is left

- **Clean up ARCA's 10,038 duplicates.** Keep the first and last, and replace the rest with one
  report saying how many identical re-plans and budget notices were removed, between which dates,
  and why. Done after FB-251 is live on ARCA, so the loop has stopped first.
- **Sharding by month** is not needed for this; it stays here in case real work ever approaches the
  limit.

**Shipped in part:** ARCA's 10,038 duplicate reports still need to be cleaned up, with a record of
what was removed.

## Acceptance criteria

- [x] A venture running for a year does not approach any listing cap.
- [x] The newest wake is findable in one read, whatever the shape. (The heartbeat file.)
- [ ] Nothing a founder can currently see on "What happened" disappears without being said.
- [ ] Proven on the ARCA box, whose ref is the one that found this.
