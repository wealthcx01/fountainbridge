# FB-171 — we call it ActiveGraph, and we are not running ActiveGraph

**Status:** Open · **Phase:** 3 · **Depends on:** FB-170 · **Raised by:** John, 2026-09-02

## What is actually true today

The studio has said "ActiveGraph" since FB-012. CLAUDE.md non-negotiable 4 makes it the absolute
gate: *nothing external ever executes without a recorded human approval
(`approval.proposed` → `approval.granted`)*.

What implements that today is **our own JSON event log, written as files to git refs** —
`lib/activegraph-log.ts` appending to `foundry-activegraph`, and `lib/approvals.ts` reading
`foundry-approvals`. It works, it is auditable, and it is not ActiveGraph.

ActiveGraph — Yohei Nakajima's event-sourced reactive graph runtime — **is installed on the ARCA
box** (`/opt/activegraph`, a Python venv, since 2026-08-18) and its service is `inactive`, with no
event store on disk. It has never run. Nothing in `deploy/` imports it.

So: the name is wired through the contracts, the package is on the box, and the two have never met.

## What ActiveGraph actually offers us

From the repo and the paper (*"The Log is the Agent"*, arXiv 2605.21997):

- **Objects, relations, events.** No predefined schema; types are created dynamically.
  `graph.add_object("ticket", {...})`, `graph.add_relation(a, b, "depends_on")`.
- **The append-only event log is the source of truth**, and the graph is a projection of it. This is
  the same architecture FB-170 proposes for the studio, arrived at independently.
- **Relation-behaviours** — logic attached to *edges*, so a dependency can unblock its own target
  without a central orchestrator. Our lane queue is currently exactly this, done by hand in bash.
- **Deterministic replay**, and **fork-and-diff**: branch a run at any event, change one thing, and
  structurally compare the outcomes. For a founder this is *"what if I had refused that?"*
- **Storage**: SQLite by default, `PostgresEventStore` for the event log, FalkorDB for the
  materialised graph with Cypher push-down.

The overlap with what the studio already believes is close to total. The difference is that
ActiveGraph has replay, forking and edge-behaviours, and our JSON files have none of those.

## Scope

- Stand up ActiveGraph properly on a venture box, with the **Postgres event store** pointed at the
  same instance FB-170 creates. SQLite is the wrong default here: two writers (the lane and the
  studio) and PGLite's single-writer contention is already a known problem on these boxes.
- Map the studio's existing entities onto objects and relations: Venture, Lane, Ticket, Approval,
  Department, RunReport are all bcap-contracts types already (non-negotiable 7), so the mapping is a
  translation, not a redesign.
- **Migrate the existing record, do not abandon it.** Every approval already on `foundry-approvals`
  must appear in the graph with its original timestamps, or the audit trail has a hole at the moment
  we started caring about audit trails.
- The approval gate keeps working throughout. This is a swap under a load-bearing wall: the gate is
  the one thing in this product that must never be down.
- Keep git authoritative (non-negotiable 1). The graph is the projection; git is the record.

## Acceptance criteria

- [ ] `approval.proposed` → `approval.granted` for a real external action is recorded as ActiveGraph
      events and gates the action, with the JSON path retired only after it does.
- [ ] Every historical approval is in the graph, with its original time.
- [ ] Replaying the event log reproduces the current graph exactly.
- [ ] A fork of a real run can be diffed against the original.
- [ ] The gate is never bypassed during the migration, and a test proves an ungated external action
      is refused.
