---
slug: operating-model
title: How we run a venture
order: 4
summary: The machine behind the studio — lanes, tickets, gates, and the human authority that stays in charge.
---

# How we run a venture

The chapters above are *what* to do. This is the *machine* that does it — the operating model a founder
signs into. It exists so a company can be run day to day without a laptop or a terminal, while a human
always stays in charge of anything that matters.

## One venture, one box, one source of truth

- **One VPS per venture** (Hetzner) runs the workshop stack — agent lanes in tmux, doing the actual
  work. Isolated by construction: a venture's secrets never share a box, and a scoped session can never
  reach another venture's data.
- **Git is the source of truth.** Work items are markdown tickets in the venture repo; the studio is a
  *view and write-path* over git via the GitHub API, not a competing database. Everything a lane does
  becomes a branch, a PR, a commit — legible, reversible, auditable.
- **The studio is the pane of glass.** It reads that git state and renders it: the venture's lanes and
  ticket queues, the attention queue of work awaiting a human, CI and lane health with staleness flags
  so silent failure is impossible to miss.

## The rules that make it safe

- **One ticket = one branch = one PR.** Small, reviewable units. No "while I was in there."
- **Never self-merge.** Engineering changes gate on review; external actions (email, social, CRM,
  payments) gate on a recorded human approval. Nothing external ever executes without a human's yes.
- **The approval matrix (per venture).** Two humans hold authority — the founder (product) and
  Bruntsfield (platform/infra/security) — with dual approval for the high-blast-radius list
  (migrations, auth, payments, secrets, external sends). The attention queue routes each item to the
  right approver.
- **Fail loud.** A founder blocked at 22:00 must see *why* in the studio — run reports, staleness, and
  failure states in plain language, never swallowed.

## Where this is going

Today the studio is **read-only** — it shows you the truth. Next it gains a **write path** (file work
from the studio, agents that wake on a schedule without SSH), then a **founder experience** layer (a
conversational composer, in-studio approvals, context and library the whole venture can read). SSH to
the box stays available to founder and John — the power path, never the required path.

The through-line: **the human decides; the machine does the work; git remembers everything.** That's
the moat you can't buy — [process power](moats), built into how we run.
