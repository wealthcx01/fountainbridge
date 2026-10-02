# FB-235 — Sell: a pipeline shaped like the one John already runs

**Status:** Shipped in part · **Phase:** 4 · **Raised by:** John, 2026-09-25 · **Depends on:** FB-234 ·
One ticket = one branch = one PR.

**Shipped in part:** the screen is built over FB-234's store; left are the bcap-contracts types, John's review of the shape, snooze and nudge, the mailbox reading, and real data in production.

## Why copy the shape of something that exists

John runs a real fundraising pipeline on Decile Hub for Bruntsfield. It works, he uses it daily, and it
already answers the questions a founder running a pipeline needs answered. **Designing our own from first
principles would be inventing a worse version of something already proven in his hands.**

So the point of this ticket is to take the **shape**: what a deal record holds, what the stages are, how an
email thread attaches to a contact, what the dashboard chooses to show first, and what it deliberately
leaves out.

## What is explicitly not being taken

**Its words and its screens.** There is a standing rule on this project, written for cofounder.co and
applying identically here: never reproduce or reword another product's copy, even as a placeholder. That is
copyright, and it is not negotiable.

We take the **information architecture**. We write our own words.

## Unblocked 2026-10-01

John was explicit, twice: *"the password I provided to you was intentional. You were to use it to
scrape decile hub. We will change passwords on Decile Hub afterwards."* That is the recorded approval
non-negotiable 4 asks for, for a read of his own account. The earlier version of this ticket held it
back on the grounds that the password had been exposed in a transcript; using an already-exposed
credential once, with its owner's instruction and a rotation already promised, does not make the
exposure worse.

It was read once, signed in as John, and nothing was changed, sent or saved in Decile Hub.

**The password must still be rotated.** It is in this conversation's transcript.


## Scope, once unblocked

1. Sign in, read the pipeline, and write down its shape: stages, the fields on a deal, how email threads
   attach, what the dashboard leads with.
2. Map that onto the entities we already have, through bcap-contracts (non-negotiable 7), rather than
   inventing a parallel set.
3. Build the pipeline view on the Sell surface over FB-234's store.
4. Keep every send behind the gate. A pipeline that can email is a pipeline that will email.

## Out of scope

- Any copy or visual design taken from Decile Hub.
- Email sending. The GTM research already settles how that works: interest-based only, from venture
  domains, every send an approval event.
- Replacing Decile Hub for John's own fundraising. This is the Foundry's pipeline for founders, not a
  migration of his.

## Acceptance criteria

- [ ] The shape is written down before any code, and reviewed by John, because he is the one who knows
      whether it matches what he actually uses. Written down, yes (above). Reviewed by John: not
      recorded anywhere. He ruled on the store in FB-234 and pointed at this shape; the screen still
      needs his eye.
- [ ] Every entity goes through bcap-contracts. No parallel type. **Not met.** Contact, Company, Deal
      and Activity are not in bcap-contracts yet, and adding them is that repository's change. Until
      then `lib/crm.ts` mirrors the columns of `db/005_crm.sql` and nothing more.
- [x] Not one line of copy or one layout is taken from Decile Hub, and the ticket says so. Every word
      on the screen was written for it; the layout is built from the desk's own pieces.
- [x] Nothing can send. Proved by trying. The Sell content draws no form and no button. Every action
      is a link to the composer asking for a draft and ending "Do not send anything", and a test
      renders it and checks every link it draws. The one form on the page is the studio's own prompt
      bar, which sits on every venture page and only opens the composer; the browser test checks
      that it is the only one.
- [x] A founder can answer "who is waiting on me" from the Sell surface without opening anything else.
      "Who needs you now" is the first thing under the summary.

## Verification

Non-negotiable 11 applies. And the harder verification is John's: he runs a pipeline daily, so if the shape
is wrong he will know immediately in a way no test will.


## What was found, 2026-10-01

### The finding that changes the approach: it has an API and an MCP server

