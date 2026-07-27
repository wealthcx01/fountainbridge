---
slug: how-to-build
chapter: 2
title: How to Build
order: 2
summary: Build the smallest thing a customer will actually pay for, test the assumptions that could sink you before over-building, and ship it one reviewed change at a time.
---

# Chapter 2 — How to Build

Chapter 1 ended with you earning the right to build. This one is about not wasting
that right. The classic mistake here is the opposite of the one that kills ventures at
the start: instead of building nothing, you build *everything* — every feature you
imagined, polished for months, for a customer you're still only assuming is there. You
run out of money and time before you ever find out whether you were right.

So keep the rule from Chapter 1 in front of you, because it doesn't relax now that
there's code to write. Bill Aulet — the MIT entrepreneurship director whose framework we
lean on — is blunt about it: **the single necessary and sufficient condition for a
business is a paying customer.** Building is not the act of making software. Building is
the act of making the *smallest thing a real customer will hand over money for* — and
then finding out, with money on the table, whether they actually will.

We'll carry the same example the whole way through. In Chapter 1 we narrowed to
**independent dental practices losing money to missed appointments**, and to one
Persona: the front-desk coordinator who dreads the owner asking why revenue dipped. Now
we build for her.

---

## What "building" actually means

Founders reach for a familiar phrase here: the **MVP**, the "minimum viable product" —
the smallest thing you can put in front of someone. The trouble is the word *viable* has
quietly come to mean "something people will try." A free demo. A signup. A round of
"looks great." None of which proves you have a business.

Aulet sharpens the idea on purpose, and we use his sharper version. He calls it the
**Minimum Viable Business Product (MVBP)** — and the word he adds, *business*, is the
whole point. The MVBP is the smallest product that does three things at once:

1. It delivers **real value** the customer can feel.
2. The customer **pays** for it — actual money changes hands.
3. It **starts your feedback loop** — you learn from real use, not opinions.

The reason the payment matters isn't the revenue (it'll be tiny at first). It's that
paying is an **integrated systems test**. When someone pays, every part of your venture
gets tested at once — the value is real enough to fund, your price is one they'll
accept, your way of reaching and charging them works, and the thing actually does the
job. A free trial tests none of that. A survey tests less. Money is the only signal that
tests the whole system.

For our dental venture, the MVBP is not "a practice-management platform." It's the one
paid loop: **automated appointment reminders that let a patient confirm or reschedule
with one tap, that a practice pays a monthly fee to switch on.** Reminders go out, chairs
stop sitting empty, the practice pays. Everything else you imagined — analytics
dashboards, staff logins, marketing tools — is deferred. If it isn't required to deliver
that value and charge for it, it waits.

---

## Find the assumptions that could kill you

Before you build even that, stop and be honest about what you're *assuming*. Everything
from Chapter 1 is a well-reasoned hypothesis, not yet a fact — and the fastest way to
waste three months is to build confidently on top of a belief that was wrong.

Aulet makes this two deliberate steps, and they come *before* the heavy building:

- **Identify your key assumptions.** List the specific beliefs your plan depends on —
  the ones that, if false, sink the whole thing. Then rank them by "how fatal if wrong"
  times "how unsure am I." For the dental venture: *patients will actually respond to a
  text reminder; reminders measurably cut no-shows; a practice will pay monthly for it.*
  Each is load-bearing. If patients ignore the texts, nothing else matters.
- **Test them as cheaply as you can — and design the test so it *can* fail.** The goal is
  truth fast, not reassurance. The trap is running experiments that can only come back
  "yes." If a test can't return "no," it isn't a test; it's a comfort blanket. One real
  signal beats a month of opinion — a single practice trying reminders with fifty
  patients tells you more than fifty founders nodding along.

Attack the top of that list first — the belief that is most fatal and least certain.
You'll often find you can kill the riskiest assumption without building most of the
product. That's not cutting corners; that's the discipline doing its job.

