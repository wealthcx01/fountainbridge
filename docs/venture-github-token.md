# The venture token — issuing a credential that can only touch its own venture

**Who does this:** John (it needs a GitHub account that owns the org).
**How long:** about five minutes per venture.
**Do it for:** every venture box, starting with ARCA, and every Foundry venture from here on.

## Why

Every venture box holds one GitHub credential. The composer's ticket-filer, the knowledge-deposit
tool, the status connector and the autonomous lane all share it. It is the only credential on the
box, and it is currently a token scoped to the **whole `wealthcx01` organisation, with admin**:

```
$ curl -H "Authorization: Bearer $TICKET_GITHUB_TOKEN" \
    https://api.github.com/repos/wealthcx01/fountainbridge
  permissions: {admin: true, maintain: true, push: true, triage: true, pull: true}
```

That is the Foundry Studio's own repository — the place approvals are recorded. An agent working on a
Pokémon-card terminal can rewrite the system that governs it. Nothing has gone wrong; this is about
what could, and about being able to say honestly that it cannot.

It also matters for a reason beyond security. The approval record's third layer — *the log lives
somewhere the lane holds no credential for* — is not true today, and `lib/activegraph.ts` says so in
its own header rather than pretending. Narrowing this token is what makes that sentence true.

> **A note on `permissions` in the API response.** For fine-grained tokens that block is unreliable —
> it reflects the *user's* access to the repo, not the token's. Do not use it to confirm a token is
> narrow. Use the write test in step 5, which proves the thing you actually care about.

## What the box genuinely needs

Taken from the code, not assumed — these are every GitHub call the box makes:

| What runs on the box | Calls | Needs |
| --- | --- | --- |
| ticket-filer (`ticket-mcp`) | `contents`, `git/ref`, `git/refs`, `pulls` | Contents RW, Pull requests RW |
| knowledge deposit (`deposit-mcp`) | `contents`, `git/ref(s)`, `pulls`, repo metadata | Contents RW, Pull requests RW |
| status connector (`status-mcp`) | `pulls?state=open`, `pulls?state=closed` | Pull requests **read** |
| the autonomous lane | `git clone` / `fetch` / `push` over HTTPS | Contents RW |

So: **Contents read-and-write, Pull requests read-and-write, Metadata read-only.** Nothing else.

Specifically **not** Administration (what it holds today), and not Actions, Workflows, Secrets,
Environments, Webhooks, Packages, or Issues.

## Step by step

### 1. Open the right page

<https://github.com/settings/personal-access-tokens/new> — a **fine-grained** token. Classic tokens
cannot be limited to named repositories, which is the entire point of this exercise.

### 2. Name it so the next person knows what it is

- **Token name:** `foundry-venture-arca`
- **Description:** `ARCA venture box — ticket filer, deposit tool, lane. Scoped to ARCA repos only.`
- **Expiration:** 90 days. Longer is tempting and wrong: an expiry is the backstop for a credential
  that is copied onto a machine you do not look at every day. Put the renewal in your calendar.

### 3. Point it at the org, then at three repositories only

- **Resource owner:** `wealthcx01`
- **Repository access:** *Only select repositories* — **never** "All repositories".
- Select exactly the repos in the venture's manifest (`ventures/arca.yaml` → `repos:`):
  - `wealthcx01/arca`
  - `wealthcx01/arca-marketing`
  - `wealthcx01/arca-ops`

If a venture later gains a repo, add it here **and** to the manifest. The manifest is the list; this
page should match it.

### 4. Set exactly three permissions

Under **Repository permissions**:

| Permission | Set to | Why |
| --- | --- | --- |
| **Contents** | Read and write | Write ticket files, create branches, clone/fetch/push |
| **Pull requests** | Read and write | Open PRs; the status connector reads them |
| **Metadata** | Read-only | Mandatory, granted automatically |

Leave every other permission at **No access**. Create the token and copy it — GitHub shows it once.

### 5. Prove it is narrow *before* it goes near the box

This is the step that matters. Two commands, run from your own machine, with the new token in
`$NEW`:

```bash
# (a) It CAN see its own venture:
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $NEW" \
  https://api.github.com/repos/wealthcx01/arca                       # expect 200

# (b) It CANNOT see the studio — this is the whole point:
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $NEW" \
  https://api.github.com/repos/wealthcx01/fountainbridge             # expect 404
```

**404, not 403.** A fine-grained token that was not granted a repository cannot see that it exists,
which is the behaviour you want. If (b) returns 200 the token is still too wide — go back to step 3.

Optionally, prove it cannot write where it should not:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H "Authorization: Bearer $NEW" \
  https://api.github.com/repos/wealthcx01/fountainbridge/git/refs \
  -d '{"ref":"refs/heads/scope-test","sha":"0000000000000000000000000000000000000000"}'
                                                                     # expect 404
```

### 6. Put it on the box

```bash
ssh root@<venture-box>
cd /opt/foundry/librechat
cp .env .env.bak.$(date -u +%Y%m%dT%H%M%SZ)     # keep a way back
sed -i 's|^TICKET_GITHUB_TOKEN=.*|TICKET_GITHUB_TOKEN=<the new token>|' .env
docker compose up -d --force-recreate api        # env_file is read on CREATE, not on restart
```

The lane reads its own copy — check `/opt/foundry/lane/lane.env` for `TICKET_GITHUB_TOKEN` or
`GITHUB_TOKEN` and update it there too, then `systemctl restart foundry-lane.timer`.

### 7. Confirm the box still works, then revoke the old token

Do these in order. Revoking first leaves you debugging two changes at once.

```bash
# the filer starts and is authorized:
docker exec -i librechat-api node /app/foundry/ticket-filer.mjs <<< \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"check","version":"1"}}}'
# expect: [ticket-filer] starting (repo=wealthcx01/arca, authorized=true)
```

Then file one real ticket through the composer and confirm the PR appears. **Only then** revoke the
old token at <https://github.com/settings/tokens>.

## Doing this for the next venture

It is the same seven steps with three substitutions. For **the-reset**:

- token name `foundry-venture-the-reset`
- repository list = the `repos:` block of `ventures/the-reset.yaml`
- box = the-reset's own VPS (D1: one box per venture)

**One token per venture, never one token for the Foundry.** A shared credential re-creates exactly
the problem this fixes: it would let the-reset's agents reach ARCA. Venture isolation is physical
(one box each) and it should be true of credentials too.

## What this does not fix

The token is a *venture* credential, not a *per-tool* one — the ticket-filer and the lane still share
it, so a compromised composer has the lane's reach within that venture. Splitting them is a further
step and its own ticket. What this closes is the much larger hole: one venture's agents reaching
every other venture, and the studio that governs them all.
