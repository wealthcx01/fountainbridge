# FB-243 — a preview link sends the reviewer to production, and nothing on screen says so

**Status:** Done · **Phase:** 3 · **Found by:** FB-230's live check, 2026-10-01

## Reproduce it in one command

Against the preview Railway built for pull request 315 on 2026-10-01:

    $ curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
        https://foundry-studio-fountainbridge-pr-315.up.railway.app/

    307 https://foundry-studio-production-4a73.up.railway.app/login?callbackUrl=...

**The preview serves production.** A reviewer opens the link expecting to see the pull request's work,
sees `main` instead, and has nothing on the screen that could tell them otherwise.

## Why

Railway **forks a preview environment from production and inherits its variables**. `AUTH_URL` is one
of them. A literal production URL in production therefore becomes a literal production URL in every
preview, and Auth.js redirects there.

This lane's notes from 2026-08-04 record the same trap on pull request 67 and the fix:

> `AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}` — Railway resolves the reference per environment, so
> production, staging and every preview each point at themselves.

The fix was applied to the environments that existed then. It was not applied in the one place that
would make it stick: **the value a new preview inherits**. So every preview created since has the
fault again, and will keep having it.

## Why this is worth its own ticket

FB-230's closing claim is that *"the moment Railway creates one environment, the link appears with no
further work."* The link does appear. It goes to the wrong place.

So the feature the Foundry is waiting on — **a founder clicking through to see their work running**
— would, the day it started working on ARCA, show them the wrong application. That is worse than no
link: a missing link is visibly missing, and a wrong one is invisibly wrong. It is the same shape as
FB-151, where a probe measured two pages that had both redirected elsewhere.

It also lands directly in FB-239's path. One machine per ticket is only worth building if the link at
the end of it is true.

## Scope

- Set `AUTH_URL` so that a forked environment resolves it to **itself**, not to whatever it was
  copied from. The reference form is in the note above.
- Prove it on a real preview: open a pull request, follow the link, confirm it lands on the preview's
  own domain and not production.
- A check that fails when a preview link redirects off its own host — this is exactly the class of
  fault that a health endpoint returning 200 does not catch, and the reason the note says so.
- Decide what happens for a preview a founder cannot sign in to at all: Google OAuth redirect URIs
  are exact-match with no wildcards, so a per-pull-request domain cannot be pre-registered. The
  password door (FB-092) may be the answer for previews, or previews may be for reviewers rather than
  founders. That is a product decision, and it is the reason this ticket does not simply say "fix the
  variable".

## What needs a human

**Changing `AUTH_URL` on production is a high-blast-radius infrastructure change** — it is the
variable that decides where sign-in sends people. Under the D7 approval matrix that is dual-approve,
so it is not done here. The reproduction, the cause and the fix are all above; the change is one
variable.


## Changed 2026-10-01, approved by John — *"yes change the AUTH_URL variable and prove it on a preview"*

### The diagnosis, confirmed across all three environments

| environment | its own domain | `AUTH_URL` before |
| --- | --- | --- |
| production | `…-production-4a73…` | `…-production-4a73…` ✓ |
| **pr-315** | `…-pr-315…` | **`…-production-4a73…`** ✗ the inherited literal |
| staging | `…-staging…` | `…-staging…` ✓ |

Staging was already correct, which is the story this ticket tells: the fix was applied by hand to the
environments that existed in August, and never to the value a new preview inherits.

### What was changed, and why it was safe

One variable on production:

    AUTH_URL: "https://foundry-studio-production-4a73.up.railway.app"
           →  "https://${{RAILWAY_PUBLIC_DOMAIN}}"

**Checked before changing it** that `RAILWAY_PUBLIC_DOMAIN` on production is
`foundry-studio-production-4a73.up.railway.app` — so the reference resolves to the byte-identical
value and production's behaviour could not change. That check is the reason this was a safe change to
a variable that decides where sign-in sends people, rather than a hopeful one.

Verified after the redeploy: production resolves `AUTH_URL` to the same string as before, `/` still
answers 307 to its own `/login`, and `/login` answers 200.

### What is not fixed by it

**`pr-315`'s own environment still carries the old literal.** A variable is copied at fork time, so
the environments that already exist keep what they were given. That is not a gap in the fix — it is
what the fix is about, and it is why the proof below had to be a NEW pull request rather than the one
that found the fault.


### Proved on a real preview

Two pull requests, one forked either side of the change:

| preview | forked | lands on |
| --- | --- | --- |
| `pr-315` | before | `foundry-studio-production-4a73…/login` ✗ |
| **`pr-316`** | after | **`foundry-studio-fountainbridge-pr-316…/login`** ✓ |

`pr-316`'s own `AUTH_URL` resolves to its own domain. Rendered and looked at, at 1440×1000 and
393×851: **1,000px and 851px, nothing scrolls sideways**, and the page is the studio's sign-in on the
preview's own host.

### The check, and the bug inside my first version of it

`scripts/check-preview-link.mjs` follows the redirects and fails when the link does not open the
preview. The judgement is in `scripts/preview-link-lib.mjs`, which is pure and tested.

**The first version passed a dead preview.** Run against `pr-315` after its pull request merged and
its environment was torn down, it printed `OK: stays on …pr-315… (404)` — a green answer to the wrong
question, which is precisely the family of fault it was written to catch. "Serving" now means 2xx,
and the three failures are told apart because they call for different actions:

- **wrong host** — fix `AUTH_URL` on the environment it was forked from;
- **not serving** — the preview is broken or gone;
- **never settles** — a redirect loop.

It is deliberately **not** a CI gate. It needs a live preview URL, which means a green build would
depend on Railway having finished deploying — a gate that fails when a third party is slow. The logic
is covered by unit tests in CI; the script is the instrument a person runs against a link before
sending it to anyone.

### What a founder can do with a preview link

The fourth criterion, answered by looking at the screen rather than by reasoning about it.

**The password door works.** The preview's sign-in offers *"Or with email and password"* — the
FB-092 door — and it needs no OAuth redirect URI, so it works on a domain nobody pre-registered.
`STUDIO_PASSWORD_LOGINS` is inherited from production along with everything else.

**Google sign-in cannot work on a preview**, and no change here would fix it: OAuth redirect URIs are
exact-match with no wildcards, so `…-pr-317…`, `…-pr-318…` and every one after would each need
registering by hand before anyone could use them.

So a preview is usable by a founder, through the password door, and the Google button on it will
fail. That is worth knowing before a link is sent to one.

## Acceptance criteria

- [x] A preview link opens the preview, at both viewports, and nothing about it says production.
      1,000px and 851px, no sideways scroll, on `…pr-316…`.
- [x] The fix is in the value a NEW preview inherits, not applied by hand per environment. Proved by
      forking a preview after the change and reading its resolved `AUTH_URL`.
- [x] A check fails when a preview redirects off its own host — and when it answers an error, and
      when it loops. `scripts/check-preview-link.mjs`, logic unit-tested.
- [x] It is written down what a founder can do with a preview link: the password door works, Google
      cannot.