Decile Hub's own "API & MCP" settings page offers a REST API with interactive documentation, API
tokens with scoped permissions, and **an official Model Context Protocol server** — giving an agent
read and write access to the CRM, pipeline, files and events over streamable HTTP with an API-key
header. Bruntsfield already holds an active token.

Two consequences, and both matter more than any screen:

1. **Nothing about this needs scraping.** A browser session reading HTML is the most fragile way to
   integrate with a system that publishes an API. Anything the Foundry wants from Bruntsfield's own
   Decile Hub should go through that API or that MCP server, not through its pages.
2. **It is built the way FB-234 now recommends ours be built**: a real database, and an MCP server so
   agents read and write it with no glue code. That is an independent product arriving at the same
   architecture — which is the best evidence available that the recommendation is right.

### The shape of the experience, in our words

What follows is **information architecture only** — what exists, what leads to what, what a person
can do. No copy has been lifted and no layout reproduced. **No real names appear here**: the pages
read showed Bruntsfield's actual investors and their email subjects, and this repository is public.
Those captures were kept off the repository and deleted after reading.

Decile Hub is a **fund's** tool — it raises money from investors. A Foundry founder **sells a
product** to customers. The shape transfers; the nouns change. Translations are proposed below and are
John's to rule on.

#### 1. A pipeline with named stages

Five stages, in order: **added → outreach → meeting → materials → follow-up.** Every prospect sits in
one. For a founder selling a product, the proposed equivalent:

    added → contacted → meeting → proposal sent → follow-up → won / lost

The fund version has no "won": a commitment is a separate record. A sale needs an end state on the
pipeline itself, or nothing on it ever finishes.

#### 2. "Next actions" — the screen tells you who needs you, and why

The centre of the dashboard is not a list of prospects. It is a **short, ranked list of the people who
need something from you now**, each with:

- a **temperature** shown as a coloured band down the row's edge (cold / warm / hot);
- a **status** — follow-up due, never contacted;
- **one sentence saying why** this person is on the list;
- **the one or two actions that answer it**, inline — send the proposal, copy its link, ask the AI
  what to do next.

This is the element worth taking most of all. It is the same idea as the studio's own desk — *what
waits on me* — applied to people instead of tickets, and it is the thing a founder opens the Sell
surface to find out.

Per-person actions also include **nudge** and **snooze for 7 or 30 days** — so a person can be taken
off the list deliberately rather than left to rot on it.

#### 3. Inbound email, inside the pipeline

This is the integration John singled out, and having seen it in use, rightly.

The user connects their mailbox — Google (send *and* sync received mail), Microsoft 365, any SMTP
server for sending, any IMAP server for receiving, and Slack for threads. Received mail then appears
**on the pipeline dashboard itself**, attached to the prospect it came from, with:

- the sender, the subject, a preview, how many more messages are in the thread, and how old it is;
- a count of **how many are waiting for a reply**;
- three actions on every one: **reply**, **reply with AI**, **dismiss**.

The point is that a founder never has to go to their inbox to find out whether a customer answered.
The pipeline knows, because it reads the mail, and it puts the answer next to the person.

#### 4. An AI copilot that reads the pipeline and names the one move

Docked to the side of the pipeline is an assistant, scoped to a domain (fundraising, deals). It reads
the pipeline's actual state and says, in plain sentences, **what is going well, what is missing, and
the single most useful thing to do this week** — then offers two or three one-press follow-ups that
start that work.

Its specialists are **skills grouped by domain** — nine for fundraising, five for deals — which is
exactly how this repository organises its own (`.claude/skills/`).

#### 5. Honest numbers

The summary strip shows how many prospects and how many commitments — and where it **cannot** compute
the expected value, it does not print a zero or a guess. It says what is needed to compute it ("add a
commitment and a probability"). That is this studio's own rule (CLAUDE.md #10, and FB-242 most
recently), arrived at independently.

#### 6. A directory of people, separate from the pipeline

