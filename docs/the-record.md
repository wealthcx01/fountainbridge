# The record: who agreed to what

The studio keeps its own history of every external decision. This is what it is, where it lives, and
what to do when it stops working.

## What it is

Two signed events per decision, written when a founder approves or refuses something that leaves
their company:

- `approval.proposed` — your team asked
- `approval.granted` or `approval.rejected` — you answered

They are signed with `FOUNDRY_APPROVAL_SECRET`, which no lane holds. The studio writes them; the
proposing lane cannot.

## Where it lives, and why there

`wealthcx01/fountainbridge`, on the `foundry-activegraph` branch, under `activegraph/`.

The studio's own repository, not the venture's. That is the entire point. The grant itself
(`grant.json`) sits on a branch in the venture's repository, which the lane can write — so on its
own it proves nothing. The record is the copy the audited party cannot author.

Move it into a venture repository and it still works, still passes every check, and stops being
worth keeping.

## When it breaks

Approving and refusing keep working. Nothing goes out unapproved — the signature still binds and the
executor still verifies it. What stops is the history.

The founder is told at the moment they decide:

> Approved, and the action will run shortly. The studio could not write it to the history, so this
> approval will show fewer details than usual — nothing else is affected.

That sentence is true and it is the only thing a founder needs. It is not enough for whoever runs the
studio, which is why there is a check.

## The check

```
GET /api/readiness?probe=1        (admin only)
```

It writes one small file to the record's branch and overwrites it in place. **A real write, because
only a write proves a write** — GitHub's `permissions.push` field reported `true` for a token whose
every write returned 403. It describes the account's access, not the token's grants.

A studio that cannot keep its record answers **503** and names the permission that fixes it.

## Fixing the credential

`STUDIO_APPROVAL_GITHUB_TOKEN` needs **Contents: Read and write** on `wealthcx01/fountainbridge`.

GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → the token →
Repository access includes `wealthcx01/fountainbridge` → Repository permissions → Contents: Read and
write.

The token is read on each request, so no redeploy is needed.
