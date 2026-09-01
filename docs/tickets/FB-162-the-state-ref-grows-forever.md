# FB-162 — A venture's state ref grows forever

**Status:** Todo · **Area:** Venture box / housekeeping · **Depends on:** FB-161

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

## Acceptance criteria

- [ ] A venture running for a year does not approach any listing cap.
- [ ] The newest wake is findable in one read, whatever the shape.
- [ ] Nothing a founder can currently see on "What happened" disappears without being said.
- [ ] Proven on the ARCA box, whose ref is the one that found this.
