# FB-231 — the office cannot see a worker that is not on the box, and nothing records what it loaded

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-30 — *"when each railway launches will
that represent an agent in the pixel office, and we can see what type of skills have been loaded for that
worker? and then can we view the result via link?"* · One ticket = one branch = one PR.

## Three questions, three honest answers

Checked against the data models rather than guessed. **Two of the three are no, and both for the same
reason: nothing carries the fact.**

### 1. Will an ephemeral Railway worker appear in the office? **No.**

The office draws a figure per **Claude session transcript file on the local filesystem**. FB-218
established the agent record exactly: `id, sessionId, terminalName, isExternal, jsonlFile, projectDir,
palette, hueShift` — and `jsonlFile` is an absolute path like
`/root/.claude/projects/-opt-foundry-lane-arca/<session>.jsonl`.

An ephemeral worker writes its transcripts **on the ephemeral box**. The office, running on the venture's
persistent machine, cannot see them. So a Railway worker would be **invisible**, and the office would show
an empty room while work was happening — which is a worse lie than the full room FB-218 just fixed, and the
failure non-negotiable 10 exists to forbid.

It also breaks FB-218's bound, which keys liveness on `mtime(jsonlFile)` — a fact about a local
filesystem. Move the work off the box and that measurement has nothing to measure.

**So this is a real dependency of D11, not a nice-to-have.** Ephemeral workers and a truthful office cannot
both exist until the office is fed from somewhere central instead of from local files.

### 2. Can we see which skills a worker loaded? **No, and nowhere could show it today.**

Two data models, neither with a place to put it:

- **The office's agent record** — the eight fields above. Nothing about tools or skills.
- **`schema/RunReport.schema.json`** — `ended_at, error_detail, lane_id, outcome, pr_url, started_at,
  summary_md, tickets_touched, trigger`. Nothing about skills.

So the answer is not "we do not display it", it is **"it is never recorded"**. A skill is loaded inside a
Claude session and leaves no trace any surface reads.

**It is a good idea and worth building**, because it is the difference between an office that decorates and
one that informs: *"Build is working on ARCA-61, using write-spec and compare-screenshots"* tells a founder
something. A coloured figure does not.

D12 makes this more valuable, not less — the whole point of adopting skills per ticket type is that
different work loads different skills, and right now that choice is invisible.

### 3. Can we view the result via link? **Partly, and the missing half is FB-230.**

