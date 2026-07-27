# FB-025 — Conversational composer (LibreChat prototype)

**Phase:** 3 · **Depends on:** FB-005 (auth), FB-014 (founder identity), FB-020 (repo reads),
FB-021 (boards populate) · **Repo:** fountainbridge (+ per-venture Hetzner VM)
**Branch:** `fb-025-conversational-composer-librechat` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Instead of filling in forms, you just say what you want in plain English — "I want a landing page
for the reset" — and the studio turns it into a proper piece of work, then reads it back to you in
plain language so you can say yes. This is the single biggest thing Cofounder has that we don't,
and it's how the studio should feel: a conversation, not a control panel.

## Context
`docs/parity-critique.md` §1 names the headline gap: **our plan is operator-shaped, not
founder-shaped** — the founder's primary surface should be conversational, not a Kanban board.
The phased plan puts the **conversational composer** in **Phase 3** (Founder experience). This
ticket is the **prototype**: stand up **LibreChat** as the founder's chat surface, scoped per
venture, bridged to the venture's Hetzner VM, where an agent shapes what the founder says into a
**conventions-compliant ticket** (`FB-XXX-slug.md`, one ticket = one branch = one PR) and plays
it back in plain language for approval. **Git stays the store** (non-negotiable: git = source of
truth; the studio is a view + write-path, never a competing DB).

## Scope
- **Stand up LibreChat** as the conversational surface for a venture, reachable from the studio
  (embedded or linked), themed toward grassmarket branding where practical.
- **Isolation (D1 / non-negotiable 6):** one LibreChat instance/scope **per venture**; a
  venture-scoped session must never see another venture's data. Bridge to the **venture's own
  Hetzner VM** — no cross-venture reach.
- **Auth alignment:** the chat identity aligns to the venture's **Google Workspace** identity
  (`founder.workspace_email`, the Holy Corner vertical-login pattern) — not a personal account.
- **Ticket-shaping agent:** the founder describes intent in chat; an agent drafts a
  conventions-compliant ticket (correct frontmatter/heading structure per the existing
  `docs/tickets/` house style, plain-language "Why this matters" line per FB-028) and **plays it
  back in plain language** for the founder to approve before anything is written.
- **Approval before write:** nothing is committed/opened as a PR without explicit founder
  approval in the conversation (gates are absolute — non-negotiable 4). The actual write path /
  PR creation can be stubbed or minimal here; **this ticket is the prototype of the surface**, not
  the full write pipeline.
- **Reasoning model standardised on Claude via the SDK** (portfolio standard).

## Out of scope
- The production write path and the full ActiveGraph approval-event pipeline (later Phase 3
  tickets) — this proves the conversational surface and the ticket-shaping loop.
- Multi-venture routing UI (each venture is its own scoped instance per D1).
- Merging anything (non-negotiable 2 — the studio never merges).

## Acceptance criteria
- [ ] A founder can open a per-venture LibreChat surface from the studio, signed in with the
      venture's Workspace identity.
- [ ] The instance is venture-scoped and bridged only to that venture's Hetzner VM — no path to
      another venture's data (demonstrated).
- [ ] Describing a want in chat produces a **draft ticket in the house format**, played back to
      the founder in plain language.
- [ ] Nothing is written to git / opened as a PR without explicit in-chat founder approval.
- [ ] Reasoning runs on Claude via the SDK.

## Verification
/plan-ceo-review (surface is large/ambiguous) before build; /review + /qa; manual walkthrough of
the describe → shaped-ticket → plain-language-playback → approve loop, with the isolation check.
