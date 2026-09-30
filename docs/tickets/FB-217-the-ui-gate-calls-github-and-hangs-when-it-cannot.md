# FB-217 — the UI gate calls GitHub, and hangs when it cannot

**Status:** Done · **Fixed 2026-09-30** · **Phase:** 3 · **Found by:** an hour lost to FB-214, 2026-09-09

## What is wrong

Every other read in the studio has a fixture source, selected by `E2E_TEST_LOGIN=1` plus a
`*_FIXTURE_DIR`, so the UI gate runs offline and deterministically. `historyFor` in
`lib/activegraph-log.ts` has none. The approval page calls it with a real `GitHubClient`:

```ts
const h = await historyFor(new GitHubClient(), ventureId, repo, approvalId, secret);
```

So `/venture/<id>/approvals/<repo>/<id>` makes a **live network call during the gate**.

When that call cannot complete, the page never responds and Playwright reports
`page.goto: net::ERR_ABORTED; maybe frame was detached?` after 35 seconds — a message that says
nothing about a token, a network, or GitHub.

## What it cost

An hour, on a ticket it had nothing to do with.

FB-214's CI failed on five approval tests. Reproducing locally failed **the same way on `main`**,
which should have exonerated the branch — except main's CI was green on the identical commit, so
neither result could be trusted. The local failure turned out to be an **expired `GITHUB_TOKEN` in
`.env.local`**, which `next start` loads into the gate's own server. An invalid token makes the
client unauthenticated, unauthenticated is 60 requests an hour, and the page hangs.

With a valid token, **main and FB-214 both pass**. The branch was never broken.

Every one of those signals was misleading, and all of them because one read in the gate is not a
fixture.

## Why it matters beyond the hour

1. **The gate is not deterministic.** A required check that depends on a live API and a valid
   credential will fail for reasons that have nothing to do with the change under review. That
   teaches people to re-run it, which is how a red gate stops meaning anything (CLAUDE.md #2 exists
   because a red gate merged itself once already).
2. **It is slow.** Every run of these tests makes real requests.
3. **The failure names nothing.** `ERR_ABORTED` is what a founder-facing timeout looks like from the
   outside, and it should not be what a developer sees either.

## Seen again, 2026-09-30

On PR #300 — **four markdown files, no code.** The Playwright gate failed after a full 5m6s run (not the
fast build failure FB-223 fixed):

```
✘ e2e/approvals.spec.ts:164 › a price the studio could not read (FB-214)
  › a genuinely free action stays silent, because free is a real answer (35.0s)
  ✘ retry #1 (35.1s)
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
```

Green on re-run with no change.

**The approvals page is the one that hangs, and it is the one this ticket is about.** FB-214 spent an hour
on this exact failure before finding the cause: the page makes a live call to GitHub, and when that call is
slow or rate-limited the page never settles, so the test times out at 35 seconds.

That it failed on a documentation-only pull request is the whole argument. **A required gate whose result
depends on a third party's response time is a gate that reports on the weather**, and this project has
already shown what that costs: FB-223 records a merge made past a red check, on the day a different
unrelated flake had trained the expectation.

FB-223 removed the font dependency. **This is the remaining one**, and it is the more valuable of the two
because it fails slowly and expensively rather than quickly.

## Scope

- A fixture source for the approval record, matching every other read: a
  `ACTIVEGRAPH_FIXTURE_DIR`, gated on `E2E_TEST_LOGIN`, injected at the call site the way
  `runReportSource` and the rest are.
- **Fail loudly rather than hanging.** A read that cannot complete should surface as "the studio
  could not read this approval's history" — the FB-137 treatment — not as a page that never returns.
- A check that the gate makes no outbound request. That is the rule this violates, and nothing
  currently states it.

## Acceptance criteria

- [ ] The approval page renders in the gate with no network available.
- [ ] A failed history read shows a stated reason, not a hang.
- [ ] Something fails if a new page adds a live call to the gate.

## Fixed, 2026-09-30

Two changes, because there were two faults: the gate should not have been reading at all, and the read
should not have been able to hang.

### 1. The gate does not read the record

`historyIsReadable()` in `lib/activegraph-log.ts` answers whether this process should reach for the signed
record. **No, in the rig; no, without a secret; yes otherwise.**

**Deliberately not a fixture directory of events**, which is what this ticket's scope originally asked for.
An event means something only if its signature verifies, so a fixture would need the real signing secret to
be worth reading — and fixture events signed with a test key would exercise the *unverified* path, which is
the opposite of what these tests are about. `lib/trail-sources.ts` had already reached this conclusion for
the trail: *"No events is the honest answer there, not a failure."* This is the same answer at the surface
that was missed.

It takes **both** rig signals to stand down. A stray `APPROVALS_FIXTURE_DIR` on a production machine must
not silently hide a real history, so either one alone still reads.

### 2. The read is bounded, and says so when it gives up

`historyForBounded()` wraps it at **8 seconds** and returns `{ ok: false, reason }` rather than throwing or
stalling. The page renders the reason where the history would be: *"The studio could not read this
approval's record: …"*.

A founder looking at an approval whose record could not be read still needs the approval (CLAUDE.md #10),
and **"no history" and "could not read the history" are different facts.** The timeout is cleared on
success, or a fast read would still hold the page for the full eight seconds.

### 3. Something now fails if a new page adds a live call

`lib/__tests__/no-live-call-in-the-gate.test.ts` walks every `page`, `layout` and `route` under `app/` and
requires that any file constructing a `GitHubClient` also routes through a seam the rig can switch off.

It does not forbid the client — most pages legitimately read from GitHub. It requires a way out, which is
exactly what this page lacked.

## The measurement

The test that has failed twice — `approvals.spec.ts:164`, *"a genuinely free action stays silent"*:

| | |
|---|---|
| before | **timed out at 35.0s**, and again at 35.1s on retry |
| after | **passes in 669ms** |

The whole approval suite: **13 passed in 50.1s.**

## Every guard was checked by breaking it

- Remove the rig check → *"refuses to read in the rig"* fails.
- Make the read unbounded again → *"gives up and states the reason"* fails, **after hanging for 5,008ms**,
  which is the original bug reproduced on demand.
- Add a page that builds a `GitHubClient` with no way out → *"every page can be told not to"* fails.

Restored, all nine pass.

## Acceptance criteria, met

- [x] The approval page renders in the gate with no network available — it no longer reaches for the record
      at all there.
- [x] A failed history read shows a stated reason, not a hang.
- [x] Something fails if a new page adds a live call to the gate.

## What was assumed and turned out wrong

The ticket's scope asked for a fixture directory of events. **That would have been the wrong fix** — see
above. The trail had already solved this correctly months earlier and the answer only needed carrying to
the second surface, which is a cheaper fix than the one this ticket proposed.
