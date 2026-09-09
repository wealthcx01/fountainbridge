# FB-217 — the UI gate calls GitHub, and hangs when it cannot

**Status:** filed · **Phase:** 3 · **Found by:** an hour lost to FB-214, 2026-09-09

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
