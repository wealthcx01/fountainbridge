# FB-187 — the studio stopped keeping its own record of who agreed to what

**Status:** Shipped in part · **Phase:** 3 · **Found by:** FB-183, 2026-09-03, refusing a real send
on production data

## Two corrections to the first version of this ticket

It said `activegraph/` did not exist in `wealthcx01/fountainbridge` at all, and that the write had
never once succeeded. **Both were wrong.** The first check looked at `main`; the record lives on its
own `foundry-activegraph` ref. The record does exist there, and it holds four events.

## What is actually true

The record was written **once**, on 1 August 2026, by FB-071's own live proof:

```
activegraph/arca/arca-marketing/live-proof-fb071/0001-approval.proposed.json
activegraph/arca/arca-marketing/live-proof-fb071/0002-approval.granted.json
activegraph/arca/arca-marketing/live-proof-fb071/0003-approval.granted.json
activegraph/arca/arca-marketing/live-proof-fb071/0004-approval.granted.json
```

Nothing has been written since, and nothing **can** be. `STUDIO_APPROVAL_GITHUB_TOKEN` is a
fine-grained personal access token. It has `Contents: write` on the venture repositories and **read
only on the studio's own repository**. Proven both ways on 3 September:

| write | result |
| --- | --- |
| `wealthcx01/arca-marketing` contents | **201** |
| `wealthcx01/fountainbridge` contents | **403**, `x-accepted-github-permissions: contents=write` |

So the studio can write a grant into the venture's repository and cannot write the audit event into
its own. That is backwards from the one property the record is for.

**The repository's `permissions.push` field says `true` for this token.** It describes the account's
access, not the token's grants. Any check that trusts it certifies a studio that cannot write.

## What has been lost

**Nothing of the venture's real history.** No venture held an external approval between 1 August and
3 September — `foundry-approvals` did not exist in `arca`, `arca-marketing`, `arca-ops` or
`the-reset` — so there was no decision to record. The only decision that ever hit the degraded
branch was FB-183's own verification refusal, which was seeded and then removed.

The next real decision would have been the first one lost. That is the whole of the risk, and it is
why this is worth fixing before the first send rather than after.

## What shipped

A **write probe**, because only a write proves a write. `probeRecordWritable` writes one small file
to the record's ref and overwrites it in place — the same shape as the lane's heartbeat beacon.
`/api/readiness?probe=1` runs it, counts it towards `ok`, and returns **503** when it fails, with a
message naming the permission that fixes it.

Verified both ways on the real repository:

- production's token → `503`, *"the studio cannot write its own record — GitHub 403"*
- a token with the permission → `200`, `record.ok: true`

And the whole path was proven end to end against the real repository with a credential that has the
permission: a real approval and a real refusal, each writing two signed events, each reading back
through `historyFor` and rendering on the decision as *"…approved it"* and *"…turned it down"*.

Those four proof events are still in the record. They are append-only by design and self-describing,
and FB-071's own proof from August sits beside them.

## What is left, and it is one permission

**John:** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
the token behind `STUDIO_APPROVAL_GITHUB_TOKEN` → Repository access must include
`wealthcx01/fountainbridge`, with **Repository permissions → Contents: Read and write**.

Nothing else changes. No redeploy is needed — the token is read per request.

**Do not** point `STUDIO_EVENT_REPO` at a venture repository to make the write succeed. Every
repository this token can write is a venture repository, and the record exists precisely to sit
where the proposing lane cannot author it. That would make the check pass and delete the reason for
the record.

## Acceptance criteria

- [x] A real approval and a real refusal each write their two signed events
- [x] The events read back through `historyFor` and render on the decision
- [x] A readiness probe fails when the record cannot be written, instead of every decision quietly
      taking the degraded branch
- [ ] **Production can write its record.** Needs the permission above, which is not mine to grant.
