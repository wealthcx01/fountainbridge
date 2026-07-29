# Ideas worth applying from meridian-company-os

Studied `codejunkie99/meridian-company-os` (MIT, © 2026 Avidlive) — a polished React "company OS"
operator console over an in-browser store + a local-CLI bridge. It is a strong **console + data-model**
reference, not an architecture reference: its persistence (whole-state JSON blob → SQLite KV), audit
log (in-memory array capped at 400), isolation (client-side, no server authority), and gate
enforcement (a UI simulation — `decideApproval` just flips a flag, hard-codes `decidedBy:"You"`, no
human-vs-agent check) are all **weaker than our git-native, server-authoritative, event-sourced,
separate-executor design** — do NOT adopt any of them. But several data-model + UX patterns are worth
lifting (ideas carry no licence obligation; keep the MIT notice only if we copy non-trivial source).

## Adopted now (FB-044)
- **Per-approval `checks[]` + `diff[]` + back-reference.** `src/lib/types.ts`: an approval carries a
  list of named pass/fail `PolicyCheck { name, passed, detail }`, a before/after `diff[]`, and points
  back at the run it unblocks (`agentId`+`taskId`). We modeled our send-compliance record as `checks[]`
  (recipient class / lawful basis / suppression / sending identity) and the proposal references its
  `ticket`. Inbox framing "the company proposes, you dispose" + a "policy engine clear / N failing"
  badge are good founder-facing copy for the studio approve UI (FB-046).

## Worth applying next (mapped to our tickets)
- **RunReport ← their `RunRecord`** (`types.ts`): `{ status, source: manual|autopilot|space|founding,
  startedAt, finishedAt, durationMs, tokens, costUsd, summary }`. Add the **`source` enum** + cost/
  token/duration to our RunReport contract (FB-042). We already write status/summary/pr_url.
- **Lane cooldown + one-dispatch-per-sweep** (`store.tsx` autopilot ~1288): a per-agent 5-min cooldown
  + one item per sweep + skip-if-live-run. Our run-once already does one ticket/wake + a systemd
  oneshot prevents overlap; add a per-ticket cooldown to smooth re-attempts (FB-040 enhancement).
- **Department budget envelopes** (`Company.budgets: BudgetLine[]`): each of Build/Sell/Scale carries
  a spend envelope that feeds a policy `check` on the gate ("within Sell envelope — 104% of $4,800").
  Pairs with our per-venture budget cap (FB-040 / the manifest).
- **Auto-generated CEO brief** (`Reports.tsx` `plainBrief`): a plain-language digest composed purely
  from live state (burn vs limit, completed/blocked/overdue, pending decisions). Fits non-negotiable
  10 ("fail loud, surface everything") — a founder digest from RunReports + open PRs + lane staleness.
- **"Founding run"** (`runtime.ts` `executeFoundingRun`/`parseFoundingPlan`): a Chief-of-Staff agent
  turns a mission statement into a strict-JSON plan (north-star + goals + starter tasks). Directly
  useful for venture-in-a-day bootstrapping (Phase 5) — seed a new venture's `docs/tickets/` + context.
  Its tolerant fenced/prose JSON extractor is a nice defensive pattern for any structured LLM output.
- **Composer command-grammar-first, LLM-fallback**: parse high-intent phrases ("create task: …, p1")
  deterministically, fall back to the model otherwise — a cheap reliability win for the composer.
- **Design-token discipline** (`ARCHITECTURE.md`): tokens-only (no raw hex/px), one status vocabulary,
  machine values in mono, "no dead UI / every button dispatches something real". A good rubric for the
  studio's grassmarket-token enforcement.

## Explicitly NOT adopting
Whole-state-blob persistence; in-memory capped audit log; the simulation engine (fabricates spend/
heartbeats — a liability for a real platform); client-side store as backend; dev-middleware-as-runtime
(their SECURITY.md says don't deploy it publicly); `override` approvals that only flip a flag.
