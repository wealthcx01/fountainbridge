# FB-037 — Founder→lane execution mechanism (design + spike)

**Status:** Planned (design) · **Phase:** 2 · **Depends on:** FB-033 (a ticket can be filed from the
composer) · **Repo:** fountainbridge (+ per-venture Hetzner VM)
**Branch:** `fb-037-founder-to-lane-execution` · One ticket = one branch = one PR.

## Why this matters (for the founder)
This is the piece that makes the whole thing real: once you describe something and it becomes a
ticket, the venture's agent lanes actually **pick it up and do the work** — draft, build, and put it
back on your board as a finished PR for approval. "I described it" becomes "it's built, waiting for
your yes." Without this, the composer just fills a backlog nobody works.

## Context
FB-033 turns a founder's approval into a filed ticket (a PR adding `docs/tickets/<slug>.md`). The
missing half is **execution**: the Phase-2 "write path + per-venture scheduler / agents-wake-on-ticket"
from `docs/fountainbridge-phased-plan.md`. The agent lanes (gstack/gbrain) that build the studio must
also run **on the venture box** to work the venture's own tickets — one ticket = one branch = one PR,
approvals gated, RunReports written back to the studio. This ticket is **design + a thin spike**, not
the full build — the mechanism is large and must be durable, so it gets CEO/eng plan review first.

**Key questions the design must settle (record the decisions):**
- **Trigger:** how a merged (or approved) ticket wakes a lane — systemd timer polling `docs/tickets/`
  for new/`Todo` items vs a webhook vs a queue. Phased plan leans "systemd timers waking lanes."
- **Isolation & identity:** the lane runs on the venture box (D1), acts as a venture identity, and
  can never reach another venture (non-negotiable 6).
- **The work loop:** claim a ticket → branch `fb-xxx`/`<venture>-xxx` → gstack/gbrain draft + do the
  work → open PR → write a **RunReport** back so the studio surfaces progress (non-negotiable 10:
  nothing fails silently).
- **Gates:** engineering changes gate on PR review; any external action stays hard-gated on
  ActiveGraph (`approval.proposed` → `approval.granted`) — a lane must never send/deploy unbidden
  (non-negotiable 4).
- **Concurrency & safety:** one ticket at a time per lane, no `--no-verify`, no self-merge of
  external-effect changes, loud failure surfaced on the board.

## Scope
- A written design in `docs/founder-to-lane-execution.md`: trigger mechanism, lane runtime on the
  box, the claim→branch→work→PR→RunReport loop, the approval/gate model, isolation, failure surfacing
  — with the decisions above recorded.
- A **thin spike** proving the trigger + claim + RunReport write-back on ARCA's box for ONE trivial
  ticket (no broad autonomous building yet) — enough to de-risk the design.
- `/plan-ceo-review` + `/plan-eng-review` on the design before any wider build; follow-up build
  tickets (FB-03x/04x) derived from the approved design.

## Out of scope
- The full autonomous build-out across all ticket types (derived tickets after plan review).
- GTM/departments (Phase 4) and public/repeatable provisioning (Phase 5).
- Founder-surface `execute_code` — execution lives in the lanes, never on the chat surface.

## Acceptance criteria
- [ ] `docs/founder-to-lane-execution.md` exists with the trigger/runtime/loop/gate/isolation
      decisions recorded, and has passed CEO + eng plan review.
- [ ] A spike demonstrates: a ticket on ARCA's box wakes a lane, is claimed, and a RunReport is
      written back that the studio can surface — for one trivial case, gated, nothing external sent.
- [ ] Follow-up build tickets drafted from the approved design.

## Verification
/plan-ceo-review + /plan-eng-review on the design; /review + CI green on the spike. External gate
intact throughout — the spike opens a PR / writes a report; it never merges or sends.