> **In the studio:** each assumption becomes its own ticket — a small, named unit of
> work — so "will patients reply to a text?" is a thing the venture is visibly testing,
> not a hope buried in your head. And any experiment that touches a real person (a text,
> a signup) still passes the approval gate before it goes out: fast to build, always
> consent-first to release.

---

## The machinery, plainly

Now the building itself. You do not need to become an engineer to run this well — but you
should understand the machinery, because it's what keeps a fast-moving venture from
breaking itself. The Foundry runs on a discipline layered over ordinary software tools,
and here's the whole of it in plain words.

Everything the venture is made of — code and text alike — lives in one shared,
version-tracked folder of record called a **repository** (a "repo"). Nobody edits the
live version directly. Instead, each change is made on a **branch**: a private copy of
the project where you can work without disturbing what customers are using. When the
change is ready, it opens as a **pull request** (a "PR") — a reviewable before-and-after
that a person reads and approves before it becomes real.

That gives us the rule that makes speed safe, the same one from Chapter 1's studio:
**one ticket, one branch, one pull request — and the lane never merges itself.** An agent
can do a piece of work as fast as it likes; the worst it can do is *propose* a change
that a human then reviews. The main line is protected server-side (this is called
**branch protection** — a rule the server enforces so nothing reaches the live code
except through a reviewed PR), which means "a human always approves" isn't a good
intention you might forget under pressure. It's mechanically true.

Two more pieces of vocabulary and you have the shape of it:

- **Environments.** An *environment* is just a running copy of your product.
  **Production** is the real one your customers touch. A **preview** environment is a
  throwaway copy spun up for a single change, so you (and your customer) can *see* the
  reminder-reschedule flow working on a real screen before it ever reaches a real
  patient. You never test on your customers by accident.
- **Secrets.** A *secret* is a password or key that unlocks a paid service — your
  payments account, your text-message provider. Secrets **never** go in the repo, not
  even briefly. They live in the environment's own protected settings. A key committed to
  the repo is a key you have to treat as stolen.

---

## The build stack, without the jargon

With the machinery understood, here's what actually gets assembled — the backend first
(the engine the customer never sees), then the frontend (the part they do).

You start by **scaffolding**: standing up the skeleton of a working app so you're not
building from a blank page. Our ventures scaffold with **Next.js** (the web framework the
whole thing is written in) on top of **Supabase** (a hosted service that gives you a
database and user sign-in out of the box). That combination is deliberate — it's the same
stack across ventures, so the machinery above works identically everywhere.

The **backend** is the part the customer never sees, and it's four things:

- **Auth** — how a person proves who they are when they sign in, so the coordinator sees
  her practice and no one else's.
- **The database** — where the durable facts live: practices, patients, appointments,
  which reminders were sent. When you change the *shape* of that data — adding a column
  for "reschedule link tapped," say — you do it with a **migration**: a recorded,
  repeatable instruction for the change, so every environment updates the same way and
  nothing is done by hand in the dark.
- **An API layer** — the set of doors through which the app asks the backend to do
  things ("send this reminder," "book this new time"). It's the contract between the part
  you see and the part you don't.
