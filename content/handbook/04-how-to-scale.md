---
slug: how-to-scale
chapter: 4
title: How to Scale
order: 4
summary: Only scale a beachhead you've genuinely won — then grow it with a tight measure-and-improve loop, honest unit economics, and support and defensibility built in from the start.
---

# Chapter 4 — How to Scale

Scaling is the most misunderstood word in a founder's vocabulary. It sounds like the reward
— the part where you pour fuel on the fire and watch the numbers climb. It is not. Scaling
is what you do *after* you've proven a small thing works, to make it bigger without breaking
it. Do it too early and you don't grow faster; you lose money faster, because you've
multiplied a model that was never sound in the first place. **Premature scaling is the
single most common way a promising venture dies.**

So the first rule of this chapter is a rule about *not* scaling yet. Everything in Chapter 1
was about earning the right to be here: one beachhead market, chosen and won, with real
customers who light up and unit economics that point the right way. Bill Aulet — whose
framework we've leaned on the whole way — makes scaling the very last of his 24 steps (Step
24, the **Product Plan**) for a reason. It only earns its place once the earlier questions
are answered with evidence, not hope. If you're reading this and your beachhead isn't
genuinely won — retention holding, customers paying, the model proven — the most valuable
thing you can do is close this chapter and go back to Chapter 1.

We'll keep the same running example as the whole handbook: you're helping **independent
dental practices stop losing money to missed appointments.** By now, in the story, you've
won a beachhead of small private practices. This chapter is about what you do with that win.

---

## The scaling loop

Growth that lasts isn't a straight line up. It's a loop you run over and over, faster and
tighter each time:

**build → sell → observe → support → learn → iterate.**

You build the smallest useful thing (Chapter 2). You sell it to real customers (Chapter 3).
Then — and this is the part founders skip — you **observe** what actually happens when they
use it, you **support** them when they hit trouble, you **learn** from both, and you feed
that learning back into what you build next. Then round again.

The discipline of scaling is making that loop turn quickly and honestly. Two things make it
turn: seeing clearly (analytics) and holding your customers' hands at volume (support). Two
tell you whether turning it is worth it: your unit economics and your defensibility. The rest
of this chapter is those four, in order.

---

## See clearly: add product analytics

You cannot improve what you cannot see. In the beginning you knew your customers by name —
you could phone the coordinator at the practice and ask how it was going. That doesn't scale.
When you have two hundred practices, "how's it going?" has to become a number you can read
at a glance. That's what product analytics is: instrumenting your product so it tells you the
truth about what people do, not what they say they do.

Three things are worth measuring, and almost nothing else early on:

- **Events** — the specific actions that matter. Not "page views," but the handful of
  moments that mean value is being delivered: a practice connects its calendar, a no-show
  reminder goes out, an appointment gets rebooked. Name the few events that *are* your
  product working, and count those.
- **Funnels** — the steps a customer takes to reach value, and where they fall out. Sign up
  → connect calendar → send first reminder → see first recovered appointment. If eight in
  ten practices sign up but only three connect their calendar, your funnel is screaming at
  you: the problem isn't acquisition, it's that first setup step. Fix the biggest drop-off
  first.
- **Retention** — do they keep coming back? This is the one that decides whether you have a
  business or a leaky bucket. A cohort chart (this month's new practices, and how many are
  still active one, two, three months later) tells you in one picture whether the value is
  real. Rising acquisition on top of bad retention just fills the bucket faster than it
  drains — for a while.

The concrete tool most ventures reach for here is **PostHog** — it records events, draws your
funnels, and plots retention cohorts without you building any of it. But stay tool-light: a
founder who watches three honest numbers beats one with a beautiful dashboard of forty they
never act on. Pick the few events that mean "value delivered," and let everything else wait.

> **In the studio:** the loop that reads your product's behaviour and the loop that ships
> changes are the same loop. A lane can watch a funnel drop-off, draft the ticket to fix it,
> and surface it in your attention queue — with the number that justifies it attached. You
> approve the change; the studio never quietly ships one.

---

## Hold hands at volume: support that scales

Every customer you add is another person who will, eventually, get stuck. In the early days
you answered every question yourself, and you should have — those conversations were how you
learned. But you cannot personally answer the four-hundredth "how do I connect my calendar?"
The job of scaling support is to answer the *same* questions without a human each time, and
save the humans for the questions that are actually new.

Build it in layers:

1. **A knowledge base** — plain, searchable answers to the questions you're already tired of
   answering. Every support conversation you have now is a draft of a future article: write
   it down once, let it answer a thousand times.
