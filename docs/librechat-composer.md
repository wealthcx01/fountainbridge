# Conversational composer (LibreChat) — design + agent brief (FB-025)

The founder's primary surface should be a **conversation**, not a Kanban board (`parity-critique.md`
§1). This document is the plan for the LibreChat-per-venture composer and the brief for the agent
that turns plain English into work. It is the box-independent half of FB-025; the live stand-up
happens on the venture's Hetzner box (see `deploy/librechat/`).

## Shape of it

```
Founder (Workspace login)
        │  "I want a landing page for the reset"
        ▼
LibreChat  ── on the venture's OWN Hetzner box (D1: one box per venture) ──►  Claude (SDK)
        │                                                                       │
        │  plain-English playback: "Here's the ticket I'll create … OK?"        │
        ▼                                                                       ▼
   Founder approves ──►  ticket written to docs/tickets/ + PR opened (git = source of truth)
```

Nothing is written until the founder says yes (non-negotiable 4). Git stays the store — the composer
is a write-path onto `docs/tickets/`, never a second database.

## Rules (non-negotiable)

- **Isolation (D1 / #6):** one LibreChat instance per venture, on that venture's box. A venture
  session never sees another venture's data — enforced physically (separate boxes), not in the UI.
- **Auth:** sign-in aligns to the venture's Google **Workspace** identity (`founder.workspace_email`,
  the Holy Corner vertical-login pattern) — never a personal account. LibreChat registration is
  locked to that identity (see the deploy `.env`).
- **Reasoning on Claude via the SDK** (portfolio standard).
- **Approval before write:** the loop always ends at an explicit in-chat "yes" before any commit/PR.
- **The studio never merges (#2):** the composer opens a PR and stops; a human merges.

## The ticket-shaping agent — brief

The agent's job is to turn a founder's plain-English intent into **one conventions-compliant ticket**
and play it back plainly. It must:

1. **Clarify, briefly.** Ask at most a couple of plain questions only if the intent is too vague to
   scope (who's it for? what does "done" look like?). Don't interrogate.
2. **Draft one ticket** in the house format below — one ticket = one branch = one PR. Pick the next
   free `FB-XXX` (or venture prefix) id and a kebab-case slug.
3. **Play it back in plain language** — a 2-3 sentence summary a non-technical founder can approve in
   under a minute, then the ticket itself. Lead with the founder-facing "Why this matters" line.
4. **Wait for an explicit yes.** On "yes" → write `docs/tickets/FB-XXX-slug.md` on a new branch and
   open a PR (the write-path; stubbed/minimal in the prototype). On "change X" → revise and replay.
   Never write on a maybe.
5. **Stay in scope + in plain English.** No git jargon in what the founder reads (use the FB-024
   glossary: "Needs your OK", "workstream", "Nothing goes live until you approve it").

### House-format ticket template (what the agent produces)

```markdown
# FB-XXX — <short title>

**Status:** Todo · **Phase:** <n> · **Depends on:** <ids or —> · **Repo:** <repo>
**Branch:** `fb-xxx-slug` · One ticket = one branch = one PR.

## Why this matters (for the founder)
<1-2 plain-English sentences: what the founder gets and why it matters. No jargon.>

## Context
<why now; the smallest necessary background.>

## Scope
- <bullet: what ships in this one PR>

## Out of scope
- <what this explicitly does NOT do (becomes a later ticket)>

## Acceptance criteria
- [ ] <observable, checkable outcome>

## Verification
<how it's checked: /review + /qa + tests/UI-gate as appropriate.>
```

The agent studies the existing `docs/tickets/*.md` for tone and structure before drafting, and the
Bruntsfield Method (jstack, FB-028) once that lands — which folds in Cole Medin's "second brain" and
Cofounder's methods.

## Build order

1. **Box-independent (this PR):** this design + the deploy recipe (`deploy/librechat/`) + the studio
   "Chat" entry point (opens the venture's instance once its box carries a `vps.host`).
2. **On the box (after provisioning):** stand LibreChat up from the recipe, lock auth to the venture
   Workspace, bridge the ticket-shaping agent, and walk the describe → shaped-ticket → playback →
   approve loop end to end, with the isolation check.
