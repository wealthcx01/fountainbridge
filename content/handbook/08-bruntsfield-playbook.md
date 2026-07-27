---
slug: bruntsfield-playbook
chapter: 8
title: The Bruntsfield Playbook
order: 8
summary: How it all fits together — the operating model that turns the method, the mindset, and the frameworks into a company you can run from your phone, with a human hand on every gate that matters.
---

# Chapter 8 — The Bruntsfield Playbook

You've reached the end of the handbook, so here's what you now have. Chapters 1–4 gave you
the **method** — how to start, build, sell, and scale. Chapter 5 gave you the **mindset** —
the inner game of being the founder rather than the employee. Chapters 6 and 7 gave you the
two **frameworks** underneath it all — Aulet's discipline for finding a real customer, and
Helmer's for building an advantage nobody can take back.

This last chapter is the part most handbooks never write: **how Bruntsfield actually runs a
venture** so that all of that becomes a real company you can operate day to day — without a
laptop, without a terminal, and without ever losing control of a decision that matters. This
is the operating model you sign into. It's short, because the whole point is that it's simple
to live inside.

The promise underneath it is one line: **build the company; we'll run the machine.** You bring
the idea and the judgement. Bruntsfield brings a studio of agents that do the operational work
— building the product, running the lanes, drafting the sells — with a human hand on every
gate that matters. It is not advice, and it is not a template. It's a working co-founder that
ships every day, paired with a founder who stays in control of every decision.

---

## Co-created, not outsourced

Start with what a Foundry venture *is*, because it shapes everything below. A Foundry venture
is built by a founder and Bruntsfield **together**. You own the company and the direction. We
stand up the machinery it takes to run one: a dedicated box, a set of agent lanes, and a
studio — the one you sign into — where the whole operation is visible and controllable from
your phone.

The division of labour is deliberate. The agents do the repeatable, tireless work: turning
tickets into shipped code, watching the numbers, drafting the emails to people who have raised
their hand. You do the irreplaceable work: deciding what to build, who it's for, and what
"good" looks like. Every consequential action waits for a human "yes" before it happens.

And it is **one substrate, many ventures**. What we learn running one company makes the next
one faster to stand up — while each venture stays walled off from every other by construction.
This is not outsourcing, where you hand a brief to a vendor and hope; it's co-creation, where
the machinery is shared but the company, the decisions, and the upside are yours.

### What you actually get

- **Velocity without a team.** Lanes work in parallel and around the clock. You review shipped
  work instead of managing people to produce it.
- **Control you can see.** Nothing external — an email, a payment, a deploy — happens without
  your approval, and every one is logged. The studio shows you what's in flight and what needs
  you.
- **Nothing fails silently.** If a lane stalls or a check breaks, you see why, in plain
  language — not a wall of green lights hiding a stuck company.
- **A method, not vibes.** Every venture runs on the same disciplined build-and-sell playbook
  — the one you just read — so "what do I do next" always has an answer grounded in evidence.
- **You stay the founder.** Foundry removes the reasons a good founder gets stuck: no team
  yet, no time, no operating system. It gives you the last two so you can spend yourself on
  the first.

---

## Two rules everything else hangs on

Strip the machine down and there are only two rules. Almost every design choice below is a
consequence of one of them.

1. **Git is the source of truth.** Every piece of work — a feature, a fix, a campaign, a
   decision — becomes a written record in your venture's repository (its "repo", the shared,
   versioned folder that holds the venture's work): a ticket, a branch, a change, a merge. The
   studio doesn't keep its own private database of your work; it reads the same repositories
   the agents write to, so what you see is what actually exists. Nothing important lives only
   in someone's head or a chat window. That's what makes the whole operation legible,
   reversible, and auditable: you can always see what happened, when, and why, and you can
   always undo it.
2. **Nothing external happens without a human "yes."** An email to a customer, a payment, a
   public post, a change to live infrastructure — none of it executes until a named human
   approves it, and the approval itself is recorded. The agents can *draft, build, and
   propose* all day; they can *do* nothing consequential on their own. The door to the outside
   world only opens on a recorded approval.

Speed on the inside, a firm gate at the edge. Hold those two in mind and the rest of this
chapter is just detail.

---

## One venture, one box, one pane of glass