- **Integrations** — the outside services you plug in rather than build. For the dental
  MVBP that's **Stripe** for taking the monthly payment and a messaging or email provider
  like **Postmark** for actually delivering the reminders. These often talk back to you
  through a **webhook** — an automated message a service sends the moment something
  happens (Stripe pinging your app the instant a practice's payment succeeds), so your
  app reacts to real events instead of constantly asking "has it happened yet?"

One backend idea is worth understanding even as a non-technical founder, because it's
about safety: **row-level security (RLS)**. It's a rule the *database itself* enforces
about who may see which rows of data. Instead of trusting every screen to remember "only
show this coordinator her own practice," the database refuses to hand over another
practice's rows in the first place. It's the difference between a locked door and a sign
asking people not to enter — and for anything holding customer data, you want the lock.

The **frontend** is the part the coordinator actually touches: the screen where she
switches reminders on, sees which patients confirmed, and where the patient taps
"reschedule." It should do the one job of the MVBP cleanly and nothing more. Resist the
urge to dress it up before you know the loop works.

Then you **deploy to production** — promote the reviewed change from a preview
environment to the live one, through the same gate as everything else. Ours run on
**Railway** for hosting alongside Supabase; the point isn't the brand names, it's that
going live is a deliberate, reviewed, reversible step, never a heroic Friday-night push.

---

## Testing, and avoiding AI slop

Because agent lanes can produce code fast, the real risk shifts. The danger isn't slow
work; it's **plausible-looking work that's subtly wrong** — what we bluntly call *AI
slop*. Code that runs, looks reasonable, and quietly does the wrong thing.

Two habits keep it out. First, **tests**: small automated checks that assert "when a
patient taps reschedule, the old slot really is freed." They run on every pull request,
so a change that breaks the paid loop is caught before a human even reviews it, let alone
before a customer meets it. Second, **the human gate itself** — a person reading the diff
is the backstop no test fully replaces. Fast building only stays safe because *nothing
ships unread*. Speed and the review gate aren't in tension; the gate is what lets you go
fast without fear.

---

## When it breaks

It will break — every real product does, and a founder blocked at 22:00 needs to see
*why*, in plain language, not a wall of silence. So the rule is: **fail loud.** When a
reminder fails to send, that failure surfaces as a legible run report, not a swallowed
error. You debug in production by looking at what the system honestly tells you happened —
logs, health signals, the record of what each lane did — and you fix the root cause with
one more small ticket, one more reviewed change. The infrastructure underneath (the
server, the database, the environments) is deliberately kept simple and inspectable for
exactly this reason: when something goes wrong, you can find it, understand it, and
correct it without spelunking through a system nobody can explain.

---

## Do the dogs eat the dog food?

Here is the test that tells you the building was worth it. Aulet puts it as bluntly as he
can on purpose: **show that "the dogs will eat the dog food."** It doesn't matter how good
the food is if the dogs won't eat it — and it doesn't matter how elegant your product is
if real customers won't adopt it, use it, and keep paying.

So watch behaviour, not surveys. Put the MVBP in front of your first real practices and
instrument the whole loop: Did the reminders go out? Did patients actually confirm or
reschedule? Did no-shows fall? And — the honest signal — **did the practice pay, and does
it pay again next month?** Sign-ups are easy to manufacture; *retention and repeat
payment* are the truth. One paying practice that renews tells you more than a hundred that
signed up free and drifted away.

That first real paid usage is the bridge to the next chapter. Once the dogs are eating —
once money is genuinely changing hands for genuine value — the question stops being "will
anyone buy this?" and becomes "how do I reach the next hundred customers the way they
actually want to be sold to?" That's Chapter 3.

---

## What you should have at the end of Chapter 2

- A defined **MVBP** — the smallest product a customer will *pay* for, scoped down to the
  one paid loop, with everything else deliberately deferred.
- A ranked list of **key assumptions**, with the most fatal-and-uncertain one **tested
  cheaply** by an experiment that could genuinely have failed.
- The **machinery** understood and running: a repository, branch protection, and the
  one-ticket-one-branch-one-PR discipline where a human always approves the merge.
- Separate **environments** (production and preview) and **secrets** kept out of the repo.
- A working **build stack** — scaffolded frontend and backend, with auth, a database and
  its migrations, an API layer, payment and messaging integrations, and **RLS** protecting
  customer data.
- **Tests** running on every change and a **fail-loud** habit, so slop is caught and
  failures are legible.
- **First real paid usage** — at least one customer paying, and the beginnings of an
  honest read on whether they'll *keep* paying.

If you have those, you've done the thing most ventures never manage: you've turned a
hypothesis into a product someone pays for, and you've learned the truth while it was
still cheap to learn.

---

*The framework in this chapter adapts Bill Aulet's* Disciplined Entrepreneurship *(MIT) —
the Minimum Viable Business Product, the identifying and testing of key assumptions, and
"showing that the dogs will eat the dog food" (steps 20–23). We apply it to how Foundry
ventures are built and shipped through a human gate; it is our application of his method,
not a reproduction of it. The full 24-step framework is set out in Chapter 6.*
