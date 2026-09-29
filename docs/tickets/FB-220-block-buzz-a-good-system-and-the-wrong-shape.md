# FB-220 — block/buzz: a good system, and the wrong shape for this one

**Status:** filed · **Phase:** n/a (decision record) · **Raised by:** John, 2026-09-25, asking whether
`block/buzz` belongs in the Foundry Studio · **Branch:** `fb-220-block-buzz-decision` ·
One ticket = one branch = one PR.

## Verdict

**DECLINE.** Buzz replaces git as the source of truth with a relay as the source of truth. That is the
one thing this studio is built not to do. Everything Buzz would give us, we already have working, and
the price is a Rust server plus Postgres, Redis and object storage on every venture box.

This ticket exists so nobody researches it twice. It ships as a written decision and no code.

## Why this matters (for the founder)

Buzz is a real, well-made piece of software from Block, and on the surface it looks like exactly what
the Foundry is: a workspace where people and AI agents work in the same rooms, with a record of who
approved what. It is worth knowing plainly why we are not taking it, so that the next time someone
sends the link the answer is already written down.

The short version: Buzz and the Foundry Studio are two answers to the same question. Not a platform
and a part.

## What Buzz actually is

Checked against the GitHub API on 2026-09-25, not from a page summary or from memory.

- **`block/buzz`**, Apache 2.0, from Block, Inc. Its own description is "a hive mind communication
  platform". Its README tagline is "a workspace where humans and agents build together, on a relay you
  own."
- **A Nostr relay.** Every message, reaction, workflow step, approval and git event is one
  cryptographically signed event in one log, identified by a `kind` number. The relay is the single
  source of truth — all reads and all writes go through it.
- **The parts it needs to run:** a Rust server (`buzz-relay`, Axum, WebSocket + REST), Postgres for
  events and full-text search, Redis for pub/sub and presence, and S3 or MinIO for media. There is a
  Docker Compose bundle for a single-node VPS, and a one-click Railway template.
- **Agents are members, not bots.** Each agent has its own keypair, its own channel memberships and
  its own entry in the audit log. `buzz-cli` is a JSON-in/JSON-out CLI built for LLM tool calls.
  `buzz-acp` bridges a coding agent — Goose, Codex or **Claude Code** — into a room.
- **A tamper-evident audit log** (`buzz-audit`, a hash chain) and **YAML workflows** triggered by
  messages, reactions, schedules or webhooks.
- **Git through Nostr** (NIP-34 patches, repo announcements, status events), plus its own git hosting
  backend.
- **Size and age.** Created 2026-03-06, so about six and a half months old. 2,719 commits, 33 Rust
  crates, 582 MB of repository. 34,351 stars, 4,550 forks, 3,651 open issues. Last pushed the day this
  was written, so it is very much alive.
- **Maturity, in its own words.** Latest tag `v0.5.2` — pre-1.0. The README's own table puts **workflow
  approval gates** in the "being wired up" column, described as "infra exists, glue still drying".
  Mobile clients are unfinished. The Windows build ships unsigned as `alpha`. And it tells Block's own
  staff: "don't build from source, and don't use the OSS release — use the internal build." That is an
  honest project being honest. It is not a dependency to put a founder's approval record on.

## Where it would have to go, if we took it

There is no small corner for it. The three candidate homes are all load-bearing:

1. **Replacing git as the work-item store.** Buzz's channels-and-events model would hold tickets,
   patches, CI results and the merge decision.
2. **Replacing the composer.** `deploy/librechat` and `components/Composer.tsx` become a Buzz channel.
3. **Replacing the approval record.** `lib/` ActiveGraph plus the executor become Buzz's signed events
   and hash chain.

Each is a rewrite of a spine, not an addition.

## The three reasons it does not fit

### 1. It moves the source of truth off git

CLAUDE.md's architecture spine says it in one line: *git is the source of truth for work items; the
studio renders `docs/tickets/` from venture repos via the GitHub API, never a competing store.*

