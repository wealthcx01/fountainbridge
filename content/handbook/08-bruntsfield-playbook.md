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

---

## Two rules everything else hangs on

Strip the machine down and there are only two rules. Everything below is a consequence of
them.

1. **Git is the source of truth.** Every piece of work — a feature, a fix, a campaign, a
   decision — becomes a written record in your venture's repository: a ticket, a branch, a
   change, a merge. Nothing important lives only in someone's head or a chat window. That's
   what makes the whole operation legible, reversible, and auditable: you can always see what
   happened, when, and why, and you can always undo it.
2. **Nothing external happens without a human "yes."** An email to a customer, a payment, a
   public post, a change to live infrastructure — none of it executes until a named human
   approves it, and the approval itself is recorded. The agents can *propose* anything; they
   can *do* nothing consequential on their own.

Hold those two in mind and the rest of this chapter is just detail.

---

## One venture, one box, one pane of glass

- **One box per venture.** Every venture runs on its own dedicated server (a Hetzner VPS).
  On it live the **agent lanes** — the tireless workers that turn tickets into shipped work.
  One box per venture means a venture's secrets never sit next to another's, and a session
  working on your venture physically cannot reach anyone else's data. For a portfolio that
  touches money, that isolation isn't a nicety — it's the answer to "how do I know my
  venture is walled off?"
- **Lanes do the work.** A lane is a workstream with a job — build the product, run the
  marketing site, watch the numbers. Lanes work in parallel and around the clock. You don't
  manage them the way you'd manage people; you review what they produce.
- **The studio is the pane of glass.** Foundry Studio — the app you sign into — reads all of
  that from git and shows it back to you in plain terms: your lanes and their ticket queues,
  the **attention queue** of things waiting on you, and the health of the whole operation
  with staleness flags so a stuck lane can't hide behind a wall of green lights. The studio
  is a window onto the truth, never a separate story about it.

---

## The unit of work: one ticket, one branch, one approval

Everything the machine does moves through the same small, safe loop, and it's worth
understanding once because you'll see it everywhere:

- A piece of work becomes a **ticket** — a short, plain description of what to do and what
  "done" looks like.
- A lane picks it up, does the work on its own **branch** (a private draft copy, so the live
  product is never touched mid-change), and opens it for review as a **pull request** — a
  proposal that says *"here's the change; approve it to make it real."*
- **The lane never approves its own work.** It stops and waits for a human. Merging the
  change — making it live — is a decision, and decisions belong to people.

Small units, always reviewed, never self-merged. It's the discipline that lets agents move
fast without you ever waking up to a surprise.

---

## The three disciplines running underneath

Three systems make the lanes trustworthy rather than just fast. You mostly won't touch them
directly — but knowing they're there explains why the machine behaves.

- **The method layer (gstack).** The agents don't freestyle. They run a shared discipline —
  plan the work properly before building it, review it against a standard, ship it through
  real checks. This is where the strategic, think-bigger planning lives (the same "what would
  make this a genuinely great product" lens you'd want a good co-founder to bring), and it's
  shared across every Foundry venture, so quality doesn't depend on luck.
- **The memory layer (gbrain).** Ventures accumulate context — your brand, your customer
  research, decisions you've already made. The memory layer holds it so a lane picking up
  work next week knows what happened last week, and you're not forever re-explaining
  yourself. Your durable background and the agents' outputs live where every lane can read
  them; secrets never do.
- **The gate (ActiveGraph).** This is rule two, made real. Every external or high-risk
  action becomes a recorded request — *proposed*, then *granted* by a named human — before
  anything leaves the building. The record isn't bureaucracy; it's the audit trail that makes
  consent-first selling lawful and a bank's due-diligence answerable.

---

## Who approves what

Because a Foundry venture is genuinely **co-owned**, two humans hold authority, and the studio
routes each decision to the right one:

- **You, the founder,** approve product-visible changes — what gets built, how it looks, what
  goes to customers. This is your company; the direction is yours.
- **Bruntsfield** approves the platform, infrastructure, and security changes — the plumbing
  that keeps the venture safe and running.
- **The high-stakes list** — database migrations, anything touching login/auth, payments,
  secrets, and external sends — needs **both** of you. These are the changes that are
  expensive to undo, so they get two sets of eyes by default.

The attention queue is where these land. Each item comes with a plain-language summary of
what it is and what happens if you say yes — so approving is a one-minute decision, not a
code review. You should never have to read a diff to run your company.

---

## Where the method meets the machine

Here's the join that makes this a *playbook* and not just an architecture diagram. The
chapters you just read aren't separate from the machine — they *are* what the machine runs:

- The **customer discovery** of Chapter 1 and the 24-step discipline of Chapter 6 become the
  tickets the early lanes work — segment the market, size the beachhead, profile the persona,
  find the next ten. The studio holds your beachhead and your persona where every lane can
  build to *that* customer, not a generic one.
- The **build discipline** of Chapter 2 is the one-ticket-one-branch loop above: the smallest
  thing a customer will pay for (the MVBP), shipped through real checks.
- The **consent-first selling** of Chapter 3 runs through the gate: agents draft the reply,
  a human approves the send, the interest-source is on the record. No cold lists, ever.
- The **scaling loop** of Chapter 4 is the studio's health and analytics surfaces — you scale
  a proven beachhead, watching the numbers rather than guessing.
- The **moats** of Chapter 7 are deliberate choices the machine helps you make on schedule —
  counter-positioning at the start, switching costs as you build, brand as you sell, scale as
  you grow — because "when can I build this power?" has a stage-by-stage answer.

And the **mindset** of Chapter 5 is what the whole model is designed to free up. The machine
takes the tireless, repeatable work so your best hours go to the irreplaceable work — the
judgement, the taste, the calls only a founder can make.

---

## Your job, in one line

The machine can do an enormous amount. What it will never do is decide. So the division of
labour is clean, and it's the same every day:

> **You decide. The machine does the work. Git remembers everything.**

That's the moat you can't buy — not a feature, but a way of running that stays disciplined at
2am on a Tuesday when you're the only human awake. It compounds into something a competitor
can't copy by watching you: [process power](/playbook/moats), built into how the venture runs.

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
