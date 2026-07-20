# FB-012 — Agentic GTM Research: Findings & Recommendation

**Date:** 2026-07-20 · **Method:** deep-research workflow — 5 search angles, 23 sources fetched, 115 claims extracted, top 25 adversarially verified (3 skeptical voters per claim, live fetches of primary sources): **25/25 confirmed, 0 refuted** — plus targeted follow-ups on ActiveGraph's runtime and Google's sender guidelines.
**Status:** Recommendation ready for ratification. This answers FB-012's question set and **changes decision D3** in the phased plan.

---

## Headline

> **RATIFIED with refinements — John, 2026-07-20.** (1) "Founder's own Gmail" is hereby defined as a **Bruntsfield-assigned Google account on the venture's Workspace domain**, managed and run by the founder — which is exactly the architecture §7 recommends; the apparent conflict with the original brief dissolves. The internal-app OAuth exemption applies cleanly because the founder's identity is inside the org. (2) **Cold outreach is de-scoped entirely**: agents email only flagged interest (ad responses, waitlist, signups, enquiries) — consent / soft-opt-in ground under PECR, making B2C email lawful. (3) Subdomain question answered: **split by stream** — 1:1 replies to flagged interest from the founder's venture address on the primary domain (they're personal emails and should look like it); bulk/lifecycle/newsletter from a dedicated subdomain (`mail.<venture>.com`) to isolate reputation. Both fully authenticated (SPF/DKIM/DMARC). Everything else below stands as written.

