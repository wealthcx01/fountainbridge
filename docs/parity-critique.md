# Foundry Studio vs Cofounder — Critical Parity Review

**Date:** 2026-07-20 · **Posture:** adversarial review of our own v2 plan against the Cofounder reference index. Goal stated by John: **at least at par, if not better.** This document scores honestly, including where the current plan loses.

---

## 1. The headline criticism: our plan is operator-shaped, not founder-shaped

Cofounder's core interaction loop is **chat-first**: the founder talks to an agent (the side-panel "Cofounder," or a department agent), and tasks, plans, and artifacts fall out of the conversation. Our v2 plan's core loop is **ticket-first**: markdown in `docs/tickets/`, filed through a form, reviewed as PRs. That loop is why the workshop works — for John, an engineer-operator who thinks in tickets. Ross does not think in tickets. Neither will the CANON CEO or a bank sponsor.

The v2 plan buries the fix ("plain-language ticket composer") as one line in Phase 3. That is the single most important parity feature and it deserves first-class treatment: a **conversational surface in the studio** where the founder describes what they want, an agent (gstack /plan-ceo-review behind the scenes) shapes it into a proper ticket, shows it back in plain language, and files it on approval. Git stays the source of truth underneath — the conversation is the composer, not the store. **Verdict: BEHIND → fixable in Phase 3 if scoped as a real feature, not a form.**

## 2. Time-to-value: Cofounder delivers in a day; our plan delivers in phases

A Cofounder signup has repos, hosting, DB, staging/prod, seeded agents and a working surface **the same day**. Our v2 sequencing has THE RESET waiting behind Phase 0–2 (contracts, dogfood, scheduler) before touching anything. That's a sequencing error in how the plan is *stated*, not in the machinery: the workshop needs no studio to start delivering The Reset's build. The plan must say explicitly: **The Reset's engineering starts in the workshop on day one** (VPS from FB-011's runbook, lanes, tickets via John as interim interface — exactly how grassmarket runs today). The studio catches up to a venture already in motion. **Verdict: PAR in substance, BEHIND as written → fixed by re-statement + FB-011 executing early for The Reset, not just a scratch box.**

## 3. Previews and the founder review experience

Cofounder gives founders: Vercel preview per change, staging URLs, an "agentation" feedback bar to comment directly on the UI, and browser-tested flows before PR. Our plan gives: CI UI-gate screenshots in a PR — built for a code reviewer, not a founder. Two concrete gaps:

- **Preview links must surface in the attention queue** (a founder should click a URL and see the change, not read a diff). Cheap: Vercel preview URLs are on the PR; FB-007 should carry them. *(Applied to FB-007 in this revision.)*
- **Founder-facing approval must eventually live in the studio**: summary of the change in plain language + preview link + Approve button (merge via API). v2 says "the gate stays on GitHub" — right for v0, but requiring founders to review on github.com is a parity loss; Cofounder wraps every approval in one queue. Close it in Phase 3. **Verdict: BEHIND → Phase 3 scope.**

## 4. GTM sequencing: half of GTM needs no research and we deferred all of it

The v2 plan gates all of Phase 4 on FB-012 research. That conflates two different things:

- **Sends** (cold email, LinkedIn outreach, social posting) — genuinely gated on FB-012; deliverability/compliance risk is real.
- **Content and site** (landing page, case-study posts, SEO, decks, webinar collateral) — this is *repo work with a PR gate*. The machinery for it exists **today**. The Reset's own GTM stage 1 is exactly this (landing page + 3 case studies + webinars), and Cofounder ships a Marketing department on day one.

Phase 4 splits: **4a Content/Site GTM** (a `marketing` repo per venture + marketing role skills in gstack — can start as soon as Phase 1 exists, arguably before), **4b Outbound** (post-FB-012). **Verdict: BEHIND by our own sequencing error → fixed by the split; 4a is where we can be *better* than Cofounder quickly, because our content ships through real CI with real review, on the venture's real domain.**

## 5. Memory, context, and files: Cofounder has three systems; we have one

Cofounder: Company Memory (durable facts, searchable), Department Context (per-lane background), Library (shared files, agent outputs, runnable scripts). Us: gbrain — engineering-lane memory. Real founder use involves brand kits, ICP notes, decks, research packs. Where does The Reset's brand PDF live so every lane can use it? Unanswered in v2. Cheapest git-native answer: a `context/` + `library/` convention in the venture repo (department-tagged folders, agents read/write there, binary-heavy assets in object storage with pointers). Needs a decision and a ticket in Phase 3; without it, department context (Phase 4) has no substrate. **Verdict: BEHIND → new decision needed.**

## 6. Governance: who approves what on a venture repo?

