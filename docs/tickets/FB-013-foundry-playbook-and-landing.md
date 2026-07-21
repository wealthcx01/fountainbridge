# FB-013 — Foundry Playbook + educational landing surface

**Phase:** 4a (content — ships early, no research dependency) · **Depends on:** FB-005 (app shell) · **Repo:** fountainbridge
**Branch:** `fb-013-foundry-playbook` · One ticket = one branch = one PR.

## Context
The studio is the product — the operational surface where Foundry ventures are run. But a **soft
introduction** matters: a Foundry-wide playbook on how to actually build and sell a company, surfaced
as a warm on-ramp on the landing page before a visitor ever signs in, and as durable reference every
founder and lane can draw on. This is a genuine gap next to Cofounder, whose site leans heavily on
"how to start / how to sell" framing.

**Non-negotiable on originality:** this is **our own synthesis in our own words** — never a copy of
Cofounder's (or anyone's) copy (that's their IP; lifting it is a legal/ethical problem). We rework
the competitive baseline (`docs/cofounder-reference-index.md`) into our voice and, better, apply our
own intelligence on top of two published frameworks we **cite and synthesize** (not reproduce):

- **Bill Aulet — *Disciplined Entrepreneurship* (MIT):** the 24-step build arc across 6 questions —
  *Who is your customer?* (market segmentation → beachhead → end-user profile → TAM → persona),
  *What can you do for them?* (full life-cycle use case → product spec → quantified value prop →
  next-10 customers), *How do they acquire it?* (define your core → competitive position → decision-
  making unit → customer acquisition process), *How do you make money?* (business model → pricing →
  LTV → COCA/CAC), *How do you design & build?*, *How do you scale?*
- **Hamilton Helmer — *7 Powers*:** the strategy/moats layer — Scale Economies, Network Economies,
  Counter-Positioning, Switching Costs, Branding, Cornered Resource, Process Power — each as Benefit
  × Barrier, mapped to the venture's Origination → Take-off → Stability stages.

The **key product stays the focus** — the playbook is the soft intro and reference, not the main
surface. It also seeds the D8 `library/` pattern (Phase 3) at the Foundry-wide level.

## Scope
- **`content/playbook/` (markdown, git = source of truth):** the Foundry Playbook, our synthesis:
  1. **The build arc** — structured on Aulet's 6 questions / 24 steps, reworded and Foundry-specific
     (co-created ventures, interest-based GTM per `docs/research-gtm.md`), with worked examples.
  2. **The moat layer** — Helmer's 7 Powers: when each applies, how to build toward it by stage,
     mapped onto the pipeline ventures (Tier 3 pack) as illustrations.
  3. **Selling & GTM** — reworded from the competitive baseline + our ratified GTM stance (consent-
     first, venture Workspace domains, ActiveGraph-gated) — how a Foundry venture actually sells.
  4. **How Bruntsfield runs a venture** — the operating model (one-ticket-one-branch, the approval
     matrix D7, lanes on a VPS, the studio as the pane of glass) as the founder's "what to expect."
  - Both frameworks **attributed** (author, work) with a short "further reading" pointer; content is
    our application of them, never their text.
- **Public landing surface:** a substantial **educational soft-introduction** section on the Foundry
  landing page — playbook highlights as the warm on-ramp — with the **studio (sign in) as the primary
  CTA**. Renders from `content/playbook/` so copy lives in git, not hard-coded in JSX.
- **Architecture decision (agree in PR):** the studio is currently auth-gated (`/` → `/login`). Either
  (a) make `/` a **public landing** (educational + "Sign in" CTA; the authenticated studio moves to
  `/studio` or renders post-login), excluded from the auth middleware; or (b) host the landing in
  **Holy Corner** (per Phase 5's "Foundry landing page in Holy Corner") and keep fountainbridge the
  authed app. Recommend (a) for now — one deploy, the soft intro where visitors land — with a clean
  path to fold into Holy Corner at Phase 5.
- **Branding:** grassmarket / Bruntsfield tokens (do not invent a theme).
- Mobile-usable (390×844), consistent with FB-009.

## Out of scope
- New operational studio features (write-path, composer, approvals — Phases 2–3).
- Per-venture `context/`/`library/` (that's D8, Phase 3; this is the Foundry-**wide** playbook).
- Any verbatim third-party copy — explicitly forbidden.
- Public marketing beyond the soft intro (full Foundry marketing site is Phase 5).

## Acceptance criteria
- [ ] Playbook covers the build arc (Aulet 6 questions/24 steps), the moat layer (Helmer 7 Powers),
      and Foundry GTM/operating model — **in our own words**, both frameworks cited/attributed.
- [ ] Landing page has a substantial educational soft-intro section rendered from `content/playbook/`,
      with the studio sign-in as the primary CTA; usable at 390×844.
- [ ] **Originality check:** no verbatim passages from `docs/cofounder-reference-index.md` or the
      cited books (spot-check + reviewer sign-off) — it reads as Bruntsfield's own thinking.
- [ ] The public/authed boundary decision is implemented and the auth gate still protects `/studio`
      and all venture data (a signed-out visitor sees the landing, never venture data).

## Verification
/review + /qa + UI-gate gallery (desktop + mobile). Reviewer explicitly checks originality and that
venture scoping is intact after the public-landing change.
