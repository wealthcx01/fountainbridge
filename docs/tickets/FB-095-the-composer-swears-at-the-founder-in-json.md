# FB-095 — The composer swears at the founder in JSON

**Status:** Done · **Phase:** 3 · **Found by:** the founder walkthrough, 2026-08-03 — the first
message a founder sent through the in-studio composer · **Repo:** fountainbridge (+ the venture box)
· **Branch:** `fb-095-the-composer-swears-at-the-founder-in-json` · One ticket = one branch = one PR.

## What happened

Signed in as ARCA's founder, the walkthrough typed a perfectly ordinary request into the composer —
*"I want to redesign the ARCA brand… can you set this up as a piece of work?"* — and received, in
the composer's own reply bubble, this:

> Error: {"type":"empty_messages","info":"Message pruning removed all messages as none fit in the
> context window. Tool definitions consume 4322 tokens (65% of instructions) across 6 tools,
> exceeding maxContextTokens (1024). Reduce the number of tools or increase maxContextTokens.
> Summarization was skipped because the summary would further increase the instruction overhead.\n
> Token budget breakdown:\n maxContextTokens: 1024\n instructionTokens: 6659 …"

A non-technical founder — the only person this surface exists for — is shown token accounting and a
raw JSON blob, in the voice of their own product. This is the single most important screen in the
studio (FB-065's words: "the route that ends the second product"), failing in the least
comprehensible way available.

## Two defects, two fixes

**1. The box's composer agent cannot accept any message (box-side, root cause).** The agent's
effective `maxContextTokens` is 1024 — LibreChat's fallback when it does not recognise the model
name (`claude-sonnet-5` is not in its token map). The agent's own tool definitions are 4322 tokens,
so *every* request dies before the model is reached. The fix is to set `maxContextTokens` (and its
siblings, if any) explicitly in `deploy/librechat/seed-agent.js` `model_parameters`, re-seed via
`deploy/librechat/seed.sh`, and prove a completion round-trips — the FB-088 pattern: read the seeded
record back, then exercise it. Requires box access.

**2. The studio relays engine errors verbatim (studio-side, this repo).** `lib/composer.ts` /
`components/Composer.tsx` pass the engine's error text straight into the conversation. The studio
must translate: a short, human sentence in the composer's voice — *"Something is wrong with this
venture's composer engine — not with what you asked. Bruntsfield has been told; try again once it's
fixed."* — with the raw detail preserved where an admin will find it (the server log, and
`/api/readiness?probe=1`, which should catch a composer that answers 200 to `/models` but cannot
complete). The founder-facing copy never contains JSON, token counts, or the word "prune".

## Why this is worth a whole ticket

FB-087 established that a key that is *set but wrong* is invisible to every check that does not
actually authenticate. This is the next turn of the same screw: the readiness probe hits
`/v1/models`, which answers 200 while every real completion fails. "Ready" must mean "a message can
round-trip", or the wiring warning stays green through a total composer outage — which is exactly
what happened here.

## Scope

- Studio: engine errors are translated to plain language; raw detail goes to the log, never the
  bubble. A unit test feeds the exact error above and asserts the founder-facing string.
- Studio: `?probe=1` exercises a minimal completion, not just `/models`, so a mis-sized agent
  reads as not-ready with the variable/script named for the admin.
- Box: explicit `maxContextTokens` in the seeder; re-seed ARCA; verify by round-trip.

## Explicitly NOT here

- Retrying/queueing failed composer messages (a design question, not a bug fix).
- The numberless-ticket problem (FB-097).

## Acceptance criteria

- [x] The exact error above renders as one plain sentence, and the detail reaches the server log.
- [x] A box whose agent cannot complete a message reports not-ready to an admin, by name.
- [x] ARCA's composer accepts the walkthrough's brand-redesign message end to end (verified on the
      live box after re-seeding with the explicit `maxContextTokens`).