A flat list of every person, with which pipelines they are in, organisation, title, tags and when they
were last updated — and the housekeeping a real list needs: import and export, add to a pipeline,
**merge duplicates**, delete, and email from the list.

Deleting from the directory matters more than it looks. It is the "forget me" request that FB-234 found
git cannot honour, and it is a reason the store is a database.

#### 7. Tasks, assigned both ways

Tasks assigned to me and tasks I assigned, as two views. Small, and it is the difference between a
CRM and a contact list.

### What we would not take

- **"Send" anywhere without the gate.** In Decile Hub, send is one press. In the Foundry every outgoing
  message is an external action and waits on a recorded approval (non-negotiable 4). The *reply with AI*
  pattern survives perfectly well as **draft with AI, approve, send** — the draft is the AI's, the send
  is the founder's.
- **A free-floating chat.** The copilot is valuable because it reads *this* pipeline. A general
  assistant beside it would be a worse version of the Claude a founder already has.



## Built, 2026-10-02

**What a founder sees** at `/venture/<id>/sell`, reached from "your pipeline →" in the desk's Sell
column. Three things, in the order a founder asks them:

1. **A summary line with honest numbers.** How many people, how many open deals, how many won and
   lost. A money total appears only when every open deal has a value in one currency. Otherwise the
   line says what is missing ("6 of 14 open deals have no value yet, so there is no total"). The
   weighted total needs a chance of closing on every open deal, and says so when one is missing.
2. **Who needs you now.** At most five people, most urgent first. Each row has the person's
   temperature as a coloured edge (and in words), a status, one sentence of why, and the action
   inline. The order: they wrote and nobody answered; a follow-up is overdue; a follow-up is due today
   or tomorrow; a warm or hot person has never been contacted. Hot before warm before cold, then the
   longest wait first. Anyone snoozed is left off until the snooze ends. Below the list: "And N more".
3. **Where every deal stands.** One column per stage — Added, Contacted, Meeting, Proposal sent,
   Following up, **Won** — with a count and up to three deals each. Lost deals are counted under the
   board, not shown on it.

It also says plainly when it is **not set up** (no database), when it **could not be read**, and
when it is **empty**. Those are three different sentences.

**Nothing on it sends.** "Reply with AI" became **draft with AI**: the link opens the composer with
the request already written, ending "Draft it for me to read first. Do not send anything." The
composer files that as work, the team drafts, and anything that would leave the company comes back as
an approval. The request is trimmed *before* that sentence is added, so a long message can never push
"do not send" off the end — a test found that it could, and it was fixed.

**What is left**

- **The types through bcap-contracts** (non-negotiable 7). Contact, Company, Deal and Activity need
  adding in that repository first.
- **John's review of the shape.** The screen exists now, so it can be judged as a screen.
- **Snooze and nudge.** The store holds a snooze date and the list honours it, but there is no button
  to set one yet. A button that could not do anything would be a dead control, so none is drawn.
- **Mail on the pipeline.** "Waiting for your reply" comes from what the Sell lane records. The
  studio does not read anyone's mailbox (see `lib/sends.ts` on why that scope is not taken), so
  nothing fills it automatically yet.
- **A design to compare against.** The Claude Design artifact has no Sell screen. This one has been
  looked at, at both sizes, but not compared to a design (recorded in `docs/design-conformance.md`).
- **Real data.** Production has no pipeline until FB-234's `db/005_crm.sql` is run there and the lane
  writes to it. Everything above was seen on invented fixture data.
- **A Sell entry in the menu.** The left-hand menu has no Sell item, so on this page it still
  highlights "The desk". The page is reached from the desk's "your pipeline" link. Adding a menu
  entry changes every venture page, so it is its own change.
- **FB-234's last box.** FB-234 asks that a pipeline that cannot be read says so plainly. This screen
  does that, in three different sentences. The box is ticked on FB-234 when that ticket is closed,
  not from this branch.