A Foundry venture is built the same way this studio was: as a stream of small, reviewable
changes, made by AI agents working in a dedicated workspace, with a human approving anything
that leaves the building. Nothing here is magic and nothing runs unattended. Every part exists
so the work is fast, visible, and reversible.

- **One box per venture.** Every venture runs on its own dedicated server — a private machine
  in the cloud (a VPS). That box is the venture's workshop: the code, the agent sessions, and
  the tools all live there, and only that venture's people can reach it. Your founder account
  and John have direct access; nothing on your box is shared with another venture, and a
  session scoped to your venture can never read another's data. Isolation is enforced on the
  server, not just hidden in the interface. For a portfolio that touches money, that isolation
  isn't a nicety — it's the answer to "how do I know my venture is walled off?" A venture's
  secrets never sit next to another's, by construction.
- **What a "lane" is.** A lane is a working agent session on the box — an AI co-founder
  actually doing a piece of work: reading the repository, writing code, drafting content,
  running tests. Lanes have jobs — build the product, run the marketing site, watch the
  numbers — and they work in parallel and around the clock. Crucially, a lane operates on one
  ticket at a time, and when it finishes it opens a pull request and **stops**; it never
  merges its own work. You don't manage lanes the way you'd manage people; you review what
  they produce.
- **Why a whole box, and not just a chat window.** Because real venture work is more than a
  conversation. An agent needs to run your actual build, hit your actual test suite, hold
  long-lived state, and pick up tomorrow where it left off today. A dedicated box gives it a
  real, persistent place to do that — and gives you a clean boundary: everything the venture
  is made of sits in one isolated, inspectable place you control.
- **The studio is the pane of glass.** Foundry Studio — the app you sign into — is the window
  onto that box. You don't have to live in a terminal to run the venture. The studio reads all
  of that from git and shows it back to you in plain terms: your lanes and their ticket queues,
  the **attention queue** of things waiting on you, and the health of the whole operation with
  staleness flags so a stuck lane can't hide behind a wall of green lights. The studio is a
  window onto the truth, never a separate story about it. The terminal is still there
  underneath if you ever want it — the power path, never the required path.

---

## The unit of work: one ticket, one branch, one approval

Everything the machine does moves through the same small, safe loop, and it's worth
understanding once because you'll see it everywhere. All work is cut into **tickets** — each a
short file describing one change, small enough to read and reason about — and every ticket
follows the same path:

- **Ticket.** The change is written down first: the context, the scope, what's explicitly
  *out* of scope, and how it will be verified — a plain description of what to do and what
  "done" looks like.
- **Branch.** A lane picks it up and does the work on its own **branch** — a private draft
  copy named for the ticket, so the live product is never touched mid-change. Nothing reaches
  the main line yet.
- **Pull request.** The finished work opens as a **pull request** (a "PR") — a reviewable
  proposal that says *"here's the change; approve it to make it real."* It arrives with its
  automated checks attached: the linter and type-checker that catch mistakes, the test suite,
  and a screenshot gallery so you can see any change to the interface.

One ticket, one branch, one PR. No lane bundles unrelated work together — no "while I was in
there" — and any work discovered along the way becomes a *new* ticket rather than sprawling
the current one.

### The lane never merges its own work

This is the rule that makes the speed safe: **a lane opens a PR and stops.** It never approves
itself. Merging the change — making it live — is a decision, and decisions belong to people. A
human merges, per the approval matrix below. So the agents can move as fast as they like; the
worst they can do is propose a change, which someone reads before it becomes real.

### Git is the record, not a copy of it

The studio has no separate database of your tickets or work items. It reads them and the pull
requests directly from the venture's repositories and renders them. That's deliberate: there
is one source of truth — git — and the studio is a live view and a set of controls on top of
it, never a second copy that can quietly drift out of sync with reality.

Small units, always reviewed, never self-merged. It's the discipline that lets agents move
fast without you ever waking up to a surprise.

---

## The three disciplines running underneath

Three systems make the lanes trustworthy rather than just fast. You mostly won't touch them
directly — but knowing they're there explains why the machine behaves.

### The method layer — gstack

The agents don't freestyle. Every lane runs on **gstack**: a shared pack of skills and
workflows that forces a real discipline on every change. If a lane is a working agent, gstack
is the set of professional habits it can't skip — the same ones a careful engineering team
would use. It organises work into named steps a lane invokes as it goes:

