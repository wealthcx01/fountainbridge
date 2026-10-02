# FB-234 — Sell: a CRM the agents can actually use

**Status:** Shipped in part · **Phase:** 4 · **Raised by:** John, 2026-09-25 · **Blocks:** FB-235 ·
One ticket = one branch = one PR.

## Why this one fits when most CRMs would not

`dzhng/crm.cli` (MIT) describes itself as *"an open-source, headless CRM built for agents. No UI. No
dashboard. Just a CLI and a FUSE-mounted filesystem."*

**Files and a command line is our spine.** Non-negotiable 1 says git is the record and the studio is a view
over it. Every CRM with a dashboard would be a second store of record, competing with git and winning by
accident. This one is contacts and deals as **files**, which the venture repo already knows how to hold and
gbrain already knows how to read.

"Built for agents" is also the right posture. The Sell lane does not need a screen to click; it needs to
read who we are talking to and write what happened.

## What a founder should get

On the Sell surface: **who we are talking to, what stage each conversation is at, what was said last, and
what is waiting on them.** Read on the desk, written by the lane, and every outgoing message still gated.

## What to check before committing to it

Named here so they are decisions rather than surprises:

- **The FUSE mount.** It needs a kernel feature on the venture's machine. It has to be confirmed to work
  there, and confirmed not to break the machine if it stops. **A CRM that vanishes when a mount drops is
  worse than a text file.**
- **Where the files live.** In the venture repo means git holds the record, which is right, and means
  contact details are in a repository — and `arca` is **public**. That is a real problem and it decides the
  answer: either the repo is private, or the CRM data lives somewhere else with pointers in git (the D8
  pattern for heavy or sensitive files).
- **Who may read it.** Venture isolation is absolute (non-negotiable 6). One venture's pipeline must be
  unreachable from another, proved by a test that tries and fails.

## The three questions, answered 2026-10-01 — read before the rest of this ticket

Scope item 1 said to read `crm.cli` end to end rather than trust its README. Doing that changed the
answer to a question this ticket had already decided.

### First, the correction: it is not a CRM made of files

This ticket's reason for choosing `crm.cli` over every other CRM was:

> This one is contacts and deals as **files**, which the venture repo already knows how to hold and
> gbrain already knows how to read.

**That is not what it is.** Its own README says so plainly:

> Everything lives in a single SQLite file. Default: `~/.crm/crm.db`.

`src/drizzle-schema.ts` defines `contacts`, `companies`, `deals` and `activities` as SQLite tables.
The filesystem — `src/fuse-daemon.ts`, `src/export-fs.ts`, a Rust NFS server — is a **mounted view
over that database**, not the storage. "Your CRM is a filesystem" is a description of the interface.

So the property this ticket selected it for does not exist, and the objection it raised against
everything else — *"a second store of record, competing with git and winning by accident"* — applies
to this one too, unless something is done about it deliberately.

**It is still a reasonable choice**, for the reason that survives: the filesystem view means the Sell
lane reads contacts as files with no integration, no MCP server and no API key. That is real and it
is rare. But it has to be adopted knowing the record is a database.

### 1. The FUSE mount — **works, and matters less than feared**

Checked on ARCA's box, not assumed:

    fuse in /proc/filesystems : nodev fuse, nodev fusectl, fuseblk
    /dev/fuse                 : present
    fusermount3               : present
    virtualisation            : kvm   (a real VM, not a container)

FUSE is built into the kernel there. The ticket's worry was *"a CRM that vanishes when a mount drops
is worse than a text file"* — and the correction above answers it: **the mount is a view, so nothing
vanishes with it.** The SQLite file and any export are untouched. Losing the mount costs the
convenience of reading contacts as files, not the contacts.

One thing missing: **`bun` is not installed on the box**, and `crm.cli` is a Bun project
(`bun.lock`, `bunfig.toml`). That is an install step, not an obstacle.

### 2. Where the files live — **this is the blocker, and it is John's**

    wealthcx01/arca            private = false
    wealthcx01/arca-marketing  private = false

**Both are public.** Contact details, deal stages and what was said last cannot go in either, and no
amount of care in the code changes that. This is not a preference; it is the thing that decides the
shape.

Three ways out, and the choice is a decision rather than an engineering question:

- **Make `arca-marketing` private.** Simplest. Git holds the record, the D8 pattern is unchanged, and
  the repo's public-by-default decision (2026-07-20) was about plan and venture documents, not about
  a customer's email address. Costs: the Sell surface's content stops being world-readable.
