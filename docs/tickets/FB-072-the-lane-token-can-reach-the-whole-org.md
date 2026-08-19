# FB-072 — The lane's token can reach the whole org, including the studio

**Status:** Open · **Phase:** 0 (security) · **Found by:** FB-071, checking a premise rather than
assuming it · **Repo:** fountainbridge (+ every venture box) ·
**Branch:** `fb-072-scope-the-lane-token` · One ticket = one branch = one PR.

## Why this matters (for the founder)
The agent that writes your tickets should only be able to touch your venture. Right now it could
touch everything Bruntsfield has on GitHub, including the studio you approve things in.

Nothing has gone wrong. This is about what *could*, and it is a five-minute fix.

## What was found
FB-071 needed to answer one question before choosing where to keep the approval record: **can a lane
write here?** So the lane's own credential was checked rather than assumed:

```
$ curl -H "Authorization: Bearer $TICKET_GITHUB_TOKEN" \
    https://api.github.com/repos/wealthcx01/fountainbridge
  permissions: {admin: true, maintain: true, push: true, triage: true, pull: true}
```

The token on the ARCA box — the one the composer's ticket-filer, the deposit tool and the lane all
share — has **admin on `wealthcx01/fountainbridge`**, the studio's own repository. It is scoped to
the whole org, not to the venture.

Two things that are NOT wrong, and were checked in the same pass:

- **The lane does not hold `FOUNDRY_APPROVAL_SECRET`.** It appears in no file under `/opt` or `/etc`
  on the box. The signing gate — the thing that actually makes the approval record trustworthy —
  holds.
- **`main` is branch-protected.** A lane cannot push to the studio's default branch; it would need a
  PR with passing CI.

## What it means
Blast radius, not a live compromise:

| A lane could… | Stopped by |
| --- | --- |
| push to a non-protected ref in the studio repo (e.g. the ActiveGraph ref) | **nothing** — but the events it wrote would not verify, so they would not count (FB-071) |
| open a PR against the studio | CI + review |
| push to `main` | branch protection |
| read every Bruntsfield repo | **nothing** |
| forge an approval | the HMAC secret it does not hold |

The consequence for FB-071 is stated in that ticket rather than hidden: its first acceptance
criterion — *"the event log lives somewhere no lane holds a credential for"* — is **not met today**,
and cannot be met at any GitHub location while this token is org-wide. What makes the record sound is
the signature. This ticket is what makes the location sound too, so the two layers are independent
the way the design intends.

## The mirror image, found in the same pass
The **studio's** token has the opposite problem, and it is worth fixing in the same sitting because it
is the same review:

```
$ curl -X PUT -H "Authorization: Bearer $STUDIO_APPROVAL_GITHUB_TOKEN" \
    https://api.github.com/repos/wealthcx01/fountainbridge/contents/activegraph/.keep -d '…'
  403 Resource not accessible by personal access token
```

`STUDIO_APPROVAL_GITHUB_TOKEN` reaches the venture repos but not `fountainbridge`, so the studio
cannot write the ActiveGraph record to its own repository (FB-071). The studio degrades honestly —
it tells the founder the history could not be written rather than showing one that does not exist —
but the record is not live until this is granted.

So the two tokens are wrong in opposite directions: **the lane can reach everything and should not;
the studio cannot reach the one repo it needs.**

## Scope
- Mint a **fine-grained PAT per venture**, scoped to *only that venture's repos* (`arca`,
  `arca-marketing`, `arca-ops`), with `Contents: write` + `Pull requests: write` and nothing else.
- Replace `TICKET_GITHUB_TOKEN` on each venture box; recreate the LibreChat container (`.env` is read
  on recreate, not restart — see `deploy/librechat/README.md`).
- Revoke the org-wide PAT.
- Give the status connector its own **read-only** token (`STATUS_GITHUB_TOKEN`), which the box
  already supports and currently falls back to the write token for.
- Add the check to the provisioning runbook, so a new venture box cannot be handed an over-scoped
  token by default.
