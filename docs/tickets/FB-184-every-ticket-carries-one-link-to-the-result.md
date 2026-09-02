# FB-184 — every ticket carries one link to where you can see the result

**Status:** Open · **Phase:** 3 · **Touches:** bcap-contracts · **Raised by:** Claude Design, 2026-09-02

## What was asked for

> "That's the trail's terminal hop, made a first-class field. Every ticket carries one resolvable
> inspection URL by surface: Build → the running preview, deep-linked to the changed part where
> possible; Sell → the outbox/campaign view for that send; Scale → the ad suite once connected,
> honestly absent until then. Concretely: add `trace_url` to the ticket schema (or have the trail
> endpoint resolve it) so the 'Follow it to…' line and the ticket detail's ↗ always point somewhere
> real — **and never render the link when it can't resolve (no dead UI).**"

## Why it matters

A founder's question at the end of a piece of work is not "was it merged", it is **"can I see it?"**.
The studio currently answers that inconsistently: FB-132's trail has a terminal hop for some tickets,
the surface cards have a launch link when the surface has one, and the ticket detail has a link to
the code host — which is the one place a founder should not have to go.

One field, resolved once, used everywhere those three currently disagree.

## The constraint that shapes it

**Never render the link when it cannot resolve.** A "see it running ↗" that 404s is worse than no
link: it teaches a founder that the studio's promises are decorative. The field is therefore nullable
by design, and the absence has its own words — *"not connected yet"* — which is the same degraded
rule the surface cards already follow.

## Scope

- Add `trace_url` (nullable) to the Ticket entity **in bcap-contracts** — non-negotiable 7: schema
  changes happen there and are consumed here as generated types. This is the part that needs
  sequencing with that repo's lane, and is why this is its own ticket rather than a line in another.
- Resolve it per surface: Build from the venture's running preview (deep-linked to the changed route
  where the trail knows one), Sell from the send's outbox reference (FB-142 already builds one),
  Scale absent until an ad account is connected.
- Use it in three places that currently answer differently: the trail's terminal hop, the ticket
  detail's ↗, and the surface card's door.
- Prove resolvability before rendering. A stored URL is a claim; the studio should not repeat a claim
  it has not checked.

## Acceptance criteria

- [ ] A Build ticket whose work is deployed links to the running preview.
- [ ] A Sell ticket whose send went out links to that send.
- [ ] A Scale ticket says "not connected yet" and renders no link.
- [ ] No `trace_url` is rendered as a link without being resolvable.
- [ ] The trail, the ticket detail and the surface card all read the same field.