- **Keep the store off the repo entirely**, with pointers in git — the D8 pattern for heavy or
  sensitive files. The SQLite file lives on the venture box only, and the studio reads it through the
  same seam every other read uses. Costs: the record is on one machine, so it needs backing up, and
  git no longer holds it.
- **A one-way export.** SQLite on the box is the working store; `crm export all` writes JSON into a
  **private** repo as the readable record. Only valid if nothing ever writes back to the JSON — a
  derived copy is not a competing record, a writable one is. Costs: a second representation to keep
  honest.

**Recommended: make `arca-marketing` private.** It is the only option that keeps git as the record,
which is this repository's whole spine, and it is one setting rather than a mechanism to maintain.

### 3. Who may read it — **answerable, and not yet proved**

One box per venture (D1) means one database per venture on one machine, so isolation is physical
before it is logical — which is stronger than any check in the studio. What is missing is the proof:
the criterion asks for a test that tries to read another venture's pipeline **at the boundary** and
fails. That test is writable once the store's location is decided, and not before: what the boundary
*is* depends on which of the three options above is taken.

## Scope

1. Read `crm.cli` end to end. It is small enough to read fully, so read it rather than trusting the README.
2. Settle the three questions above **before** any install, and write the answers into the ticket.
3. Stand it up for one venture with real contacts, not fixtures.
4. Surface it on the Sell surface as a read model, through the same seams every other read uses.

## Out of scope

- Sending anything. Every outgoing message stays behind the approval gate.
- The pipeline view and its stages. That is FB-235, and it needs this first.
- Replacing anything the lane already writes. If this duplicates a fact the lane already records, the
  duplicate is the bug.

## Acceptance criteria

- [x] The three questions above are answered in writing before anything is installed. **Nothing has
      been installed.**
- [x] Contact details are not in a public repository. Whichever answer is chosen is stated and enforced.
      **The answer is the studio's own database** (`db/005_crm.sql`). Nothing in the studio writes a
      contact to git, and both ARCA repositories are private as well.
- [x] A test proves one venture cannot read another's pipeline, at the boundary rather than in the UI.
      `lib/__tests__/crm-isolation.test.ts`, against real Postgres, as the studio's own role.
- [ ] The Sell surface shows the pipeline from the real store, with no second copy of any fact.
      The read is built; the screen is FB-235.
- [x] Nothing in it can send. Proved by trying. The pipeline tool is a read, and asking the studio
      for a send under five different names is refused without anything running.
- [x] If the mount is unavailable, the surface says so plainly and the rest of the studio is unaffected.
      There is no mount any more. The read tells "no database", "could not read" and "empty" apart,
      and FB-235's screen says each one in its own sentence; a failed read is caught on that page
      alone.

## Verification

The Sell surface is a screen, so non-negotiable 11 applies: rendered at 1440×1000 and 393×851 against the
design, both looked at, heights recorded.


## Addendum, 2026-10-01: both repos are private, and the answer changed anyway

**Shipped in part:** the store, its isolation test and the Sell lane's read are built (see "Built, 2026-10-02" at the end). Left: the screen (FB-235), and running `db/005_crm.sql` on the production database, which is John's step.

**John made `arca` and `arca-marketing` private.** Verified: `private=true` on both. (`arca-ops` is
still public — it carries no contact data, but it is worth knowing.) So the blocker above is gone and
the git option is genuinely open.

He also asked the better question: *"yes git is important but maybe we need database? why not?"*

### We already have one, and it is already the right shape for this

The studio runs Postgres. `lib/db.ts` opens it, `DATABASE_URL` is set in production, and `db/*.sql`
defines `ventures`, `run_reports`, `documents` and `docstore.blobs` — every one of them with
**`force row level security`** and a policy comparing `venture_id` against a per-transaction
`app.venture_id`. There is one way in, `withVenture`, and it is a transaction because a pooled
connection handed to the next request would otherwise carry the last one's scope.

So FB-234's third question — *"a test proves one venture cannot read another's pipeline, at the
boundary rather than in the UI"* — is already answered by machinery that exists and is proven. It
would not need building for a CRM; it would need **using**.

### The rule was never "no database"

FB-170's governing criterion is *"nothing in the studio treats the database as authoritative **over
git**"*, and it is about **work items**: tickets are files in a founder's own repository, and if the
studio's database became the truth about their work, the founder could no longer leave. That is the
whole argument, and it is a good one.

**Contacts and deals are not work items.** They are not in git today, never have been, and no lane
writes them. The rule simply does not reach them.

### And there is a reason the database is better here, not merely allowed

**Git cannot forget.**

