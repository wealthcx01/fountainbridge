---
name: write-tests
description: Write tests that pin real behaviour rather than implementation details, config values or lucky fixtures. Use when adding a test, writing a regression test, fixing a brittle or flaky one, or reviewing a test diff. Adapted from dzhng/skills write-tests.
---

# Write tests

Adapted from `engineering/write-tests` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT). Their
sentence names **both** failure modes this project has actually shipped:

> A good test fails **only** when real behaviour breaks, and passes through every refactor that preserves
> it. Most bad tests fail the opposite way: **red on harmless changes, green while the real path is
> broken.**

Green-while-broken: five tests here have passed while measuring nothing. Red-on-harmless: two required
gates have failed on pull requests containing only markdown.

## The rule that finds the first kind

**Delete the fix and watch the test go red.** Every new guard, every time. It is the only check that has
ever found a vacuous test here, and it has found five:

- A degraded-read test that passed because the fixture left no rows to fail on.
- An ordering test whose two files never exceeded the budget it was asserting.
- A SQL test that retyped the expression under test into its own body, so it checked a copy.
- The same test again, whose fixture was already in the expected output order, so it could not tell
  sorting from insertion order.
- An office test that looped over elements that did not exist, and so looped over nothing.

**Three smells, each seen here:**

1. **The fixture cannot produce the failure.** Ask what the input would have to be for this to go red. If
   there is no such input, there is no test.
2. **The test holds its own copy of the thing under test.** Import it instead.
3. **The expected order is also the natural order.** Shuffle the fixture, or it cannot tell sorting from
   luck.

## Pin behaviour, not shape

- Assert what a person would notice, not how it is stored.
- A test that breaks on a rename and not on a wrong answer is upside down.
- Prefer one honest assertion over five that restate the implementation.

## Running them here

```
NODE_OPTIONS=--max-old-space-size=3072 npx vitest run --pool=forks --poolOptions.forks.singleFork
```

The flags are not decoration: the default pool has run this suite out of memory and taken the session
with it.

## When a test needs the network, it is not a unit test

Every read in the studio has a fixture path selected by `E2E_TEST_LOGIN` plus a `*_FIXTURE_DIR`. One did
not, and it cost an hour twice (FB-217). If a new test needs a live call, the seam is missing — add the
seam.