Buzz says the opposite, just as plainly: *the relay is the single source of truth. All reads and writes
flow through it.* Its git support is real but it is Nostr-mediated — patches as NIP-34 events, and its
own git hosting backend — not GitHub pull requests.

Both designs are coherent. They cannot both be true in one system. Taking Buzz means the ticket a
founder reads and the PR a lane opens stop being files in a repository, and every reason we chose
files in a repository still holds.

### 2. Every problem it would solve is already solved here, and working

- **Agents in a room the founder can watch.** Built. The office — `components/OfficeEmbed.tsx`,
  `PixelAgent.tsx`, `WhileWorking.tsx`, over the socket at
  `wss://chat.arca.bruntsfield.capital/office/ws`. FB-192 through FB-198 got it stable, in
  Bruntsfield's colours, with the handshake held open. FB-218 is the remaining tidy-up.
- **A record the audited party cannot write.** Built, and built the hard way. FB-071 moved the
  ActiveGraph log onto ground the lane has no credential for, and FB-072 closed the token-scope hole
  that made the first attempt untrue.
- **A conversation attached to a piece of work.** FB-209, the conversation on a ticket.
- **Scheduled automation with a human gate.** The lane on a systemd timer, the executor, and the
  `approval.proposed` → `approval.granted` gate. Buzz's equivalent is the part it says is not finished.
- **Search over the venture's history.** The venture brain — gbrain over `context/`, `library/`,
  `docs/tickets/` and the code, queried in the lane's RESEARCH step. Buzz offers Postgres full-text
  search over channel messages, which is less than we have.

Replacing working, dogfooded parts with a pre-1.0 dependency is not a trade. It is a cost with a story
attached.

### 3. The cost lands on the venture box, where we have the least room

Isolation is the one place Buzz actually agrees with us — one relay, one community, and D1 already
gives each venture its own VPS. But that means the relay lands *per venture*, and each venture box
already runs the Claude Code lane, gbrain, LibreChat, the office socket and the executor. **The ARCA
box is at 83% disk (6.4 GB free) with 5.8 GB of 7.7 GB RAM available** — measured 2026-09-25. Adding a
Rust relay, Postgres, Redis and MinIO to that box is not a footnote.

Two more concrete frictions:

- **Language.** The studio is TypeScript end to end — Next.js 15, `pg`, `next-auth`, `ws`. Buzz's
  integration surface is a Rust binary or its REST/WS API. Either way we are shipping and versioning a
  compiled artefact onto every box.
- **We have no delivery path for box-side files.** FB-047, FB-060 and FB-069 are merged and sitting on
  no box, because nothing syncs `deploy/lane/*`. A Rust binary per box makes that existing gap into a
  blocker, not a nuisance.

We have made this exact call once already. FB-071's out-of-scope section declined the upstream
ActiveGraph project in the same terms: *"It is Python, and a service plus datastore per venture runs
against D1/D2 and the TypeScript stack."* What it took instead was the **model**, not the code. The same
answer applies here, for the same reasons.

## What is worth taking from it

**Revised 2026-09-29, after John pushed back: "are we sure there is nothing else from Buzz
worthwhile?"** He was right to ask. The first version of this section put everything in a "worth
reading" pile, which is the comfortable place to put an idea you have just declined. Re-reading Buzz
against our own open tickets, **three of these are real work and one was simply missed.** The verdict
on adopting Buzz is unchanged; the verdict on learning from it was too quick.

### 1. Branch as room — this is FB-184 and FB-209, already solved

The one I was most wrong about. In Buzz a code branch automatically becomes a channel, so the patches,
the test result, the review and the merge decision all sit in one place, and that channel becomes the
record of *why* the code exists.