A CRM holds personal data — names, emails, what somebody said. Git history is immutable by design:
deleting a contact from a private repository leaves them in every clone, every fork and every
checkout forever, and the only true removal is rewriting history everywhere it has been pushed.

A person asking to be forgotten is an ordinary request, and in a database it is one `delete`. In git
it is a crisis. **That is the argument that decides it**, and the earlier version of this ticket did
not consider it at all — it was weighing convenience and consistency while the hardest constraint sat
outside the frame.

### So: the recommendation changes

**Contacts and deals belong in the studio's Postgres**, scoped by the same row-level policies
everything else uses. Not in git — not even a private repo.

What stays in git is unchanged and still right: tickets, the venture manifest, the lane's run
reports, the approval record. The record of *work* stays where a founder can take it with them; the
record of *people* goes where it can be erased.

### What that means for `crm.cli`

It becomes a harder sell rather than an easier one, and this should be said plainly.

Its value was the filesystem view — the Sell lane reading contacts as files with no integration. But
its store is its own SQLite file, so adopting it means **a second database** beside the one we
already run, with its own isolation story, its own backups, and no row-level policy. The thing it is
good at we would get for free from a `withVenture` read; the thing it costs is the isolation
guarantee we already have.

**Recommendation: do not adopt `crm.cli`.** Put contacts and deals in the studio's existing database,
behind the existing policies, and give the Sell lane a read through the same seam every other read
uses. Keep `crm.cli`'s actual insight — that an agent should be able to read the pipeline without an
API — by exposing it as files or as an MCP tool over our own store, which FB-200 already built the
pattern for.

That is a decision for John, because it closes a direction he asked for by name.


## RULED by John, 2026-10-01: our own database

> *"Use our own database then if you believe it's best."*

So: **contacts, companies, deals and activities go in the studio's Postgres**, behind the same
row-level policies every other table uses, and `crm.cli` is not adopted. Its one good idea — an agent
reading the pipeline without an integration — is kept by exposing our own store as an MCP tool, the
pattern FB-200 already built.

The reasons, for whoever reads this later: one venture's data is already isolated at the database
rather than in the UI; a person can be genuinely erased, which git cannot do; and it avoids running a
second database beside the one we have. Decile Hub, the product John wants the Sell surface to feel
like, is built the same way (FB-235).

**Next:** the schema (`db/005_crm.sql`), its isolation test at the database, and the Sell lane's read.
FB-235 then gives it the shape John uses every day.


## Built, 2026-10-02

**What was built**

- **The store.** `db/005_crm.sql` adds four tables: companies, contacts (people), deals and
  activities (what happened with a person). Each one is locked to its venture by the same forced
  row-level rule every other table here uses. Each rule also blocks *writing* into another venture,
  not only reading it.
- **Links cannot cross ventures.** A deal points at a person by the pair (venture, person). So the
  database itself refuses to attach ARCA's deal to the-reset's person, whatever the code does.
- **Forgetting a person is one delete.** It removes them and everything they said. Their deal stays,
  as the venture's own record, but no longer names them. The studio's role is allowed to delete for
  exactly this reason.
- **The Sell lane's read.** `lib/crm-load.ts` reads one venture's pipeline through `withVenture`. A
  new read-only tool, `sell_pipeline`, gives it to the Sell lane (or any Claude a founder connects)
  in plain sentences: each deal by stage, who it is with, what happens next, and who is waiting for
  an answer.
- **It tells three things apart.** "No database here", "could not read it" and "it is empty" are
  three different answers, and the read returns them as three.

**How it was proved**

- `lib/__tests__/crm-isolation.test.ts` runs the real schema in real Postgres (PGlite), as the
  studio's own role. As ARCA it reads only ARCA. Asking for the-reset by name returns nothing.
  A connection that names no venture sees nothing. ARCA cannot add, change or delete the-reset's
  rows, and cannot link to them.
- Each guard was broken on purpose to check the test notices. Every one of these turned the tests
  red: removing FORCE; replacing each of the four read rules with "allow all"; removing the write
  rule; removing the deal-to-person link; removing the cascade on "forget"; running the tests as
  the superuser instead of the studio's role.

**What is left**

- **The screen.** FB-235.
- **The production database.** `db/005_crm.sql` has to be run on the studio's Supabase database.
  Until it is, the read says "the pipeline has not been set up in the studio's database yet" rather
  than pretending the pipeline is empty. That step is John's: no worker deploys to production.
- **Writing to the pipeline.** Nothing adds a person or a deal yet. That is a separate piece of work.
