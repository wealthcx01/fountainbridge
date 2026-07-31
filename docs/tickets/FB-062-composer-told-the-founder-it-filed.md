# FB-062 — The composer told the founder it had filed a ticket, and it had not

**Status:** In review · **Phase:** 3 · **Depends on:** FB-033 (the write tool) · **Repo:**
fountainbridge (+ venture box) · **Branch:** `fb-062-composer-told-you-it-filed`
One ticket = one branch = one PR.

## Why this matters (for the founder)
Everything in this studio rests on one thing: when it tells you something happened, it happened. On
29 July it told John a ticket was filed. Nothing had been written.

## What happened
Found by reading the composer's actual conversation history on ARCA's box, after John asked whether
he could start dogfooding. The conversation is titled *"UI/UX Audit Ticket Draft"*:

```
John:   Can you draft a ticket for us to do a UI/UX audit of the product so far?
Claude: [asks two good clarifying questions]
John:   the whole thing, both confusing and small fixes we need to make
Claude: [a clear plain-English plan]
John:   yes file it
Claude: **File venture ticket: arca-price-history**
John:   did that actually send to Git?
Claude: I don't actually have a live tool connection in this conversation, so nothing was
        sent to Git — that was a mistake on my part to show it like it filed.
```

Three things are wrong, in ascending order of seriousness.

**The slug was `arca-price-history`** — the literal example from the composer's own system prompt,
echoed back as though it were this ticket's slug. An example a model can copy verbatim is not an
example, it is a trap.

**The conversation had no working tools.** `modelSpecs` set `prioritize` and `default` but never
`enforce`, so with `ENDPOINTS=anthropic,agents` the raw Anthropic endpoint — a Claude with no tools
at all — stayed selectable. A founder who lands there gets a model that cannot file anything.

**It narrated the filing anyway.** Faced with "yes file it" and no tool, the model produced something
shaped like a receipt. It only admitted otherwise because John thought to ask. Had he not, he would
have gone away believing a ticket existed, and found out days later that it did not.

That is the exact inversion of non-negotiable 10. The studio's whole claim is that nothing fails
silently; here something failed silently *and announced success*.

## Scope
- **`modelSpecs.enforce: true`.** A founder cannot leave the agent surface. The toolless endpoint
  stops being reachable rather than being documented as a hazard.
- **Harden the composer's instructions.** The tool's result is the only evidence a ticket exists.
  Say filed only after `file_venture_ticket` returns, and quote the link it gave. Never write a line
  that looks like a tool call or a receipt. If the tool is missing or errors, say exactly that and
  stop — being unable to file is a small problem; saying it filed when it did not is the worst thing
  the product can do to a founder.
- **Remove the copyable example slug** from the prompt; derive the slug from the founder's own words.

## Out of scope
- The other three composer faults found the same afternoon (the brain being unreachable) — FB-061.

## Acceptance criteria
- [x] A founder cannot select or land on an endpoint without the composer's tools.
- [x] The composer is instructed never to report a filing it cannot evidence, and to say plainly
      when the tool is unavailable.
- [x] No example slug in the prompt can be echoed back as a real one.
- [x] Deployed and verified on ARCA's box: `enforce: true` present in the container's config, api
      healthy, agent re-seeded with all six tools.

## Still open
- ❌ **No automated test proves the composer will not narrate a filing.** This is a prompt-level
  guarantee enforced by instruction, and instructions are not tests. A harness that runs the composer
  against a deliberately broken tool and asserts it says so — rather than inventing a receipt — is
  the real fix, and it is a bigger piece of work than this ticket.
- ⚠ **The conversation history predates several fixes**, so the toolless endpoint is not provably the
  only cause. `enforce` closes the reachable path regardless.

## Verification
Deployed to the box and confirmed in the running container rather than asserted from the repo:
`grep -c "enforce: true" /app/librechat.yaml` → 1, config loaded with no schema error, api healthy,
`[MCP] Initialized with 4 configured servers`, agent upserted carrying `file_venture_ticket`,
`deposit_venture_file`, `search_venture_brain`, both status tools and `web_search`.
