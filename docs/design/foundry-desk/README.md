# Handoff: Foundry Studio desk redesign

## Overview
A ground-up redesign of the Foundry Studio founder front end (the fountainbridge Next.js app) around a persistent-rail "desk": an always-open cockpit where a founder monitors their agent team live, decides what waits on them, follows any ticket to where it changed things (VM, outbox, ad account), discusses tickets in the composer, breaks a PRD into a filed ticket set, and feeds documents into venture memory. Covers founder, new-founder day one, and Bruntsfield admin.

## About the design files
The files in this bundle are **design references created in HTML**: interactive prototypes showing intended layout, copy, states and behavior. They are NOT production code. The task is to **recreate these designs inside the existing fountainbridge codebase** (Next.js App Router + TypeScript, `app/` + `components/`), using its established patterns: server components for reads, the existing server actions for writes, `lib/status.ts` tones, `app/globals.css` tokens, and the design contract in `docs/studio-design-contract.md` (tokens only, one status vocabulary, machine values in mono, no dead UI).

Open `Foundry Studio Full Wireframe.dc.html` in a browser from this folder (keep the folder structure; it loads `support.js` and `_ds/`). Everything is clickable; dashed mono boxes are wireframe annotations, not UI.

## Fidelity
**Mid-fi wireframe.** Contractual: information architecture, screen inventory, section order, copy voice and specific microcopy, interaction behavior, state transitions, empty/degraded states. Indicative: exact pixel values (rebuild spacing in rem per the design contract). One deliberate visual decision to adopt: this design uses the Bruntsfield hairline system — **square corners (border-radius: 0), no drop shadows, 1px `--color-border` rules as structure** — retiring the current `--radius-*`/`--shadow-*` usage so the studio reads as one brand with the main site. Keep the five `--tone-*` colours exactly as they are.