- **Plan.** Before anything large or ambiguous, the work is shaped and pressure-tested — a
  CEO- or engineering-level review of the plan — so effort goes at the right thing. This is
  where the strategic, think-bigger lens lives: the same *"what would make this a genuinely
  great product"* judgement you'd want a good co-founder to bring.
- **Review.** Before a PR opens, the change gets a staff-engineer-style audit and a QA pass:
  does it do what the ticket asked, is it correct, does it hold up?
- **Ship.** The change is finalised into a clean PR, and the lane stops for a human to merge.

There's a step for closing out a phase too — a **retro** — so the system keeps learning. The
point of all of it is that quality isn't left to chance on any single change; the same gates
apply every time. And gstack isn't bespoke to one venture: it's the common substrate every
Bruntsfield lane uses, which is why work looks consistent across ventures and why improvements
to the method benefit all of them at once. Your venture gets a battle-tested process from day
one instead of inventing its own.

### The memory layer — gbrain

An agent's conversation ends; the venture doesn't. **gbrain** is the durable memory the lanes
and the studio write to and read from — the place decisions, context, and hard-won lessons are
recorded so they survive across sessions and don't have to be re-explained every morning. What
goes in it is the useful, non-obvious things a good teammate would remember:

- **Decisions and the reasoning behind them,** so choices aren't silently reversed later.
- **Context that isn't derivable from the code** — why something is the way it is, what was
  tried and rejected, what a stakeholder actually wants.
- **Cross-session threads** — where a piece of work stands, so the next lane picks up cleanly.

It deliberately does *not* store what the repository already records (code structure, history)
— memory is for what the code can't tell you. And two firm lines hold: gbrain is **partitioned
per venture**, so your venture's memory is its own and never pooled with another founder's;
and **secrets never go in it** (or in tickets, or in code). Credentials live only on the
venture's own box and deployment environment. Memory holds knowledge, not keys. Separate
boxes, separate data, separate memory — the isolation promise holds all the way down.

### The gate — ActiveGraph

This is rule two, made real. Inside the box, agents can do almost anything — draft, build,
revise — freely, because it's all reversible and reviewable. The moment an action would touch
the outside world, it stops at **ActiveGraph** and waits. External actions are the ones with
real-world consequences you can't take back:

- Sending an email to a prospect or customer.
- Posting to social or any public channel.
- Writing to a CRM or other system of record.
- Moving money — payments, invoices, subscriptions.

**Approve-then-act, always.** ActiveGraph holds each of these as a *proposed* action with its
full content attached, and it will not execute until a recorded human approval exists. There
is no path where an agent sends the email and asks forgiveness later — the send simply doesn't
happen until someone approves it. Engineering changes gate on PR review; external actions gate
on ActiveGraph approvals. Both gates, no exceptions — including the "trivial" ones.

**Why a durable event, not just a button.** Because "who approved this, and when" has to be
answerable after the fact. ActiveGraph records approvals as durable events, so every outbound
action a venture ever took has a name and a timestamp attached to it. That record isn't
bureaucracy; it's the audit trail that makes consent-first selling lawful and a bank's
due-diligence answerable — and it's what makes it safe to let agents draft outbound work at
speed. The record of consent is part of the mechanism, not an afterthought.

---

## Who approves what

Because a Foundry venture is genuinely **co-owned**, two humans hold authority, and the
**approval matrix** sets — per kind of action — who has to sign before it happens. The studio
routes each decision to the right one:

- **You, the founder,** approve the decisions that are yours to make about your venture's
  direction, voice, and customers — what gets built, how it looks, what goes to customers.
  This is your company; the direction is yours.
- **Bruntsfield** approves the decisions that touch the shared substrate, spend, or
  portfolio-level risk — the platform, infrastructure, and security plumbing that keeps the
  venture safe and running.
- **Dual** — a short **high-blast-radius list** that needs *both* of you: database migrations,
  anything touching login and authentication, payments, secrets, and external sends. These are
  the changes that are expensive to undo, so they get two sets of eyes by default.

The matrix is explicit and versioned, so there's never ambiguity about whose call a given
action is — and merges to a venture's main line follow it just like external actions do.

### The attention queue

