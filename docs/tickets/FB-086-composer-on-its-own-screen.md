# FB-086 — The composer goes back to its own screen

**Status:** Done · **Phase:** 3 · **Amends:** FB-065 (which moved it into the studio) · **Repo:**
fountainbridge · **Branch:** `fb-086-composer-on-its-own-screen` · One ticket = one branch = one PR.

**Asked for by John, 2026-08-02**, after testing the real studio: *"the composer within the studio
doesn't work — lets keep in a separate screen like we had before."*

## What was actually broken

The in-studio composer had never worked in production. Not once.

The route needs an API key for the venture's box, read from `COMPOSER_API_KEY_<VENTURE_ID>` on the
studio. **That variable was never set on Railway.** Every press of *Tell the studio what you want* hit
a route that could not authenticate, and returned an error.

It worked perfectly everywhere I tested it, because everywhere I tested it was local, against a
`.env.local` that had the key. The Playwright suite passed for the same reason: it drives a local
server. So a surface that was broken for every real founder for weeks sat behind a green CI badge and
a walk-through I had personally performed several times.

The key is now minted and set. But this ticket is not a config fix, because John did not ask for one.

## Why the surface moves anyway

FB-065's argument was good: sending a founder to a different address, with different branding and no
way back to the board, to do the single most important thing they do, is a bad seam. That argument
has not become wrong.

It has become less important than a working screen. The founder needs to describe what he wants and
have it become work. LibreChat on the box does that today, he has used it before, and he knows it
works. Given a choice between a well-argued surface that fails and a plainer one that does not, the
plainer one wins — and it is his product.

So the board's button opens `https://chat.<venture host>` again.

**In a new tab, deliberately.** The "no way back" problem FB-065 named is real, and navigating the
studio away to another application is how it happens. A new tab leaves the board exactly where the
founder left it, so returning is closing a tab rather than finding their way home. The link carries
`rel="noopener"` — without it the opened page gets a handle on `window.opener`.

**Nothing is deleted.** `/venture/<id>/composer` is still built, still routed, and still tested; the
suite drives it directly. The key is set, so it works now too. This is a change of which door the
board opens, not a demolition — if the in-studio version proves itself later, the board is one line
away from pointing back at it.

## The lesson worth more than the fix

A green end-to-end suite proved the *code* worked. It could not prove the *deployment* worked,
because it never touched the deployment. The failure lived entirely in the gap between them: one
unset variable on Railway, invisible to every check in this repository.

Two things follow, and neither is in this pull request:

1. **The studio has no post-deploy verification.** Nothing ever asks the running production instance
   whether it can actually reach a venture's box. A boot-time or health-endpoint check that names each
   configured venture and whether its composer key resolves would have caught this the day it shipped.
2. **`enable-agents-api.sh` prints the wrong variable name.** Run on ARCA's box it emitted
   `COMPOSER_API_KEY_FOUNDRY` — derived from a default, not from the venture — while the studio looks
   up `COMPOSER_API_KEY_ARCA`. Anyone following the script's own instructions sets a variable nothing
   reads, and gets exactly this failure with no clue why.

Both should be tickets. Flagging them here rather than folding them in, per non-negotiable 3.

## Scope of this pull request

- The board's composer button is an external link to the box's chat, in a new tab, with `noopener`.
- `chatUrl` is threaded through as a real value rather than re-derived in the component.
- `e2e/composer.spec.ts` inverts the assertion it was written to defend, and records **why** in the
  file — an inverted test with no explanation is how the next person re-introduces the bug.

## Explicitly NOT in this pull request

- Deleting the in-studio composer page or its API route. Both stay, both are tested.
- Post-deploy verification of venture connectivity (named above).
- Fixing `enable-agents-api.sh`'s variable name (named above).

## Acceptance criteria

- [x] The board's button opens the venture's own chat on its own screen.
- [x] It opens in a new tab and does not navigate the studio away.
- [x] `rel="noopener"` is present.
- [x] The in-studio composer page still works and stays covered.
- [x] The inverted assertion carries its reason.

## Verification

`COMPOSER_API_KEY_ARCA` set on Railway and proven against the live box: `/api/agents/v1/models`
returns 200 and a real completion round-trips through `agent_foundry_composer`. Lint, typecheck, 646
unit tests and all 12 composer end-to-end tests green. `https://chat.arca.bruntsfield.capital` returns
200.
