# FB-142 — The Sell trace: what happened to what went out (gap G2)

**Status:** Shipped in part ·  **Area:** Sell / reporting · **Depends on:** FB-128
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

## The provider decision, as the ticket demanded — and what follows from it

**The Gmail API, from the venture's own Workspace. No email service provider.**

It follows from the ratified research rather than from taste. `docs/research-gtm.md` §7 puts sends on
a venture-owned domain inside the venture's own Google Workspace, with SPF/DKIM/DMARC aligned from
day one and an internal-user-type OAuth app on `gmail.send` where that suffices. Adding an ESP would
break that premise: a different sending domain, alignment redone, and the founder's own identity no
longer the sender. The research names Postmark and AgentMail as **Cofounder's** choices, not ours.

### The finding: two thirds of the design's line cannot be obtained

The design asks for *"41 delivered · 29 opened · 3 replied"*.

| | |
| --- | --- |
| **Sent** | **known.** The API returns a message id. That is the whole of what it reports. |
| **Delivered** | **not known.** Acceptance by Gmail for delivery is not delivery. Bounces arrive as a message in the mailbox, which needs a read scope. |
| **Opened** | needs a **tracking pixel** — against the ratified posture (interest-based, consent-first, one-click unsubscribe), and largely defeated by Apple's Mail Privacy Protection anyway. |
| **Replied** | needs **`gmail.readonly`**, a restricted scope requiring CASA verification. A large thing to take in order to render a number. |

`docs/decision-surface-outcomes.md` said Sell's numbers *"arrive free with FB-142 because the provider
reports them."* That was written before this question was settled. **Corrected there.**

So Sell reports what the studio genuinely holds — *the thing you approved on Tuesday went out* — which
is the feedback the gate actually needs, and it is true.

## Acceptance criteria

- [x] The desk's Sell panel shows the last send, or says plainly there has been no send. It reads
      the sends the studio **already gated**: no new pipeline, no new read.
- [x] A metric the provider does not report is absent, never rendered as zero — and the sentence
      names which part is unknown rather than leaving a gap the reader fills in.
- [x] A send that **failed** leads the line rather than being skipped over. A "last send" that
      quietly showed the last *successful* one would hide the single most important event on this
      surface (CLAUDE.md #10). So does one that went out on an approval the studio cannot verify.
- [x] "Open your outbox ↗" resolves to the venture's own Workspace sent view, and is absent rather
      than pointing at somebody's personal inbox.
- [x] The approvals tests pass unchanged — the gate is untouched. Nothing here sends anything; it
      reads records that already exist.
- [ ] A send produces a stored report of delivered/opened/replied. **Not buildable** as specified —
      see the finding above. What is storable is stored.
- [ ] A send appears as hops on its ticket's trail. Not built: the trail joins ActiveGraph events,
      runs and pull requests, and a send hop needs the executor to emit an event shaped for it. That
      is box-side, and box-side work in this repo has no delivery path (FB-163 names the same gap).
- [ ] Interest-based only, with the recipient classification and lawful basis recorded with every
      send. **This is a legal requirement, not a nicety** (§3, §4), and it belongs where the send is
      *performed* — the executor — not where it is reported. Nothing here weakens it and nothing here
      can satisfy it.
- [ ] Proven on a real send to a real interest-flagged recipient. **Not done, deliberately.** Sending
      is the one thing this studio never does without a recorded human approval (CLAUDE.md #4), and an
      agent approving its own test send to satisfy an acceptance criterion is exactly what that gate
      exists to prevent.
