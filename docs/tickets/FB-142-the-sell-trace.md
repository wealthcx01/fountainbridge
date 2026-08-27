# FB-142 — The Sell trace: what happened to what went out (gap G2)

**Status:** Todo · **Area:** Sell / reporting · **Depends on:** FB-128
**Design:** `docs/design/foundry-desk/` — screen 3, "Sell · the pipeline"; the trail's send hops.
**Gap:** G2. Rides on the ratified GTM research.

## Why this matters (for the founder)

The studio's hardest gate is on sending: nothing leaves the building without a signed approval
(CLAUDE.md #4). A founder approves a send, it goes, and then — nothing. The studio never tells them
what happened to it.

The design closes the loop on the desk:

> **Sell · the pipeline** — Last send: 41 delivered · 29 opened · 3 replied, September update.
> Open your outbox ↗

A founder who approves sends and never learns whether they landed is being asked to keep making a
decision with no feedback, which is how the gate becomes a rubber stamp.

## What is true today

The send gate exists and is signed and verified (`lib/approvals.ts`, `lib/activegraph-log.ts`,
`lib/provenance.ts`). The GTM architecture is **ratified** in `docs/research-gtm.md` §7 — interest-based
sends only, venture Workspace domains, cold outreach de-scoped entirely — and Phase 4b tickets are
drafted from it. What does not exist is the email service integration and any report of what a send did.

## Scope

- **The email service integration** for the ratified architecture, per `docs/research-gtm.md` §7. The
  research is ratified; this ticket implements it and does not reopen it.

  **But the provider is not named anywhere.** `research-gtm.md` names Postmark as *Cofounder's*
  transactional choice and AgentMail as their inbox layer; it ratifies our architecture — venture
  Workspace domains, interest-based only, split by stream — without choosing a service. Sends go from
  the venture's Workspace, so the primary path may be the Gmail API rather than a provider at all,
  with a provider needed only for the bulk subdomain stream. **Settle that before building**, in one
  paragraph in this ticket or a short memo if it turns out to be contentious. Do not let it be decided
  by whichever SDK gets installed first.
- **Per-campaign report storage**: delivered, opened, replied, per send.
- **A deep link into the venture Workspace outbox** — the design's `Open your outbox ↗`.
- **Send hops on the trail** (FB-125/FB-130), so a send is followable like any other change.
- **The numbers are what the provider reports, or nothing.** Per `docs/decision-surface-outcomes.md`:
  no zero standing in for unknown, no metric the provider does not give us.
- **The gate does not move.** A send still requires a signed, verified approval. This reports on sends;
  it does not perform them.

## Out of scope

- Any change to the sending gate or the approval path.
- Cold outreach. De-scoped entirely by the ratified research; a ticket that reintroduces it is wrong.
- Scale/paid growth — `docs/decision-scale-platform.md`.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run app/actions/__tests__/approvals.test.ts   # the send gate must be untouched
make ticket-drift
```

Before review, on a real send to a real interest-flagged recipient, approved through the real gate.

## Acceptance criteria

- [ ] A send approved through the existing gate produces a stored report: delivered, opened, replied.
- [ ] The desk's Sell panel shows the last send's numbers, or says plainly there has been no send.
- [ ] A metric the provider does not report is absent, never rendered as zero.
- [ ] "Open your outbox ↗" resolves to the venture's Workspace outbox.
- [ ] A send appears as hops on its ticket's trail.
- [ ] The approvals tests pass unchanged — the gate is untouched.
- [ ] Interest-based only, per the ratified research; a test asserts the recipient classification and
      lawful basis are recorded with every send.