- **Grant `STUDIO_APPROVAL_GITHUB_TOKEN` `Contents: write` on `fountainbridge`**, so the ActiveGraph
  record can actually be written (FB-071). Nothing else about that token changes.
- Re-run the FB-071 premise check and record the result in that ticket.

## Out of scope
- Moving the record off GitHub entirely (Supabase, an append-only store). That is a bigger change and
  the signature already carries the trust; revisit if a venture ever needs a lane it does not control.

## Acceptance criteria
- [ ] A venture box's token returns 404 for every repo outside its own venture. — *needs the token
      to exist; the runbook's step 5 is exactly this test, run before it goes near the box.*
- [ ] The lane, the composer's ticket-filer and the deposit tool all still work on ARCA. — *runbook
      step 7, which deliberately confirms the box works BEFORE the old token is revoked.*
- [ ] The status connector uses a read-only token, and a write attempt with it fails. — **not
      addressed by the runbook.** See "what is still open" below.
- [x] The provisioning runbook mints a per-venture token, and says what it must not be able to
      reach. — `docs/venture-github-token.md`, written from the actual API calls the box makes
      rather than a guess at what it needs, and reusable per venture.
- [ ] FB-071's first acceptance criterion is re-tested and its result recorded honestly either way.

## Progress, 2026-08-19 — the runbook, not the token

**Status stays Open, because the credential does not exist yet.** Issuing it needs an account that
owns the org, so it is John's to do; what was blocking him was not the decision but the absence of a
precise, checkable procedure. That now exists.

`docs/venture-github-token.md` gives the seven steps, and three things in it are worth naming here:

- **The permission set is derived, not assumed.** Every GitHub call the box makes was read out of
  `ticket-mcp`, `deposit-mcp`, `status-mcp` and the lane scripts. The answer is Contents RW, Pull
  requests RW, Metadata RO — and *nothing else*. It holds Administration today.
- **The repository list is the manifest's `repos:` block** — for ARCA, `arca`, `arca-marketing`,
  `arca-ops`, all three of which exist. The manifest is the source; the token page should match it.
- **The proof is a 404, checked before the token reaches the box.** A fine-grained token that was
  never granted a repository cannot see it exists. The `permissions` block on `GET /repos` must not
  be used for this — for fine-grained tokens it reports the *user's* access, not the token's, which
  is what made this hole easy to miss in the first place.

### What is still open after the runbook is followed

Criterion 3 — a separate read-only token for the status connector — is **not** covered. The runbook
issues one credential per venture, shared by the filer, the deposit tool, the status connector and
the lane. That closes the large hole (one venture's agents reaching every other venture and the
studio) and leaves a smaller one: within a venture, a compromised composer has the lane's reach.
Splitting per-tool is a further step and deserves its own ticket rather than being quietly folded in
here and left half-done.

## Verification
On the box, after the swap — the check that found this, run again:

```bash
for r in fountainbridge arca grassmarket; do
  echo -n "$r: "
  curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TICKET_GITHUB_TOKEN" \
    https://api.github.com/repos/wealthcx01/$r
done
# want: arca 200, everything else 404
```

Then file one real ticket through the composer and let one lane wake, so the narrower token is proven
by use and not just by a probe.

## Note for John
The PAT is yours to mint — I cannot create one. Two minutes:

1. github.com → Settings → Developer settings → **Fine-grained tokens** → Generate new token
2. Resource owner **wealthcx01**, repository access **Only select repositories** → `arca`,
   `arca-marketing`, `arca-ops`
3. Repository permissions: **Contents: Read and write**, **Pull requests: Read and write**. Nothing
   else — no Administration, no Actions, no Secrets.
4. Send it over and I will swap it on the box and verify; then revoke the old one.

And for the studio's own token, on the same screen: add `fountainbridge` to its repository access with
**Contents: Read and write**. That one is already on Railway — it just needs widening by one repo, and
the ActiveGraph record starts writing on the next approval.
