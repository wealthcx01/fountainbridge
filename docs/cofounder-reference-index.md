# Cofounder.co — Reference Index of Features & Capabilities

**Compiled:** 2026-07-20 · **Sources:** cofounder.co (homepage, how-to pages, pricing, resources), docs.cofounder.co (full docs via llms-full.txt), GIC blog posts.
**Purpose:** Reference index for the fountainbridge project — what The General Intelligence Company's Cofounder product actually offers, as a feature checklist to map against Bruntsfield's own substrate.

---

## 1. Positioning & framing

- Tagline: **"Cofounder lets you run an entire company with AI."** Cofounder 2 is positioned as "the infrastructure for the one person billion dollar company."
- Product framing: an AI-powered **company operating system** — "agentic departments, designed like a real company," with managers, shared context, and human oversight through approval workflows.
- Vision principles (from Cofounder 2 announcement): (1) idea → functioning company in a day; (2) running a business should feel like a game, not admin; (3) delegation to agents buys back the founder's life.
- Architecture concept: a **"superoptimizer"** manager agent coordinating departments; integrates existing vertical AI agents rather than replacing them.
- Founder journey framing on the marketing site — four sequential phases:
  - **Start** — pick a wedge, evaluate the idea, ship a domain (incorporation, branding, banking).
  - **Build** — spec → deployment: scaffold codebase, wire CI, run real infrastructure.
  - **Sell** — brand, ICP, outreach, an end-to-end sales motion.
  - **Scale** — analytics, support, unit economics.
- Company: The General Intelligence Company of New York; $8.7M seed round (announced with Cofounder 1.5); Cofounder 1 sunset in favour of Cofounder 2.

## 2. Site map (crawled)

| Area | URLs |
|---|---|
| Marketing | `/`, `/how-to/start`, `/how-to/build`, `/how-to/sell`, `/how-to/scale`, `/pricing`, `/resources`, `/privacy-policy`, `/terms` |
| App | `app.cofounder.co`, `superoptimizers.cofounder.co` |
| Docs | `docs.cofounder.co` — 34 pages across Get Started, Workspace, Agents, Integrations, Publishing, Managed Services, Settings (`/llms-full.txt` exposes all content) |
| Guide | `/guides/cofounder-founder-guide.pdf` |
| Notable articles | `introducing-cofounder-2`, `agent-native-engineering`, `a-day-in-the-life-of-the-worlds-most-ai-forward-company`, `cofounder-partners-with-ramp-to-offer-incorporation`, `yohei-nakajima-activegraph-cofounder`, `cofounder-1-5-seed-round` |

## 3. Pricing model

| Tier | Price | Included usage | Notes |
|---|---|---|---|
| Free trial | 7 days | $10 | Pro features during trial |
| Cofounder Pro | from $20/mo | $20/mo | Pay-as-you-go above included usage |
| Team | from $50/mo | $50/mo | "Coming soon" — multiplayer, SOC 2, priority support |

- Usage-based: included monthly usage covers agents, AI models, compute, database, support, ad spend, data purchasing; overage billed pay-as-you-go.
- **Graduation:** projects are graduable — users can claim ownership of the GitHub, Supabase, and Vercel assets and leave the platform (Cofounder then no longer supports them).
- **No BYO keys:** cannot bring your own API keys or Claude Code subscription.
- Multi-org: free credit applies to first organization only; each additional org needs its own subscription.

## 4. Workspace model

### Canvas (primary surface)
Active tasks with state; agent assignments and workload; department workspaces; department artifacts (e.g. Database in Engineering); **attention queue** (batch review of pending approvals/outputs, with snooze/dismiss); staging URLs; side-panel "Cofounder" agent for routing and workspace questions; **+** menu to create tasks or agents.

### Tasks (the task system)
- Sections: **Needs Action** (clarifications, approval gates, reviewable output, failures) · **Ongoing** · **Todo** · **Done** · **Archived**.
- Task creation: description + optional images, agent assignment (auto-assign or manual), repo context, execution mode.
- **Execute mode** (agent proceeds immediately) vs **Plan mode** (agent proposes an approach as a review item first — recommended for schema/auth/billing/multi-system/uncertain work).
- Task detail: original request, assigned agent, state + elapsed time, workflow items, approvals, artifacts, full conversation transcript; **edit an earlier message** to fork direction when the agent isn't running.
- Reviewable outputs: artifacts, previews, PRs, exports, review URLs.