2. **Decision trees** — for common problems, a guided "is it this? then try that" path that
   walks a customer to the fix without a person. Most support volume is a dozen issues
   repeating; a good tree resolves them at 2am when nobody's awake.
3. **AI support on top** — a layer that reads your knowledge base and answers in plain
   language, escalating to a human only when it genuinely can't. Tools like **Intercom's
   Fin** do exactly this — resolving the bulk of routine questions instantly and handing you
   only the ones worth your time.

The strategic point underneath the tactics: **support quality is a retention lever, and
retention is the whole game.** A practice that gets stuck and hears nothing churns; one that
gets an instant, correct answer stays — and your unit economics, next, are built almost
entirely on customers staying.

---

## Do the maths: unit economics, plainly

This is the section that decides whether "scaling" means "printing money" or "digging a
deeper hole." Unit economics is just the answer to one question: **for a single customer, do
you make more than you spend?** If yes, every new customer makes the venture healthier and
you should grow hard. If no, growth is the worst thing you can do. Let's build the picture
one honest number at a time, with our dental practices.

**ARPU — Average Revenue Per User.** What one customer pays you, on average, per period. Say
each practice pays **£200 a month.** That's your ARPU.

**Churn.** The share of customers who leave in a period. Say **4% of practices cancel each
month.** Churn is the most important number most founders underrate — it silently sets
everything below.

**Average customer lifetime.** How long a customer stays, which falls straight out of churn:
it's **1 ÷ churn.** At 4% monthly churn, the average practice stays **1 ÷ 0.04 = 25 months.**
Halve your churn and you double how long every customer stays — which is why the boring work
of onboarding and support is an *economic* decision, not a nicety.

**LTV — Lifetime Value.** What one customer is worth to you over the whole relationship. Take
the revenue they pay across their lifetime, and keep only the *margin* — the slice left after
the cost of serving them. If your gross margin is 80% (typical for software), then:

> LTV = ARPU × margin × lifetime = £200 × 0.80 × 25 months = **£4,000.**

That's the ceiling on what you can afford to spend winning a customer. Resist the temptation
to inflate it with a fantasy retention curve — a hopeful churn number hides a broken model.

**COCA — the Cost of Customer Acquisition.** What it costs, all-in, to win one customer.
Aulet calls this **COCA**; you'll hear others call it **CAC** — same idea, and we standardise
on COCA to match the framework. Crucially, calculate it **top-down**: take *all* your sales
and marketing spend over a period and divide by the customers you won in it. Don't build it
bottom-up from a tidy per-channel guess — that always flatters you and leaves out the salary,
the tools, the ad spend that didn't convert. If last quarter you spent **£30,000** across
sales and marketing and won **30 practices**, then:

> COCA = £30,000 ÷ 30 = **£1,000 per customer.**

**Now put the two together.** The comparison that decides everything is the **LTV:COCA
ratio:**

> £4,000 : £1,000 = **4 : 1.**

The rule of thumb: LTV should be at least **three times** COCA. Below that and there isn't
enough margin to cover the rest of the business; much above it and you're probably
*under*-spending on growth. At 4:1, our venture has a real engine.

And **payback period** — how long until a customer has paid back what it cost to win them.
Each practice throws off £160 a month in margin (£200 × 80%), so £1,000 ÷ £160 ≈ **6 months.**
After half a year, that customer is pure fuel. A short payback means you can grow from your
own cash flow instead of borrowing against a distant LTV.

The one number that ends the conversation: **if COCA is ever equal to or greater than LTV,
stop.** It costs more to win a customer than they're worth; no amount of scale fixes that —
it only enlarges the loss. Fix the model *before* you scale it.

> **In the studio:** these aren't numbers you assemble in a spreadsheet at quarter-end. ARPU,
> churn, and a top-down COCA are read straight off the analytics and the sends the studio
> already tracks — surfaced in plain language, so a founder can see at 22:00 exactly whether
> the engine is running rich or lean.

---

## Grow the map: expand the business

Once the beachhead is won and the economics are sound, you expand — deliberately, one move at
a time. There are two directions, and it helps to name them:

- **Horizontal** — the *same* product to *new* markets. You've won small private practices;
  now you take dental groups, or physiotherapy clinics, or veterinary surgeries who lose
  money to no-shows in exactly the same way.
- **Vertical** — *new* products to the *same* customers. Your practices trust you; now you
  sell them the next thing they need — recall reminders, patient rebooking, payments.