You don't go looking for what needs approving — it comes to you. Anything waiting on a human
surfaces in the studio's **attention queue**: open pull requests to review, and external
actions parked at ActiveGraph. Each item is routed to the right approver per the matrix, so
your queue shows the things that are actually *yours* to decide, not everyone's. And each item
comes with a plain-language summary of what it is and what happens if you say yes — so
approving is a one-minute decision, not a code review. You should never have to read a diff to
run your company.

### The founder's-eye view

This is the payoff of everything else in the system. The agents work fast on the box; the
gates hold at every edge; and what reaches you is a short, honest list of decisions — approve,
and it proceeds; hold, and it waits. You run the venture by working that queue, from your
phone, without needing to touch a terminal or trust anything you couldn't see.

---

## Where the method meets the machine

Here's the join that makes this a *playbook* and not just an architecture diagram. The
chapters you just read aren't separate from the machine — they *are* what the machine runs:

- The **customer discovery** of Chapter 1 and the 24-step discipline of Chapter 6 become the
  tickets the early lanes work — segment the market, size the beachhead, profile the persona,
  find the next ten. The studio holds your beachhead and your persona where every lane can
  build to *that* customer, not a generic one.
- The **build discipline** of Chapter 2 is the one-ticket-one-branch loop above: the smallest
  thing a customer will pay for (the MVBP), shipped through real checks. The discipline of
  "smallest thing that proves value" and "one change at a time" is the same at the product
  level as it is at the commit level.
- The **consent-first selling** of Chapter 3 runs through the gate: agents draft the reply, a
  human approves the send, the interest-source is on the record. No cold lists, ever — the
  best outreach is the reply you were ready to send the moment someone asked.
- The **scaling loop** of Chapter 4 is the studio's health and analytics surfaces — you scale
  a proven beachhead, watching the numbers rather than guessing.
- The **moats** of Chapter 7 are deliberate choices the machine helps you make on schedule —
  counter-positioning at the start, switching costs as you build, brand as you sell, scale as
  you grow — because "when can I build this power?" has a stage-by-stage answer. And the studio
  itself is a moat in the making: one-ticket-one-branch, adversarial review, the approval
  matrix — process power a competitor would have to rebuild their whole culture to match.

And the **mindset** of Chapter 5 is what the whole model is designed to free up. The machine
takes the tireless, repeatable work so your best hours go to the irreplaceable work — the
judgement, the taste, the calls only a founder can make.

---

## Your job, in one line

The machine can do an enormous amount. What it will never do is decide. So the division of
labour is clean, and it's the same every day:

> **The human decides. The machine does the work. Git remembers everything.**

That's the moat you can't buy — not a feature, but a way of running that stays disciplined at
2am on a Tuesday when you're the only human awake. It compounds into something a competitor
can't copy by watching you: [process power](/playbook/moats), built into how the venture runs.

Today the studio starts read-only — it shows you the truth. From there it gains a write path
(filing work from the studio; lanes that wake on a schedule without anyone logging into the
box), then a founder-experience layer (a conversational composer, in-studio approvals, and the
venture's context and library where every lane can read it). Direct access to the box stays
available to you and to John throughout — the power path, never the required path. The
through-line never changes: the human decides; the machine does the work; git remembers
everything.

---

## What you should have at the end of the handbook

- A **method** you can follow from idea to scale, and the honesty to tell, at any moment, what
  you actually know versus what you're still guessing (Chapters 1–4, 6).
- The **frameworks** underneath it — Aulet's for finding a real customer, Helmer's for keeping
  the advantage (Chapters 6–7).
- The **mindset** to own the outcome and stay out of your own way (Chapter 5).
- A clear picture of the **machine** you run it on — one box, lanes, tickets, the gate, the
  approval matrix — and exactly where your "yes" is required.
- The confidence that nothing consequential happens without you, and nothing important is ever
  lost.

The handbook is the soft introduction and the reference. The company is built in the studio.
Open your ventures, and start.

---

*This chapter describes Bruntsfield Capital's own operating model for co-created Foundry
ventures. The frameworks it draws the method from are credited in Chapters 6 (Bill Aulet,
Disciplined Entrepreneurship) and 7 (Hamilton Helmer, 7 Powers); the operating model, the
studio, and this playbook are ours.*
