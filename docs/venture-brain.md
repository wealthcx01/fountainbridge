# The venture brain (FB-050)

**What the founder gets.** Everything the venture knows — what they've told the composer, the
documents they've saved, the ticket backlog, the code that already exists — becomes *searchable by
meaning*. Ask the composer "who are we actually for?" and the answer comes from what the venture has
decided, not from the model's imagination. Start a piece of work and the agent lane plans it having
already read the relevant background, instead of guessing at filenames.

This is the venture's real memory. FB-043 gave it a place to put things (`context/`, `library/` in
git); FB-050 makes what's in there findable.

Applies **gbrain** as the D8 index over git, in the Archon-RAG role the method doc (§5) describes.

---

## 1. Where it lives

One brain per venture, on the venture's own box (D1). A local **PGLite** database at
`/opt/foundry/brain` — no external database, no shared index, no path by which one venture's brain
could answer another venture's question. The venture repo is registered as a gbrain **source**; the
brain's own storage is deliberately *outside* the venture worktree, so nothing gbrain writes can ever
be swept into a founder-facing PR by the lane's `git add -A`.

## 2. What is indexed, and the department partitions (D8)

Two passes over the venture repo, prose first:

| Pass | Covers | Why |
| --- | --- | --- |
| prose | `context/`, `library/`, `docs/tickets/`, root docs | what the founder and the backlog *say* |
| code | the venture's source | how something is *already built* |

gbrain slugs are path-derived — `context/build/ideal-customer.md` indexes as
`context-build-ideal-customer` — so the department a page belongs to is legible from its slug. That
is the partition:

- A **build** lane's RESEARCH sees the Build surface's context plus everything shared (tickets, code,
  `context/general/`, root docs). It does **not** see `context/sell/` or `library/scale/`.
- The **founder's composer** searches unpartitioned. They own every surface.

`gbrain-refresh.sh` also tags each departmental page `dept:<name>`, so the partition is inspectable
by hand: `gbrain list --tag dept:sell` is exactly what the Sell surface owns. The retrieval filter
itself is `partitionForDepartment()` in `deploy/lane/brain-lib.mjs` (unit-tested).

**Known limitation, stated plainly:** a search hit carries no file path, so the department is read
off the slug prefix. A top-level file literally named `context/build-thing.md` would read as
`build`. The deposit tool only ever writes `<area>/<dept>/<slug>.md` with the department from a fixed
enum, so this does not arise on the path that produces departmental knowledge.

## 3. How the lane uses it — the RESEARCH step

RESEARCH is the R in the RPIV loop (`docs/lane-rpiv-loop.md`). Before FB-050 it was a hint telling
the model to go and read `context/`. Now the supervisor does the retrieval itself:

```
ticket → researchQuestion() → gbrain query → partition to this department → digest → the PLAN prompt
```

Deterministic on purpose. The gate is supervisor-owned bash everywhere else in this loop for the same
reason: what the lane plans from should not depend on whether a model chose to call a tool.

- The question is built from the ticket's title, "Why this matters", Context and Scope — not from
  "Out of scope" or the acceptance criteria, which pull a search away from the subject matter.
- The digest is deduped to one entry per page, capped per page and overall, so a broad match can
  never bury the ticket in its own plan prompt.
