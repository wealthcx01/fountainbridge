# FB-087 — Ask the deployment whether it works

**Status:** Done · **Phase:** 3 · **Follows:** FB-086 (which found the fault) · **Repo:**
fountainbridge · **Branch:** `fb-087-deployment-readiness` · One ticket = one branch = one PR.

## Why this exists

The in-studio composer never worked in production. Not once, for weeks. The route reads a venture's
engine key from `COMPOSER_API_KEY_<VENTURE_ID>`, and that variable was never set on Railway.

Nothing in this repository could see it. Lint, typecheck, 646 unit tests and a twelve-case end-to-end
suite were green the whole time, because every one of them runs against a **local** server with a
local `.env`. They proved the code worked. They could not prove the *deployment* worked, because they
never touched the deployment.

Configuration that exists only in an environment can only be checked *in* that environment, by the
process running there. That is the gap this closes.

## Also: how the variable went missing

`deploy/librechat/enable-agents-api.sh` mints the key on the box and prints the name to set. The
repository's copy derives it correctly from `VENTURE_REPO` (`wealthcx01/arca` → `ARCA`). **The copy on
ARCA's box was stale**, and derived it from the install directory instead — which is `/opt/foundry` on
every box, so it printed `COMPOSER_API_KEY_FOUNDRY`.

Anyone following the script's own instructions set a variable nothing reads and got a composer that
failed with no clue why. The box now has the current script, verified to derive
`COMPOSER_API_KEY_ARCA`.

This also corrects FB-085, which reported "every file matches" after comparing `librechat.yaml`,
`docker-compose.yml`, `seed-agent.js` and the lane scripts — a set that did not include
`enable-agents-api.sh`. A full sweep of `deploy/` against the box found exactly one functional drift
(this script) and one cosmetic one (a comment in `status-mcp/stdio.mjs`). The claim was too broad for
the evidence behind it.

## What ships

**`lib/readiness.ts`** — the rule: a venture is ready when the studio can actually reach its box, i.e.
it has a host and the key for that host is present. A venture with **no box** is ready, not broken —
flagging THE RESET before its box exists would train whoever reads the report to ignore it, which is
how a real fault gets missed. An empty-string variable does not count as set.

**`/api/readiness`** — admin-only. `/api/health` stays public and deliberately dumb: Railway's
healthcheck pings it, and a studio that failed its healthcheck because a venture's box was down would
refuse to deploy over a fault it does not own. Liveness and readiness are different questions.

`?probe=1` additionally asks each box whether it answers. That is the only way to catch a key that is
**set but wrong** — a 401 from the box looks identical to "working" from every check that does not
actually authenticate.

**A warning on the venture board, for Bruntsfield only.** The endpoint helps whoever thinks to call
it; this is the same fact placed where an admin will meet it anyway, before a founder does. Founders
never see it — it names a variable and a shell script, which is a fix for an admin and noise for
anyone else.

## What it must never do

Report a key's value, length, or any prefix. Whether a secret is set is an operational fact; the
secret is not. A readiness endpoint that leaks a hint about a credential is a worse bug than the one
it was written to catch. A test asserts the serialised report contains no part of the key.

## Explicitly NOT in this pull request

- **A CI step that calls production after deploy.** The right end state, and it needs a credential CI
  does not have. The endpoint is the piece that has to exist first.
- **Alerting.** Nothing pages anyone. Someone still has to look — the board warning is the cheapest
  version of "someone looks".

## Acceptance criteria

- [x] A venture with a box and no key reports not-ready, and says which variable and which script.
- [x] A venture with no box reports ready.
- [x] An empty variable is not "set".
- [x] The report never contains the key, its length, or a prefix.
- [x] `keyEnvName` provably equals what the composer route reads and what the box script prints.
- [x] Non-admins get 403, and unauthenticated callers get the same 403 rather than a 401 that would
      reveal whether an address is an admin.

## Verification

655 unit tests (9 new) and 15 end-to-end tests green. The box's script re-verified in place: it now
derives `COMPOSER_API_KEY_ARCA`.