Which way you go was sketched long before you got here. Back in Aulet's Step 14 you mapped
the **TAM for follow-on markets** — the markets that open up *after* the beachhead falls. That
map wasn't meant to be worked early; it existed to prove the beachhead was a doorway, not a
dead end. Now it becomes your sequence.

Before you enter any new market, ask the pre-expansion questions honestly:

- Is the current beachhead *genuinely* won — retention holding, economics proven — or am I
  running from a problem I haven't solved?
- Does this next market share my **Core** — the same underlying advantage, dataset, or
  relationship — so the win compounds rather than starting from scratch?
- Does winning the beachhead actually *help* me win here (references, word of mouth, a
  product that ports), or am I back at a cold start?

Each new market re-runs the earlier questions in miniature — a new persona, a new value
number, a new set of ten customers. It doesn't get to skip them because you're bigger now.

A word on **fundraising**, because expansion is when the temptation peaks. Raising money is a
**tool, not a goal.** It buys speed to run the scaling loop faster on a model you've *already
proven*; it cannot manufacture a model that isn't there. Raise when you have an engine that
turns cash into more cash than you put in, and you want to feed it. Raising to *find* that
engine is how founders end up scaling the leak.

---

## Build the walls early: moats and defensibility

Here is the part that surprises people: **the best time to build your defences is before you
need them.** A moat — the reason a competitor can't simply copy your success once they notice
it — is not a thing you bolt on at scale. It's built across the entire journey, in a hundred
small decisions you've already been making. Value you can't defend is a treadmill: you grow
revenue and, the moment a bigger player copies you, you're in a price war you lose.

The framework we use is Hamilton Helmer's **7 Powers.** His unforgiving insight: a durable
advantage needs *two* halves at once — a **Benefit** (you can charge more or cost less) and a
**Barrier** (a reason rivals *can't or won't* copy it, even though they can see it plainly).
The seven, in headline:

1. **Scale economies** — costs fall as you grow, faster than a rival can match.
2. **Network economies** — the product gets more valuable as more customers join.
3. **Counter-positioning** — you use a model the incumbent can't copy without hurting their
   own business. Often a young venture's single best weapon.
4. **Switching costs** — once a customer's data and habits live in your product, leaving is
   expensive.
5. **Branding** — customers trust you faster, and pay more, because of what your name means.
6. **Cornered resource** — preferential access to something rivals can't get: a dataset, a
   partnership, a right.
7. **Process power** — your organisation does something complex, better, in a way that can't
   be quickly copied.

Notice how early most of these begin: switching costs from your first version,
counter-positioning from the founding model, branding from every honest interaction you've
ever had. The unique insight you wrote down in one sentence at the end of Chapter 1 — the seed
of your Core — is where your Power starts. **Chapter 7 is the full treatment**: each power,
when its window is open, and how a Foundry venture deliberately builds one. Read it not as a
chapter you do once, but as the lens you hold over every other decision, this one included.

---

## What you should have at the end of Chapter 4

- **Honest confirmation your beachhead is won** — retention holding and economics proven —
  before you scale anything at all.
- A running **scaling loop** — build → sell → observe → support → learn → iterate — that you
  can point to turning.
- **Product analytics** live: the few **events** that mean value, the **funnels** where
  customers drop out, and a **retention** cohort you actually watch.
- **Support that scales** — a knowledge base, decision trees, and an AI layer on top —
  protecting the retention your economics depend on.
- Your **unit economics** written down and checked: ARPU, churn, average lifetime, **LTV**, a
  **top-down COCA**, an **LTV:COCA** ratio at 3:1 or better, and a payback period you can
  live on.
- An **expansion sequence** from your follow-on-market map — horizontal or vertical — with
  the pre-expansion questions answered honestly, and a clear-eyed view of fundraising as fuel,
  not rescue.
- A named **Power** you're building toward, and the recognition that the moat was started
  chapters ago — with the full treatment waiting in Chapter 7.

If you have those, you're not just bigger — you're bigger *and harder to kill*, which is the
only kind of scale worth having.

---

*The framework in this chapter adapts Bill Aulet's* Disciplined Entrepreneurship *(MIT) —
Step 14's follow-on markets, the LTV and COCA economics of Steps 17–19, and the Step 24
Product Plan — and Hamilton Helmer's* 7 Powers *for defensibility. These are our application
of their methods to how Foundry ventures are built, not a reproduction of them. The full
24-step framework is set out in Chapter 6; the seven powers in Chapter 7.*
