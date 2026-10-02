# FB-171 — we call it ActiveGraph, and we are not running ActiveGraph

**Status:** Shipped in part · **Phase:** 3 · **Depends on:** FB-170 · **Raised by:** John, 2026-09-02

**Shipped in part:** the gate is built in real ActiveGraph and proven on this machine against the real
library, but it is not on any box and it is switched off. Still to do: John approves the install and
cut-over in `deploy/activegraph/README.md` (a separate host for the executor, migrate the history with
the studio's secret, a week in shadow, then enforce), and a real external action has to exist to gate —
`performAction` in the executor is still a stub.

## What FB-171 built (2026-10-02)

**What is now true.** Every approval can be recorded in ActiveGraph 1.10.0 — the version on the ARCA
box — as `approval.proposed` → `approval.granted` (or `approval.rejected`) events, with the venture,
ticket and department as objects and relations, and each event keeping the time git recorded. The
executor can ask ActiveGraph "has a person agreed to exactly this?" before it acts. The real executor
was run end to end against a real ActiveGraph store: it sends when both records agree, and refuses or
waits when ActiveGraph has no grant, holds a refusal, or the grant file was written by a lane.

**What is not true yet.** None of this runs anywhere. The executor itself is not deployed on any host,
and its `performAction` does nothing yet, so today **no external action can go out at all**, gated or
not. The new gate is `off` by default; switching it on is the cut-over John must approve. Until then
the gate is exactly what it was: the studio-signed grant file.

**How it is built, and one decision it takes.** Git stays the record, as this ticket's scope says.
`foundry_graph.py` replays the signed git events into ActiveGraph, so the graph is a projection that
can be thrown away and rebuilt. Only the executor writes to the graph. A venture runs one executor
per repo and they share one graph file, so each takes a lock on the file before it reads or writes
it, and they take turns. One writer at a time is why the store is SQLite, not the Postgres this
ticket first proposed. SQLite also gives
fork-and-diff, which ActiveGraph only supports on SQLite. Postgres stays possible later through
ActiveGraph's own `migrate`.

**Two things fixed after review, so the gate is safe to switch on later.** First, if someone writes
into the executor's graph file by hand, the gate now says "not yet", not a final "no". Before, the
executor would have recorded the founder's real approval as rejected, and never looked at it again.
Now nothing is sent, the log says to delete the file, and the next pass rebuilds it from git. Second,
the executors of one venture share one graph file, so each now takes a lock on it and they take turns.

**One correction to the scope.** The scope says to stand ActiveGraph up "on a venture box". The gate
cannot live there: checking a grant needs the studio's signing secret, and FB-071 rests on that secret
never being on a lane box. So the gate's ActiveGraph runs beside the executor, on its own host.

**For FB-248.** Meta's write path can be built on this gate, but nothing it builds can send until the
executor is deployed, `performAction` is wired for that action, and the gate has been turned on.

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

## What is actually on the box, measured 2026-09-25

Checked on the real ARCA box (`venture-arca`, 167.233.160.141), not from memory. My earlier note said
"its service is inactive" — that was imprecise, and the truth matters:

- **The package is installed and it is a real one.** `activegraph 1.10.0` in the venv at
  `/opt/activegraph`, alongside the `anthropic` and `openai` SDKs. CLI at `/usr/local/bin/activegraph`.
- **There is no systemd unit at all.** `systemctl is-active activegraph` returns `inactive` because the
  unit does not exist, not because a service is stopped. Nothing was ever configured to run.
- **No event store anywhere on the box.** Untouched since 2026-08-18 18:52.
- **Room to run it:** 5.8 GB of 7.7 GB RAM available, but the disk is at **83% (6.4 GB free)**. Disk is
  the constraint to watch, not memory.

### It works, and it already does what non-negotiable 4 needs

Smoke-tested on the box (in `/tmp`, removed afterwards). This recorded the exact
`approval.proposed` → `approval.granted` chain as an event-sourced log:

```
evt_001 object.created    ticket    ARCA-001 "send the launch email"
evt_002 object.created    approval  state=proposed action=email.send
evt_003 relation.created  approval#2 --gates--> ticket#1
evt_004 patch.applied     approval#2 state -> granted, by john.gallagher@wealthcx.com
```

Then rebuilt from the event log alone with `Runtime.load(path, run_id)`:

```
IDENTICAL: True
```

**That is this ticket's third acceptance criterion, demonstrated.** Replaying the log reproduces the
graph exactly.

### What `Runtime` gives us that our JSON log does not

Reading the API surface rather than the paper: `approve`, `pending_approvals`, `authority_ceiling`,
`set_authority_ceiling`, `evaluate_capability_authority`, `dev_override`, `validate_dev_override` — an
approval gate with an authority ceiling, as a first-class concept rather than something we assemble.
Plus `fork(at_event)` and `diff(other)` for the fork-and-diff this ticket asks for, `budget` for spend
limits (which `lib/ledger.ts` already models as `spend.over`), and `replay_strict` /
`replay_llm_cache` / `replay_tool_cache` for replay that does not re-hit a model.

Two practical notes for whoever implements this:

- `add_relation` takes object **ids**, not `Object` instances. Passing the object raises
  `NonSerializableEventError` at emit time.
- `SQLiteEventStore` refuses to construct without a `run_id`. Use `Runtime(graph, persist_to=...)`,
  which manages it.
- The library **fails loud with genuinely good errors** — it refuses to persist an event it cannot
  serialise rather than silently pickling it, and says why. That matches non-negotiable 10.

### So the answer to "do we need ActiveGraph running?"

Yes, and it is closer than this ticket assumed: the runtime works on the box today and already
implements the gate, the replay and the fork. What is missing is not ActiveGraph. It is the Postgres
event store this ticket depends on (**FB-170**), which is built but uncommitted on
`fb-170-read-model-runs` and needs a real before/after measurement before it merges.

**This ticket is blocked on FB-170 and on nothing else.** SQLite would work today, and is still the
wrong choice for the reason already given: two writers.

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
      *Built and proven end to end on this machine; not on a box, and no real external action exists
      yet to gate.*
- [ ] Every historical approval is in the graph, with its original time.
      *`migrate` does it, proven on the real ARCA history re-signed with a test key. The real run needs
      the studio's secret, so it is cut-over step 4.*
- [x] Replaying the event log reproduces the current graph exactly. (`replay-check`; also run at the
      end of every `migrate`.)
- [x] A fork of a real run can be diffed against the original. (`what-if`, tested on the real ARCA
      history: forked before the founder's decision, refused there, diffed: granted vs rejected.)
- [x] The gate is never bypassed during the migration, and a test proves an ungated external action
      is refused. (The gate is `off` until switched on and can only ever add a no; the end-to-end test
      runs the real executor and shows a correctly signed grant file with nothing in ActiveGraph does
      not go out.)
