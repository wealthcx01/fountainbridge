# FB-097 — A ticket with no number is nobody's ticket

**Status:** Todo · **Phase:** 3 · **Known since:** the FB-088 walkthrough (2026-08-02), promoted to
a ticket after 2026-08-03's walkthrough met it everywhere · **Repo:** fountainbridge (+ the venture
box's ticket-mcp) · **Branch:** `fb-097-a-ticket-with-no-number-is-nobodys-ticket` ·
One ticket = one branch = one PR.

## The state of things

The composer files tickets titled `<PREFIX>-NEW`. It was supposed to be a placeholder for a moment;
it has become the permanent name of everything a founder creates. The walkthrough counted four
distinct pieces of work all called **ARCA-NEW** — "Show set name on card pages", "Show last-updated
time next to each price", "App-wide error boundary", "Seed script must fail loudly" — in the ticket
board, the attention queue, the activity feed, and git history alike.

The costs compound quietly:

- **Nothing can be referred to.** "Approve ARCA-NEW" is ambiguous four ways; a founder on the phone
  to John cannot name the thing they mean. The whole point of ticket ids is a shared, short name.
- **Dependencies cannot be declared.** `Depends on: ARCA-NEW` is meaningless, so composer-filed
  work cannot participate in the dependency ordering the board renders.
- **The board sorts and groups by id**, so the -NEW cluster collects at the bottom in filing order
  nobody chose, and two tickets can collide when both rename later.
- **ARCA-43 proves the contrast.** The one hand-numbered ticket in the queue reads instantly; the
  audit it commissioned tells the lane to file findings "numbered from ARCA-44 upwards" — advice
  the studio's own filer does not follow.

## Why the filer skips numbering

Allocating the next id needs the current backlog: list `docs/tickets/`, parse the highest
`<PREFIX>-<n>`, add one — plus a story for the race where two filings pick the same number. The
ticket-mcp (`deploy/librechat/ticket-mcp/stdio.mjs`) writes a single file with the token it holds
and never reads the directory. FB-088 named this explicitly out of scope ("it needs the filer to
read the backlog and pick, which is more than a prompt change"). This is that ticket.

## Scope

- **The filer allocates the id at filing time** (box-side, `ticket-mcp`): list the queue path,
  take max(n)+1 for the venture's prefix (`VENTURE_TICKET_PREFIX`, FB-088). On the write, if the
  file already exists (raced), re-read and retry once — a duplicate number that survives a race is
  still better than every ticket being called NEW, but one retry closes the common case.
- **The seeder's template drops `-NEW`** (`seed-agent.js`): the composer instructs the filer with
  the title alone; the id is the filer's job, not the model's.
- **The studio treats a residual `-NEW` as a warning, not a name** (this repo): the parser already
  tolerates it; the board should render "unnumbered" with the title doing the work, and the ticket
  drift/lint surface should count them, so the four existing ones get renamed rather than grow.
- **Renumber the four existing ARCA-NEW tickets** (venture repo, one commit) so the backlog ends
  the day clean.

## Explicitly NOT here

- Central id allocation in the studio (the box files against git it holds; git remains the source
  of truth — non-negotiable, and the retry covers the solo-lane reality).
- Changing the ticket file format.

## Acceptance criteria

- [ ] A ticket filed through the composer arrives with the next real id for its venture.
- [ ] Two rapid filings do not produce the same id (the race retry is tested).
- [ ] The studio flags any remaining `-NEW` ticket visibly.
- [ ] ARCA's four existing `-NEW` tickets are renumbered and the board shows no `-NEW`.