**Venture outreach must NOT run on founders' personal Gmail accounts.** The founder-Gmail path combines the worst of every constraint we verified: Google restricted-scope verification + annual security audits for any draft-first or inbox-reading agent, refresh tokens that die weekly on unverified apps and on any password change, hard caps of ~500/day (consumer) or 2,000/day (Workspace), and the founder's primary identity carrying all reputational risk. The correct architecture is **venture-owned Google Workspace domains under a Bruntsfield-operated Workspace org** — which also happens to be what Cofounder itself does (Agentmail inboxes on owned domains; they never touch a founder's personal inbox). The founder's personal Gmail remains what it should be: the human's identity for logging into the studio (D4) and for human-to-human email.

## 1. Gmail API mechanics (all verified against Google primary docs, July 2026)

- **Scope tiers bite exactly where our approval model lives.** `gmail.send` is a *sensitive* scope; `gmail.compose` (drafts), `gmail.readonly`, `gmail.modify`, and full `mail.google.com` are *restricted*. A draft-first approval pattern built on Gmail drafts — the natural design — puts the app in the restricted tier.
- **Restricted tier = CASA security assessment** by Google-empanelled assessors for any app relaying data through a server, **re-assessed every 12 months**. A real, recurring compliance cost.
- **Unverified apps are unusable in production:** external apps in Testing status get **7-day refresh tokens**; unverified restricted-scope apps face a ~100-account cap; refresh tokens with Gmail scopes are **silently invalidated when the user changes their Google password**. An agent on a founder's personal Gmail can break weekly, or after any routine password change.
- **The escape hatch that decides the architecture:** apps used only inside your own Google Workspace org (**Internal** user type) are **exempt from restricted-scope verification and CASA entirely**. This only works for identities inside the org — i.e. venture Workspace domains — never for consumer Gmail. (2-1 verifier vote with one caveat: the *domain-wide-installation* exemption alone covers less; it's the internal-use exemption that carries the path.)
- **Volume ceilings per identity (Workspace):** 2,000 messages / rolling 24h; 3,000 unique recipients/day of which **max 2,000 external**; 500 recipients/message via API; ~60 send-calls/user/minute (6,000 quota units @ 100/send). Consumer Gmail: ~500/day. One identity is never a bulk channel; scale = more identities on the venture domain, not bigger blasts.
- **Send-as/alias:** a Workspace account can send-as on a validated alias/domain, but alias sends still count against the sending account's limits and inherit its reputation — an alias is not an isolation mechanism.

## 2. Deliverability (Google's own rules verified; practitioner lore flagged as such)

- **Google sender guidelines (all senders):** SPF or DKIM, valid forward/reverse DNS, TLS, spam rate **< 0.3%** in Postmaster Tools.
- **Bulk senders (≥5,000 msgs/day to Gmail):** SPF **and** DKIM **and** DMARC aligned with the From: domain, **one-click unsubscribe** (`List-Unsubscribe` + `List-Unsubscribe-Post` headers), gradual volume ramping, no sudden spikes. Yahoo mirrors these requirements.
- **Warm-up services:** practitioner claims about warm-up effectiveness did **not** survive into the verified set (and Google has historically been hostile to artificial warm-up networks). Treat "inbox warming" as unproven-to-risky; what *is* verified is the boring version — authenticate properly, ramp gradually, keep complaint rates low, use a domain with real traffic history. **Do not buy a warming service reflexively because Cofounder sells one.**
- **Structural implication:** outreach runs from a **venture subdomain** (e.g. `mail.thereset.com` or a sibling domain) so the apex domain's transactional reputation is never hostage to outbound experiments.

## 3. Legal — the finding that reshapes Phase 4 (verified against ICO primary guidance)

- **B2C cold email to UK consumers is effectively prohibited.** PECR: no marketing email to individual subscribers without **prior specific consent or soft opt-in** — a cold prospect has neither, by definition. The **Data (Use and Access) Act 2025 raised PECR fines to UK-GDPR levels (£17.5m / 4% turnover)**. The rule has hardened, not relaxed.
- **The soft opt-in can never legitimise cold outreach:** it requires details collected *by you, from the person, during a sale or negotiation*, similar products only, opt-out at collection and in every message. ICO, verbatim spirit: *there is no such thing as a compliant third-party marketing list.* Bought lists are radioactive.
- **B2B cold email is lawful, with two traps:** corporate subscribers (ltd companies, LLPs, Scottish partnerships, public bodies) may be emailed without consent — subject to honest identity + valid opt-out — **but** (a) **sole traders and ordinary partnerships count as individuals** (consent needed — highly relevant when prospecting small immigration lawyers, contractors, boutique advisers), and (b) **UK GDPR applies to any named work email** (`jane.smith@firm.com`): you need a lawful basis (legitimate interests + documented three-part test), and the **right to object is absolute** — hence a per-venture suppression list checked before every send.
- **EU caveat (honest gap):** verified findings are UK/ICO-specific. EU member states implement ePrivacy with national variation — Germany (UWG, double opt-in norms) is stricter, and the UK's corporate-subscriber carve-out is not universal. **Rule until researched per-market: UK rules as the floor, per-country check before any EU sends.**
- **What this means for THE RESET specifically:** it's B2C — **cold email to consumers is off the table as an acquisition channel, full stop.** Its lawful GTM = exactly what its own deck already says: content/SEO, case studies, webinars, curated community — funneling into **opt-in capture (waitlist, platform signup)**, after which consented lifecycle email is fully lawful and agents can run it draft-first. Cold *B2B* outreach remains lawful and useful for The Reset's **partner network** (immigration firms, contractors, FX brokers — mostly corporate subscribers). The GTM department splits cleanly along this legal line, which matches the plan's 4a/4b split.

## 4. LinkedIn (verified against LinkedIn's official docs)

- **No self-service API path for outreach exists.** Open permissions are only: Sign-in (OIDC `profile`/`email`) and **Share on LinkedIn** (`w_member_social` — post/comment as the authenticated member). The **Messages API is restricted to approved partners**; Marketing/Sales-Navigator/Talent tiers all require LinkedIn approval or formal partnership.
- Every "LinkedIn automation" tool therefore operates outside official channels (session/browser automation), with account restriction risk on the *founder's personal profile* — the one asset they can't replace. (2025-26 enforcement specifics didn't survive verification; the official position alone is sufficient to set policy.)
- **Policy:** agents **draft**, humans **send**. `w_member_social` is used for sanctioned posting of venture content; connection requests and DMs are executed by the human founder from a queue of agent-prepared, approved drafts. This is slower and legally/platform-safe — and at Foundry scale (tens of sends/day, not thousands) the human-execute step is not the bottleneck.

## 5. The approval gate (ActiveGraph verified fit)

ActiveGraph's runtime is event-sourced with approvals as first-class lifecycle events (`approval.proposed` → `approval.granted`), an **immutable append-only event log that *is* the audit log**, actor attribution and causal lineage per event, and deterministic replay. That is precisely the record-keeping shape PECR/GDPR accountability wants. **D3 resolves: ActiveGraph is the gate runtime for external actions**, alongside the PR gate for repo work.

**Every external send is an `approval.proposed` event carrying:** recipient + **PECR subscriber classification** (corporate / individual / sole-trader-as-individual), **lawful basis** (consent ref, or legitimate-interests assessment ref for B2B), **suppression-list check result**, the **exact draft** (frozen at approval), channel + **sending identity and OAuth scope**, and on grant: **approver + timestamp**. Unsubscribes/objections write back to the suppression list as events. One LIA template per venture, referenced per-send — not re-argued per email.

## 6. The competitive bar (Cofounder), reread against these findings

Cofounder's stack — Agentmail inboxes on **platform-provisioned owned domains**, Postmark for transactional, warming as a product feature — confirms rather than contradicts our architecture: *nobody credible sends agent outreach from a founder's personal mailbox.* Where we can be **better than the bar**: (1) compliance-as-a-feature — Cofounder's docs gate sends on review but record nothing like a PECR classification or LIA reference; our gate makes every send defensible to a regulator, which is exactly the posture a bank counterparty (B2B motion) will diligence; (2) no artificial warming dependency; (3) the founder's personal identity is never the blast radius.

## 7. Decided architecture (Phase 4b)

1. Per venture: **Google Workspace on a venture-owned domain** inside Bruntsfield's Workspace org (or venture-owned org with Bruntsfield admin — decide per co-venture agreement); founder gets `founder@venture.com`; agents get scoped identities (e.g. `hello@`, `partners@`) on an **outreach subdomain**.
2. **Internal-user-type OAuth app** (verification-exempt) or `gmail.send`-only where sufficient; SPF+DKIM+DMARC aligned from day one; one-click unsubscribe headers on anything marketing-shaped; Postmaster Tools monitored; ramp gradually.
3. **All sends draft-first through the ActiveGraph gate** with the §5 record; suppression list per venture; volumes respect the 2,000-external/day per-identity ceiling with lane-level budgets far below it.
4. **B2C ventures:** no cold consumer email — agents run content/SEO/lifecycle-email-on-consent (4a machinery + gated sends to opted-in users). **B2B outreach** (partners, banks): corporate-subscriber targeting with GDPR LIA + suppression discipline.
5. **LinkedIn:** agent-drafted, human-sent; `w_member_social` for content posting only.
6. **Per-EU-market legal check** before any non-UK sends (open question below).

## What we will NOT do

No sending from founders' personal Gmail (any scope beyond the human's own use). No bought lists, ever. No B2C cold email in UK/EU. No LinkedIn automation tools on founder profiles. No production OAuth on unverified apps. No artificial warm-up networks. No send without a recorded, replayable approval event.

## Open questions (carried forward)

Per-EU-market ePrivacy variance (Germany/France/Netherlands) before any EU sends; LinkedIn enforcement thresholds (empirical, if we ever reconsider); whether Bruntsfield runs one Workspace org for all ventures vs org-per-venture (interacts with the co-venture agreement and the D7 matrix); warm-up efficacy if outbound volumes ever justify revisiting.

---

## Sources

Primary (all fetched live and adversarially verified 2026-07-20): [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) · [Restricted-scope verification & CASA](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) · [OAuth2 token behavior](https://developers.google.com/identity/protocols/oauth2) · [Workspace sending limits](https://support.google.com/a/answer/166852) · [Gmail API quotas](https://developers.google.com/workspace/gmail/api/reference/quota) · [Google email sender guidelines](https://support.google.com/a/answer/81126) · [ICO: electronic mail marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/) · [ICO: complying with PECR email rules](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/) · [ICO: B2B marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/) · [LinkedIn API access tiers](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) · [LinkedIn Messages API (partner-restricted)](https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages) · [ActiveGraph events & approvals](https://docs.activegraph.ai/concepts/events/) · [AgentMail domain warming](https://docs.agentmail.to/knowledge-base/domain-warming). Secondary/practitioner sources consulted but held to lower confidence: Nylas CASA guide, Smartlead/Mailreach/Reachly deliverability posts, AgentMail-vs-Postmark comparison.