### Departments (8 seeded)
Engineering, Sales, Marketing, Design, Support, Operations, Finance, Legal. Each groups: agents with lane-specific instructions/integrations, that lane's tasks, **Department Context** (durable shared background — e.g. product constraints, audience/positioning, brand direction, support policies, billing process, compliance notes), and artifacts/files.

### Roadmap
Guided company-building path: stages (idea → initial setup → identity → build → GTM → launch → scale → mature) × tracks (product, engineering, brand, research, operations, revenue, support). Steps have statuses (Available / In Progress / Completed / Locked by prerequisites) and **auto-progress** on signals: completed tasks, approvals, artifact creation, integration connections, infra setup.

### Library
Shared file system for all agents; files tagged by department (routing hint, not an access gate); pinning; chat-with-a-file for focused context; in-app Markdown editing; agents auto-save outputs there. **Reusable scripts** (`scripts/`, Python/Bash/TS/JS) runnable from the Library with an input file (`--input <path>` convention) — pattern for recurring enrichment/transformation jobs.

### Company page & Company Memory
Metric cards (MRR, active users, churn, signups — once a data source is connected); stack setup status (domains, email, payments, hosting); agent roster; **Company Memory** — searchable durable knowledge (decisions, workflows, facts) imported from external AI tools via a copy-paste prompt flow (Settings > Company Context, admin-only, with preview-before-import). Explicitly excluded: secrets, raw transcripts, personal data. Documented caveat: memory can lag — verify against source before external actions.

## 5. Agents

**Composition (every agent):** Instructions + Model + Integrations + Skills + Department.
**Design principle:** agent = worker; skill = reusable guidance attached to the worker; department = operating area that groups workers.

| Agent | Owns | Notable capabilities |
|---|---|---|
| **Cofounder** (workspace-level) | Routing, cross-team questions | Side panel; task creation; publish requests |
| **Engineer** | Code, app, infra, DB, deploys | Inspect repo, edit, run commands/tests, run app locally, local Supabase, open PRs; sandbox **browser testing** of flows (test credentials from AI Settings, local-only seed users via `seed.sql`); migrations through PR flow; agentation bar for direct UI feedback on previews |
| **Marketing** | Campaigns, positioning, creative, launches | Generates HTML decks/mini-sites, images (GPT-4 Vision, Nano Banana, Gemini), Stitch UI concepts, Gamma decks, ACE-Step audio, Seedance short video; campaign briefs, channel plans, SEO briefs; publish-ready drafts gated on review |
| **Design** | Brand, visual systems, decks, email templates, UI kits | Works from locked brand kit / DESIGN.md; design tokens, component rules |
| **Sales** | ICP, pipeline, outreach, CRM | Account/contact finding, inbox warming + outbound setup, draft-first cold outreach, CRM hygiene (Accounts/Contacts/Opportunities/Activity); must not invent pipeline data |
| **Support** | Tickets, triage, CS ops | Structured support database |
| **Operations / Ops** | Recurring workflows, reporting, cleanup | Routes broad tasks; reporting |
| **Finance** | Billing, collections, close, reporting | — |