## Screens
All routes keep server-side venture scoping (CLAUDE.md #6). Nav lives in a persistent left rail (250px): The desk, Tickets, Needs you (amber count badge), What happened, Memory, Handbook; below it a live mini-office, per-surface budgets, engine heartbeat, pocket link, sign out.

1. **Sign in** (`/login`) — wordmark, one sentence covering both doors, Continue with Google primary, email+password secondary. Matches the existing page; restyle only.
2. **Day one / first run** (board state `first-run`) — greeting, one primary action ("Tell the studio what you want →"), a "What will be here" list. In the wireframe, day-one is a whole mode: every screen has a truthful empty state (idle office, "No runs yet", empty memory with invitation). Implement the empty states per screen, driven by the existing `boardState`.
3. **The desk** (`/venture/[id]`) — order: eyebrow + h1 + live serif summary sentence; amber blocker banner ("You are the blocker on N items; the oldest has waited X. Decide now →"); degraded-read strip when reads fail (grouped by cause, below nothing a founder must act on); prompt bar ("Tell the studio what you want…") with example chips that seed the composer; **The office** (pixel-agents plate, read-only embed from the venture box, beside the agent ledger — same events, two renderings); **What the engine did** (run reports via `describeRun`, engine heartbeat line, held-plan "Go ahead with this" via `releasePlan` — never labelled Approve); **Waiting on you** (queue rows → ticket); **The company, by surface** (Build: app + VM links; Sell: last send delivered/opened/replied; Scale: honestly "not connected · tbd").
4. **Tickets** (master-detail; absorbs `/attention` as the "Needs you (N)" filter) — filters: Needs you / All / Underway / Done and stopped; live summary sentence ("9 tickets: 3 waiting on you, 2 moving, 4 settled"). Detail: state eyebrow, title, prose paragraphs, trace line ("Follow it to the VM: 3 commits · preview running ↗"), "Discuss in the composer →", branch + `docs/tickets/<id>.md` line ("see where this is written down ↗"), Depends-on chips (clickable, per `depends_on`), decision panel for needs items (Reaches/Costs/Proven, Approve or Approve-and-send via the existing accept/approve actions, Refuse with note via `sendBackWork`, "decision N of M", **Next decision →** chaining after deciding), and **Follow the change: the ActiveGraph trail** — the ordered event list (filed → picked up → commits → checks → preview → waiting → approved/sent), every hop a resolvable link. Trail data is gap G1.
5. **Composer** (from the venture, per FB-065; never a nav item) — two-pane: thread left (visible actions like "Read the PRD from memory: 9 sections"), right rail is either **The ticket, taking shape** (Why/Scope/Done when/Approval, every line from the conversation; File this), **The plan, taking shape** (a PRD decomposed into N tickets in dependency order, per-line Strike/Keep, "File all N" — gap G5), the **ticket under discussion** (when opened from a ticket via `?about=`; File the revision — gap G4), or the after-filing timeline. Nothing files without the explicit press.
6. **What happened** (`/activity`) — live summary sentence, then dated tone-dotted sentences, newest first; decisions appear the instant they are made.
7. **Memory** (`/venture/[id]/knowledge` + routines) — summary sentence, add-a-document input (gap G9), documents table (Document / From / Added / Last used), "What happens without you asking" routines with tone dots.
8. **Handbook** — 3×3 chapter grid → reader (existing markdown, copy untouched, 62ch measure).
9. **Admin** (`/` for admins) — all-ventures ledger: Venture / Founder / Needs them (amber when founder is bottleneck) / Underway / Engine (red when stopped) / Spend (red when over) / action (Open as founder → the founder's exact desk with "← All ventures"); wiring, response-time and onboarding footnotes (existing `readiness` warning).
10. **Pocket** — one-column mobile: blocker chip, mini office, queue, prompt. Extend the FB-009 responsive pass; push on founder-became-blocker is gap G8.

## Interactions and behavior
- Deciding: approve signs the grant (existing attestation path); panel becomes "Approved and verified" + Next decision → (oldest remaining). Refuse requires a note; "Sent back with your note".
- Filing: composer File this / File all N → tickets land as Waiting to be picked up; activity entries written; desk banner recounts.
- Live behavior: keep `WhileWorking`'s discipline (refresh only while working and visible); office plate is a read-only embed (gap G6).
- Hover: colour/underline shifts only, 120-200ms, `cubic-bezier(.2,.6,.2,1)`. No scale, no shadow, no parallax.
- Every ↗ is an external hop (VM diff, preview, outbox, ad account); every → stays in the studio. No dead controls: anything unbuilt says so in words.

## State
Server-rendered as today (board data, attention, approvals, runs, budgets, brief). Client state: selected ticket + filter, composer thread (localStorage per FB-065 until G4), refuse-note open, plan keep/strike set.

## Design tokens
Use `app/globals.css` as-is for colour and type (`--color-paper #f7f6f2`, `--color-ink #17191f`, `--color-accent #1a3b26`, tones `--tone-ok/working/attention/blocked/idle`, serif Source Serif 4 / sans Inter / mono IBM Plex Mono, `--fs-*` scale). Changes this design asks for: border-radius 0 everywhere (inputs may keep 2px), remove card shadows (hairline rules + `--color-paper-sunken` insets carry elevation), replace pill nav with the rail list, eyebrows 11px tracked uppercase, serif page summaries at `--fs-h3`-ish weight 400.

## Dependencies on the back end
`Backend Gaps.dc.html` (bundled) lists gaps G1-G10 with repo anchors and suggested tickets FB-130+. The front end can ship ahead of them: every gap has a truthful placeholder state in the wireframe (e.g. Scale "not connected · tbd"). Build order suggestion is in that paper.

## Assets
No raster assets. The pixel-office is a placeholder drawing; the real plate is the pixel-agents embed (G6). Wordmark is set in type per the brand.

## Files
- `Foundry Studio Full Wireframe.dc.html` — the interactive design reference (all screens, all roles, all states)
- `Backend Gaps.dc.html` — the gap paper (print-ready)
- `support.js`, `doc-page.js`, `_ds/` — runtime for viewing the references in a browser; not for the codebase

## Suggested ticket cut (one ticket = one branch = one PR)
FB-140 tokens + rail shell · FB-141 desk (summary, banner, prompt, surfaces) · FB-142 run log on desk · FB-143 tickets master-detail + decision chaining · FB-144 trail rendering (consumes G1) · FB-145 composer rails (draft/plan/revision UI; consumes G4/G5) · FB-146 memory + add-document · FB-147 admin ledger · FB-148 empty/degraded states · FB-149 pocket pass. Wire each ticket's scope to the matching screen section above.