- **Degradation is loud, never silent (#10).** No brain, a wedged brain, or a query timeout ⇒ the
  lane falls back to reading `context/` files exactly as it did before FB-050, logs the reason, and
  records `Research: files (brain unavailable)` in both the PR body and the RunReport. A lane must
  keep working when an index is down; the founder must be able to see that it did.

## 4. How the composer uses it — the bridge

gbrain runs on the **host**. LibreChat runs in Docker. A single-writer PGLite database must not be
mounted into a second container while the host is syncing it, so the composer does not touch the
brain directly:

```
composer (container) → brain-mcp/stdio.mjs → host bridge :3131 → gbrain call query → digest
```

`deploy/lane/brain-bridge.mjs` is the single process on the host that owns brain access for the
composer. Its safety properties, each deliberate:

- **Read-only by construction.** One operation, running a *fixed* `gbrain call query` argv. No tool
  name, flag or slug from the caller reaches gbrain. Writing to the venture's knowledge remains the
  separate, explicitly-authorised deposit tool (FB-043).
- **Token required.** It refuses to start without `FOUNDRY_BRAIN_TOKEN` rather than listen
  unauthenticated. `install-gbrain.sh` generates it and puts the same value in LibreChat's `.env`.
- **Never binds `0.0.0.0`.** The docker bridge address by default (which is what
  `host.docker.internal` resolves to from the venture's containers), `127.0.0.1` with a loud warning
  if that interface is missing.
- **One query at a time,** under a systemd memory cap. On a 2 GB box also running the founder's live
  composer, a burst of questions must not be able to starve it.

The composer's system prompt (`seed-agent.js`) instructs it to search the brain *before* answering
anything about the venture, so the composer and the lanes never disagree about what the venture
knows. That closes the last of the FB-034 silo: LibreChat's per-chat store defers to the brain, which
indexes git.

## 5. Keeping it current

**The lane owns git; the brain owns the index.** The refresh never pulls, checks out or cleans
anything — it indexes what is on disk. Two triggers:

- **Every lane wake** (`run-once.sh`), right after the worktree is reset to the base branch. This is
  the one moment the tree is guaranteed clean and current, so it is where a merge gets indexed —
  within a few minutes of merging. Best-effort and time-boxed: a refresh must never stop the lane
  from working.
- **`foundry-brain-sync.timer`**, every 15 minutes, to cover stretches when the lane is idle.
  Calendar-scheduled, not monotonic, for the reason PR #49 recorded: a monotonic timer stalls after a
  restart and would leave the brain silently frozen.

A refresh **defers** while a lane run is in flight (worktree off the base branch): mid-ticket the
tree holds uncommitted work-in-progress, which is not yet venture knowledge. PGLite is single-writer,
so refresh and query serialise through one `flock`.

## 6. Embeddings — a decision worth seeing

The default is **local**: Ollama on the venture's box (`nomic-embed-text`). The venture's own
context, library and code are never sent to a third party to be embedded, and there is no per-query
cost. This follows FB-034, where the composer's RAG deliberately runs sentence-transformers on the
box for exactly the same reason, and D1.

The cost is real and should be understood: roughly 1 GB of disk and a few hundred MB of RAM while
embedding, on a box that already runs LibreChat, Mongo, Meilisearch, pgvector and the lane. If a box
is too small, the switch is one line — and so is the tradeoff:

```bash
GBRAIN_EMBEDDING_MODEL=openai:text-embedding-3-large GBRAIN_EMBEDDING_DIMS=1536 ./install-gbrain.sh
```

…which sends venture content to that provider and needs its key in the environment. `install-gbrain.sh`
says so loudly when you choose it.

Multi-query expansion is left **off** for lane and composer queries, so the brain needs an embedding
provider and nothing else. Hybrid retrieval (vector + keyword) does the work.

## 7. Install and verify

```bash
# once per box, after the lane bring-up (deploy/lane/README.md):
/opt/foundry/lane/install-gbrain.sh

# it: installs gbrain (pinned) → local embeddings → creates the brain → registers the venture repo
#     → builds the index → generates the bridge token → enables the bridge + refresh timer → verifies

systemctl status foundry-brain-bridge      # the composer's door
systemctl list-timers foundry-brain-sync   # the refresh cadence
```

Then restart the composer so it picks up the token:
`cd /opt/foundry/librechat && docker compose up -d && docker compose restart api`, and re-run
`seed-agent.js` so the composer agent carries the new tool.

**Acceptance check (the one that matters).** Deposit a fact through the composer (FB-043), merge the
deposit PR, wait for a refresh, then ask for it *without* naming the file:

```bash
node /opt/foundry/lane/brain-query.mjs --question "who is this product for" --department build
```

It should come back with the deposited page. Then watch a lane run: its PR body should say
`Research: brain (semantic)`.

## 8. What this is not

- **Not cross-venture.** One brain per box, scoped to the venture's own source. D1 forbids the other
  thing, and there is no code path to it.
- **Not the full PRP.** FB-050 gives the PLAN step real retrieved context; turning that into a proper
  Product Requirement Prompt with explicit validation gates is **FB-052**, which depends on this.
- **Not a write path.** Knowledge enters the brain only by being merged into the venture repo, which
  means a human approved it. Search is read-only end to end.
