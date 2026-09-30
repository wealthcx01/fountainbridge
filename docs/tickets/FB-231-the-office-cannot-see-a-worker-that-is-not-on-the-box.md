# FB-231 — the office cannot see a worker that is not on the box, and nothing records what it loaded

**Status:** filed · **Phase:** 3 · **Raised by:** John, 2026-09-30 — *"when each railway launches will
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

## Scope

Three pieces, smallest first, each shippable alone:

1. **Record what a worker loaded.** Add it where a lane already writes a fact the studio already reads —
   the run report — rather than inventing a channel. A list of skill names per session, written at the end
   of a wake. Requires a `bcap-contracts` change (non-negotiable 7), so the schema moves first.
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
