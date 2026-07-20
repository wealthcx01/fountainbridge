# FB-012 — Research: agentic GTM on the founder's own Gmail + approval-gate best practices

**Phase:** 0 (parallel; gates Phase 4) · **Depends on:** — · **Repo:** fountainbridge
**Branch:** `fb-012-gtm-research` · One ticket = one branch = one PR (deliverable is a doc).

## Context
Decision D3: GTM agents per venture are a core part of the Foundry offer, and each human founder operates on **their own Gmail account** — unlike Cofounder, which provisions Agentmail inboxes on owned domains + Postmark for transactional. Before building Phase 4, establish best practices; getting deliverability or consent wrong on a founder's personal identity is expensive to undo.

## Scope — questions the research doc must answer
- **Email mechanics:** Gmail API via OAuth (scopes, refresh tokens, MCP servers available) vs SMTP app passwords vs alias/send-as on a venture domain; Google Workspace vs consumer Gmail implications; sending limits and burst behavior.
- **Deliverability:** SPF/DKIM/DMARC when sending as the founder; whether outreach should come from the founder's Gmail at all vs a venture domain warmed separately (what "inbox warming" actually involves; what Cofounder's warming offer does; cold-email compliance — PECR/GDPR for UK/EU founders, CAN-SPAM).
- **Approval gates:** survey of best practice for human-in-the-loop on external sends — ActiveGraph policies (already specified for grassmarket) vs simpler queue-and-approve; what the gate must record (who approved, what exactly was sent, when); draft-in-Gmail-drafts as a natural gate?
- **Non-email GTM:** LinkedIn outreach automation ToS reality-check (relevant: THE RESET's GTM stage 2 is targeted LinkedIn outbound), social posting APIs, Beehiiv (relevant to Briefing Studio too) — each with its gate shape.
- **Recommendation:** a concrete Phase 4 architecture — connector list, gate design (extending the `Approval`/`Department` contracts if needed), per-venture setup checklist — and what THE RESET's GTM lane runs first.

## Out of scope
Building anything; committing contract changes (follow-up ticket if needed).

## Status update — 2026-07-20
**Research executed** in the Cowork planning session (deep-research workflow: 23 sources, 115 claims extracted, top 25 adversarially verified — 25/25 confirmed against live primary sources). `docs/research-gtm.md` drafted with findings, decided architecture, and "what we will NOT do." **Key reversal vs the original assumption: agents never send from the founder's personal Gmail — venture-owned Workspace domains instead.** D3 in the phased plan updated to DECIDED. Remaining work for this ticket in the workshop: John ratifies the recommendation, per-EU-market legal check scoped (open question), Phase 4b ticket set (FB-02x) drafted from §7 of the research doc.

## Acceptance criteria
- [x] `docs/research-gtm.md` drafted: every question answered with sources, a decided recommendation, and an explicit "what we will NOT do" list. *(2026-07-20 session)*
- [x] Recommendation **ratified by John (2026-07-20)** with refinements recorded in the doc's header note: founder identity = BC-assigned venture-domain Workspace account; cold outreach de-scoped, interest-based sends only; stream split (1:1 from founder address, bulk from `mail.` subdomain). Doc still merges via normal PR gate.
- [ ] Phase 4b ticket set drafted from the recommendation (FB-02x series, unscheduled).
- [x] D3 in the phased plan updated from "pending research" to the decided gate design. *(2026-07-20 session)*

## Verification
/plan-ceo-review on the recommendation; sources cited inline.