Cofounder is unambiguous: the founder approves everything (with opt-in auto-merge). Our model has two humans — the founder (product authority) and John/Bruntsfield (engineering + platform authority) — and v2 never says who merges what. Options: founder approves product-visible changes, Bruntsfield approves platform/infra/security; or dual-approve for migrations/auth/payments (mirroring Cofounder's own pre-ship review list). This is a co-venture governance question, not a technical one, and it must be written into each venture manifest (approval matrix per repo path or ticket label). **Verdict: GAP unique to our model (Cofounder doesn't have co-ownership) → new decision D7.**

## 7. Scheduler vs routines: ours is a cron, theirs is a product

Cofounder routines carry per-routine criteria ("check now — is there useful work?"), last-result summary, next focus, pause/resume/run-once, and agents *propose* routines. Our Phase 2 sketch (systemd + standing orders + pre-check + RunReports) matches the runtime but not the management surface — founders must see and control their routines in the studio. Fine to build management UI in Phase 3–4, but name it now so Phase 2's daemon exposes state the UI can read (RunReport contract already helps). **Verdict: PAR at runtime, BEHIND on surface → scope note for FB-010's Phase 2 drafting.**

## 8. Platform economics and quiet risks

- **Shared Claude Max across ventures.** All ventures currently ride John's Max subscription. Two risks: rate/usage ceilings as lanes multiply (the scaling checklist already hints at this), and terms-of-service exposure when a subscription benefits third-party commercial ventures. Cofounder charges usage per org precisely because this is where costs live. Needs an explicit check + per-venture cost line in FB-011's runbook (even if the answer is "fine for now"). **Verdict: unexamined risk in v2.**
- **Support burden** stands from v1: Cofounder has a support org; we have John. Run reports + failure states in-studio (Phase 3) are the mitigation; per-venture VPS rebuild drill (FB-011) is the backstop.
- **Unscraped surfaces:** app.cofounder.co (behind signup), the founder-guide PDF, and superoptimizers.cofounder.co were not indexed; the reference index covers marketing + full docs. Known blind spot, low expected delta.

## 9. Where we are genuinely ahead (the honest other half)

- **Ownership without graduation.** Cofounder's founders rent until they "graduate" (and then lose support); our founders co-own the repos, the VPS, and the infrastructure from day one — SSH included. For a Foundry, this is structural advantage, not marketing.
- **Production discipline.** Branch protection, mandatory CI, UI-gates, never-self-merge — Cofounder offers *opt-in auto-merge*; our defaults are stricter than their defaults, and ~75 merged PRs prove the loop.
- **ActiveGraph.** Cofounder's own case study is our in-app agent layer. Approval-as-runtime-guarantee inside the venture's product is something Cofounder does not offer its founders at the app layer.
- **No platform lock-in on models/keys.** Cofounder: no BYO keys, no Claude Code subscriptions. Us: the whole substrate *is* Claude Code, and we choose our stack per venture.
- **Physical isolation.** Per-venture VPS beats shared multi-tenant sandboxes for a wealth-adjacent portfolio (and is a straight answer to a bank's due-diligence in the B2B posture).
- **A human partner.** The co-venture model bundles judgment (John, Ross-side expertise, the Foundry network) that a $20/mo SaaS structurally cannot. The studio should make this visible (named humans in the attention loop), not hide it.

## 10. Scorecard

| Capability | Cofounder | Foundry Studio (plan v2→v3) | Verdict |
|---|---|---|---|
| Chat-first founder interaction | ✅ core loop | Phase 3 composer (upgraded scope) | **Behind → planned** |
| Day-one venture delivery | ✅ | Workshop delivers day one; studio catches up (restated) | **Par (restated)** |
| Task board + attention queue | ✅ | P1 (+preview links) | Par by P1 |
| Founder-facing approvals in-product | ✅ | P3 (approve+merge in studio) | **Behind → P3** |
| Engineering agents + gates | ✅ opt-in auto-merge | ✅ stricter defaults, proven | **Ahead** |
| Previews/staging | ✅ + agentation | Vercel previews surfaced P1; feedback-on-UI later | Behind (agentation) |
| Scheduler/routines | ✅ full product | Runtime P2, mgmt surface P3–4 | Behind on surface |
| Content/site GTM | ✅ day one | **4a — pull forward, PR-gated on real CI** | Par → Ahead potential |
| Outbound/sends | ✅ managed inboxes + warming | 4b post-FB-012 | Behind (deliberately) |
| Memory/context/library | ✅ three systems | gbrain + new context/library decision | **Behind → decision needed** |
| Managed infra per tenant | ✅ minutes | FB-011 runbook→script (target: day) | Behind on speed, ahead on ownership |
| Domains/email in-product | ✅ | Manual per venture | Behind (accepted) |
| Governance for co-ownership | n/a (renter model) | **D7 approval matrix — must define** | Unique to us |
| Ownership, isolation, human partner | ✗ | ✅ | **Ahead** |

**Bottom line:** the substrate is ahead; the *founder experience* is behind. Everything in the Behind column is addressed in plan v3 (restated Phase 3 scope, Phase 4 split, D7, context/library decision) — none of it requires new invention, only sequencing and honesty about what "founder-grade" means.
