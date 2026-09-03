# FB-187 — the ActiveGraph audit log has never been written, and the studio has been saying so

**Status:** Open · **Phase:** 3 · **Found by:** FB-183, 2026-09-03, refusing a real send on production data

## What happened

Refusing an external send on ARCA wrote its `refusal.json` correctly and returned this to the
founder:

> Refused, and nothing will go out. The studio could not write it to the history, so this decision
> will show fewer details than usual — nothing else is affected.

That sentence is the honest degraded path working exactly as non-negotiable 10 intends. The reason
behind it is the problem:

```
[activegraph] append failed
  path: activegraph/arca/arca-marketing/september-investor-note/0001-approval.proposed.json
  err: GitHub 403 for /repos/wealthcx01/fountainbridge/contents/activegraph/...
```

**`STUDIO_APPROVAL_GITHUB_TOKEN` cannot write to the studio's own repository.** And
`activegraph/` does not exist in `wealthcx01/fountainbridge` at all — so this has never once
succeeded.

## Why it matters

FB-071 built the ActiveGraph log for one reason, in its own words: *"two signed events on the
STUDIO's own ref, so the story of who asked and who agreed exists somewhere the proposing lane
cannot author."*

That story does not exist. Every approval and every refusal takes the degraded branch, and the
record of who agreed to what survives only as `grant.json` on a ref **the proposing lane can
write** — which is precisely the arrangement FB-051 was rewritten to escape.

Nothing has gone out unapproved: the attestation still binds, the executor still verifies, and a
forged grant is still caught. What is missing is the independent history.

**This is not caused by FB-183 and is not fixed by it.** Approve and refuse call the same
`appendEvent` with the same token at the same repository, so the approve path has always failed the
same way. FB-183 is only how it was noticed — the refusal was the first decision anyone had driven
end to end against production data.

## Scope

- Give the write credential push access to `wealthcx01/fountainbridge`, or point `STUDIO_EVENT_REPO`
  at a repository it can write and say why in `docs/`.
- Prove it with a real decision, not a fixture: drive one approval and one refusal and read the
  events back.
- Decide what happens to the decisions already made with no history behind them. They are not
  recoverable — the events were never written — so this is a note on the record, not a backfill.
- A check that fails loudly if the log is unwritable, rather than only telling the founder afterwards.

## Acceptance criteria

- [ ] A real approval and a real refusal each write their two signed events.
- [ ] The events read back through `historyFor` and render on the decision.
- [ ] Something fails — CI, a readiness probe, or a startup check — when the log cannot be written,
      instead of every decision quietly taking the degraded branch.