We have **two open tickets walking toward this from opposite ends**: FB-184 ("every ticket carries one
link to where you can see the result") and FB-209 ("the conversation on a ticket has nowhere to be
read"). Buzz has one answer to both, and the answer is that the *branch* is the thing that owns the
conversation, not the ticket and not the pull request.

Filing this as "worth reading" was wrong. It is a design we should copy into FB-184 and FB-209 — the
shape of the answer, not the code. Both tickets should reference this.

### 2. `NO_REPLY` as a first-class outcome — the twenty-sentence bug, named

Buzz's workflow steps can conclude **"nothing worth saying"** as a declared output rather than
producing something because the step ran.

This is the direct fix for the failure named in CLAUDE.md #11: *"'What happened' was printing the same
sentence twenty times."* We fixed that screen and never wrote down the rule, so nothing prevents the
next surface doing it again.

It is also the same idea as Cole Medin's fire budget (FB-222, take 1), reached independently by two
different projects. When two systems arrive at the same answer from different directions, that is
usually a sign the answer is right. **FB-222's fire-budget ticket should carry both citations.**

### 3. Per-actor keypairs instead of a shared secret

In Buzz an agent cannot sign as a human because it does not hold the human's key. Each agent has its
own keypair and its own line in the audit log.

Ours is a shared HMAC secret kept off the lane box (FB-071, FB-072). That works, and it fails
differently: **one leaked secret makes everything forgeable, where theirs degrades one agent at a
time.** Given how much FB-071 and FB-072 cost to get right, that difference is worth holding onto.

Not a ticket now — the approval record was hard-won and is not in question. But if it is ever reopened,
or when a second founder means a second signing identity, this is the design to compare against. Noted
against FB-111 ("one name for the approval record").

### Still firmly not taking

The relay itself, its git hosting, and a Rust server plus Postgres plus Redis plus object storage on
every venture box. That last one is not a preference: ARCA is at 83% disk with 6.4 GB free.

## Scope

1. Write this decision into `docs/` where the next person looks — a short entry naming Buzz, the
   verdict, and the one-line reason (it moves the source of truth off git). The phased plan's decision
   list is the likely home; if it does not fit there, a line in `docs/parity-critique.md` does.
2. Record it in gbrain, in the fountainbridge lane, so a future session asking "should we use Buzz"
   finds the answer instead of re-reading 33 Rust crates.
3. Add nothing to `package.json`. Add nothing to any box.
4. **Cross-reference the three takes into the tickets that own them**, so they are found by whoever
   does that work rather than by whoever re-reads this decision: branch-as-room into FB-184 and
   FB-209; `NO_REPLY` into FB-222's fire-budget ticket, citing both Buzz and Cole Medin;
   per-actor keypairs into FB-111.

## Out of scope

- Any trial, spike or proof of concept. A spike is how a declined dependency gets adopted anyway. If
  the verdict changes it changes by a PR to the phased plan, like every other decision here.
- Revisiting the composer, the office, the approval record or git-as-source-of-truth. Those are three
  separate spines and none of them is in question.
- Implementing any of the three takes. This ticket cross-references them into the tickets that own
  them; the work happens there, on those tickets' own merits.

## Acceptance criteria

- [ ] `docs/` states plainly that `block/buzz` was researched on 2026-09-25 and declined, and gives the
      reason in one sentence a non-technical reader understands.
- [ ] The reason names the real conflict — the relay is Buzz's source of truth, git is ours — and not a
      vaguer objection like "too heavy".
- [ ] The three ideas worth borrowing are recorded where the work will happen, not only in this
      decision: branch-as-room in FB-184 and FB-209, `NO_REPLY` in FB-222, per-actor keypairs in
      FB-111.
- [ ] The document says plainly that the first version of this decision under-filed them, and that
      John's challenge is what surfaced it. A decision record that hides its own correction teaches
      the next reader to trust it more than it deserves.
- [ ] No new dependency in `package.json`, no new service in `deploy/`, no change to any box.
- [ ] gbrain returns this decision when asked whether the studio should use Buzz.
- [ ] The decision is dated and attributed, so a later reader can tell whether it is stale. Buzz is
      pre-1.0 and moving fast; this verdict is about today's Buzz and today's studio, and it says so.

## Verification

Documents only. No screen changes, so non-negotiable 11 does not apply — say that in the PR body
rather than leaving it blank.