- **Custom agents:** create via Canvas +; name, instructions, model, connected apps, skills, scheduled tasks. Guidance: one clear job, minimal tools.
- **Skills:** name + description + `SKILL.md` + optional files; create in-app, **import from GitHub**, attach per-agent; built-ins read-only, custom editable. (Same format as Anthropic/Claude skills — i.e. gstack's format.)
- **Routines (scheduled tasks):** per-agent repeating jobs — title, instructions, cadence, optional run criteria ("check now" verifies useful work exists before spinning up), last-result summary, next focus, pause/resume/run-once. Agents may *suggest* routines but must ask before creating one.

## 6. Approval / human-in-the-loop model

- **Attention queue + Needs Action** — single funnel for everything requiring a human.
- **Draft-first pattern** for external actions. Explicit gates: sending email/outreach, calendar changes, CRM status changes, marking deals closed, pricing/scope commitments, social posts, site changes, external-facing decks, generated claims/quotes/numbers.
- **Plan mode** — approval of approach before execution for risky work.
- **Publishing gate** — staging→production is an explicit PR merge (see §8).
- **Auto-merge for Engineer PRs is an opt-in setting** (AI Settings) — default keeps the human gate.
- Pre-ship review guidance: migrations/data changes, auth/billing/secrets/permissions, user-visible UI, external services, untestable tests.

## 7. Integrations

- **Built-in (auto-provisioned):** GitHub, Vercel, Supabase.
- **Standard:** Linear (Cofounder also runs as an agent *inside* Linear), Slack, Notion, Gmail, Intercom, Stripe.
- **MCP toolkits:** Composio-powered catalog — search app, complete auth flow, tools become available to agents.
- **Custom integrations:** name + private API key + allowed domains + optional docs link + read-only toggle (default read-only). Exposed to agents as **env vars, not tools** (`MY_API_API_KEY` / `MY_API_ENDPOINT_URL`); pattern is a saved Library script that reads env vars and calls the API. Security: double-encrypted at rest, sandbox sees a **placeholder** value, backend proxy swaps in the real credential and enforces allowed domains + read/write setting.
- **Stripe specifics:** test/live key separation, verification before "connected," webhook auto-configured at `/api/stripe/webhook`, signing secret synced; Engineer Agent kick-off from Payments settings.

## 8. Managed services & publishing

- **Provisioned at onboarding:** private GitHub repos (**app** + **marketing**, with CI workflow files), Vercel projects for both (staging + production), managed Supabase (staging + production), seeded departments/agents, shared Library.
- **Environments:** `main` branch = staging (staging Vercel + staging Supabase); `prod` branch = production. **Publish = a `main`→`prod` PR** created via Canvas publish button or by asking Cofounder; merge triggers production deploy.
- **Migrations:** `supabase/migrations/` in app repo → PR (linted by seeded workflow) → merge to `main` runs on staging → publish to `prod` runs on production.
- **Domains:** buy/import/transfer in-app; managed nameservers with in-app DNS editing; auto-wiring on assignment: apex→marketing, `staging.<domain>`→marketing staging, `app.<domain>`→app, `staging.app.<domain>`→app staging; Supabase auth config updated; Postmark registered.
- **Email:** Postmark for transactional email; **Agentmail** per-agent inboxes on owned domains (Settings > Inbox: pick agent, domain, handle, provision — agent can then send/receive).
- **Secrets:** encrypted `.env` file storage; secrets pushed to Vercel (not stored internally); opt-in "make available to agents" with the same placeholder/proxy brokering as custom integrations.
- **BYO infra:** import your own GitHub repo or existing Supabase project (Settings > Advanced) with managed wiring preserved.
- **Company formation:** Ramp partnership — incorporate through Ramp inside Cofounder; ambition toward "agentic finance."

## 9. Documented limits & constraints

- Managed app platform is **Next.js-first**; mobile (React Native/Expo) is in-progress, not default flow.
- Users aren't invited into the managed Supabase (Cofounder-operated only).
- CSV import to DB is append-only; generated/identity/array columns unsupported.
- Company Memory can lag; verify before external actions.
- No BYO API keys/Claude subscriptions; graduation ends platform support.
- Team plan (multiplayer, SOC 2) not yet shipped.

## 10. Case studies & credibility notes

- **Yohei Nakajima / ActiveGraph** — used Cofounder to launch ActiveGraph's site, blog, newsletter, audience. (Directly relevant: ActiveGraph is already specified as grassmarket's in-app agent layer.)
- **Daria Ansh / Veery** — solo founder running vetting/SEO/ops through the platform.
- **"A Day in the Life"** — GIC's internal use: engineering delegation + review cycles, structured support DB, ops automations (email drafts, invoices, competitive monitoring, meeting transcription, research loops), hiring research. Their stated killer feature: *"the ability to say, make this an automation, and have the system keep working."*
- **"Agent-Native Engineering"** — task taxonomy: simple (one-pass), manageable (background agents + review cycles), complex (synchronous pairing); quality via rules/tests/linters/review bots rather than human review alone.

---

*This index is descriptive of Cofounder's public offering as of 2026-07-20 and is the reference baseline for fountainbridge feature planning. See `fountainbridge-phased-plan.md` for the Bruntsfield mapping and build plan.*