- **The pull request: yes.** `pr_url` is on every run report and works today.
- **The running preview: no.** `lib/trail.ts` has the hop built (*"A preview built and is running"* → "see
  it running"), `previewUrlFrom` extracts the URL correctly and refuses console links, and
  `lib/__tests__/work.test.ts` covers the real shapes. The chain is complete and **no URL ever arrives for
  a venture**, which is FB-230's open question.

So the link a founder wants most is one repository setting away, not one feature away.

## Found while starting this, 2026-09-30: the ruling makes the office wrong *today*

John's ruling — **one character per ticket, helpers invisible** — is not only a rule for the future. It
means **the office is wrong right now, by a factor of five to eleven.**

The office draws one character per Claude **session transcript**. One ticket is not one session:
`supervisor.sh` calls `claude_lane` **five times** per round — plan, implement, gate check, `/review`,
`/qa-only` — and `MAX_VALIDATION_ROUNDS` defaults to **2**. Each call is a fresh `claude -p` with no
`--resume`, so each writes its own transcript.

**So one ticket already produces between five and eleven characters.** The crowded room FB-218 bounded was
not only old agents accumulating; it was also every ticket being drawn many times over. The bound fixed the
first cause and not the second, because nobody had ruled on the second yet.

### And it cannot be fixed with the data the office has

To draw one character per ticket, the office must know **which ticket a session belongs to**. The agent
record cannot tell it:

- `terminalName` is empty on every agent — checked on ARCA's live registry.
- `projectDir` is identical for all of them (`/root/.claude/projects/-opt-foundry-lane-arca`).
- `jsonlFile` is a path with a session id in it and no ticket.

The only place the ticket appears is **inside** the transcript, and reading transcript contents to draw a
room would be both expensive and a new reason for the office to touch a founder's data.

**So the lane has to say so.** That makes it the same shape as the skills question above: a fact the lane
knows, that nothing currently writes down, that the office and the trail both want. One mechanism answers
both, and it should be built once rather than twice.

## Two blockers, named rather than worked around

**1. The run-report field needs `bcap-contracts`, which is not on this machine.**

Non-negotiable 7: *"Schema changes happen there, consumed here as generated TS types. Schemas win on
conflict."* Adding `skills` (and a ticket id) to `RunReport` is a change in that repository.

The tempting shortcut is to put it in `summary_md`, which is free text and already exists. **That is
exactly the parallel type non-negotiable 7 forbids**, and it would be read back by string-matching
prose. Not doing it.

**2. Off-box workers have no producer yet.**

Building a "remote workers" feed the gate merges in, with nothing writing to it, would be a dead control —
the same fault FB-192 removed from the office and FB-225 refused to add to the tool surface. It waits for
the thing that writes it.

## What this changes about the order

The office cannot be finished before the lane records two facts per session: **which ticket** and **which
skills**. That is one small change to `claude_lane`'s callers and one schema change, and it unblocks the
character count, the skills display and the off-box case together.

So the sequence is: **contracts change → lane records it → office and trail read it.** Not the other way
round, and not three separate mechanisms.

## Shipped 2026-09-30: one character per ticket, and the blocker that dissolved

**The blocker I recorded was wrong**, and finding that out took one command.

I said the session-to-ticket mapping needed a `bcap-contracts` change, because the only place a session's
ticket appears is inside the transcript. **`claude -p` takes `--session-id <uuid>`.** So the lane can
choose the id and write down which ticket it belongs to, and nothing about the contract has to move.

That matters beyond this ticket: **the thing that looked like a schema problem was a "we did not read the
help" problem.** The other half — recording which *skills* a worker used — genuinely does belong on the
`RunReport` and genuinely is still blocked. Two facts, two mechanisms, and I had assumed one.

### What the lane now does

`claude_lane` generates a UUID per call, passes `--session-id`, and appends one line to
`$STATE_DIR/sessions.jsonl`:

```
{"session":"<uuid>","ticket":"ARCA-61","stage":"implement","at":"2026-09-30T17:22:04Z"}
```

`supervisor.sh` exports `FOUNDRY_TICKET` once, derived the same way the studio derives it so the two agree
on what names a piece of work, and labels each of the five stages.

**Each call still gets its own id and its own session.** No `--resume` anywhere, so `/review` continues to
see the diff and not the reasoning that produced it. That hold-out critic is the thing most easily lost by
someone reusing a session to save tokens, and it is now written down beside the code that would lose it.

**It never fails the wake.** A lane that cannot write its index still has work to do, and an office drawing
one character too many is a smaller fault than a ticket that did not get built.

**Deliberately not a `RunReport` field.** That is a bcap-contracts entity and the record a founder reads;
this is operational state only the office needs, and changing a shared schema to solve a drawing problem
would be the wrong reason.

### What the office now does

Two passes, in this order:

1. **`liveRoster`** drops what has finished (FB-218).
2. **`oneCharacterPerTicket`** collapses what remains to one character per ticket, keeping the **most
   recently active** session so the character tracks the work rather than whichever stage started first.

Collapsing first would sometimes keep a finished session as a ticket's representative and draw a character
for work that had stopped.

**It fails towards showing**, exactly as the liveness bound does. An agent whose session the index does not
know is **kept**, because no record means "we cannot tell", not "this is a helper". An unreadable or absent
index empties nothing.

### The measurement

| | characters drawn |
|---|---|
| one ticket, five stages | **5 → 1** |
| one ticket at its worst (2 rounds, 11 sessions, 8 finished) | **11 → 1** |
| two tickets in flight, four sessions | **4 → 2** |

### Every guard checked by breaking it

- Stop collapsing → **4 tests fail**, including the eleven-to-one case.
- Keep the oldest session instead of the newest → 3 fail, because the character would track stopped work.
- Hide agents the index does not know → 2 fail, which is the empty-room failure.

Restored, all 42 pass.

## Still open, and honestly

- **Which skills a worker used.** This genuinely needs a `RunReport` field and `bcap-contracts` is not on
  this machine. Unchanged.
- **Off-box workers.** Still no producer, so still a dead control to build. But the index above **is** the
  shape it would use: a worker on another machine writes the same line, and the gate already reads it.
- **Not yet on a box.** `provision-office.sh` and the lane installer have to run for any of this to reach
  ARCA, and that is a deploy (non-negotiable 4). The office there still draws one character per session
  until then.

## Scope

Three pieces, smallest first, each shippable alone:

1. **Record what a worker loaded, and which ticket it was working.** Both, together, because they are the
   same missing mechanism and the office needs the second as much as the trail needs the first. It goes
   where the lane already writes facts the studio already reads — the run report. Requires a
   `bcap-contracts` change (non-negotiable 7), **which is not on this machine**, so that moves first and
   somebody with access has to make it.
2. **Show it.** Once recorded, the office and the ticket's trail can both say it. The office is the more
   valuable of the two and the harder, so the trail first.
3. **Let the office see a worker that is not on the box.** The design decision this needs is *what feeds
   the office*: the persistent machine tailing something central, or each worker reporting in. Both change
   FB-218's liveness rule, so that rule is part of this work and not a separate tidy-up.

## Out of scope

- FB-230's preview link. Named here because it answers question 3; it is that ticket's work.
- Moving the lane into ephemeral environments (D11). This is a **dependency** of that, not a part of it —
  and this ticket exists so the office is not discovered to be broken after the move.
- Deciding what a figure means. That is a live design gap already (`docs/design-gaps-open.md`, gap 3), and
  it should be ruled before item 2 draws anything new.

## Acceptance criteria

- [ ] A run report carries the skills a wake loaded, as a bcap-contracts field rather than free text in
      `summary_md`.
- [ ] A ticket's trail shows them in plain English a founder reads without knowing what a skill is.
- [ ] The office can draw a worker that is not on the venture's machine, and FB-218's bound still holds —
      an agent that has stopped working still disappears.
- [ ] An empty office still means nothing is running, and a busy one still means something is. Proved by
      inducing both, not by reading the code.
- [ ] Nothing here invents a second place a fact lives. One writer, one reader.

## Verification

The office is a screen, so non-negotiable 11 applies to item 2 and item 3: rendered at 1440×1000 and
393×851, compared against the design artifact, both looked at, heights recorded. `compare-screenshots`
(FB-226) is the instrument for it.

The claims in this ticket were checked, not assumed: the agent record's eight fields come from reading
ARCA's live `standalone-state.json` during FB-218, and the run report's nine fields from
`schema/RunReport.schema.json`.
