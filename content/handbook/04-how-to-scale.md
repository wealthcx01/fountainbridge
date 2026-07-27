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
multiplied a model that was never sound in the first place. Growth can hide a broken
business: you can always buy more revenue by spending harder on acquisition, but if every new
customer costs more to win than they're worth, you aren't scaling — you're buying revenue at
a loss. **Premature scaling is the single most common way a promising venture dies.**

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
won a beachhead of small private practices. This chapter is about what you do with that win —
the systems a product needs once it has real users: analytics so you can *see*, support so
you can *hold*, unit economics so you know whether growth makes you stronger or weaker, and
defensibility so the win lasts.

---

## The scaling loop

A venture is not a static product. It's a loop — and growth that lasts isn't a straight line
up, it's the same loop run over and over, faster and tighter each time:

**build → sell → observe → support → learn → iterate.**

- **Build** — ship the smallest product change that solves a real customer problem (Chapter 2).
- **Sell** — get it in front of the right people (Chapter 3).
- **Observe** — watch what customers *actually* do, not what they say they'll do.
- **Support** — help them the moment they get stuck, before friction becomes churn.
- **Learn** — find the pattern behind the behaviour: what's working, what's confusing, who's
  leaving and why.
- **Iterate** — feed that learning back into the product, the positioning, the pricing, or the
  onboarding. Then round again.

**Observe → support → learn** is the part founders skip, and it's the part that turns a
first win into a durable one. Early on you can run this loop entirely by hand — talk to every
customer, watch onboarding over their shoulder, fix the bug while they're still on the phone.
You *should* do some of this for as long as you can; it gives you a feel for the customer no
dashboard ever will. But hand-observation breaks down the moment you have more customers than
hours. That's when you need systems that capture the signal for you — and the rest of this
chapter is those systems.

The discipline of scaling is making the loop turn quickly *and honestly*. Two things make it
turn: seeing clearly (analytics) and holding your customers' hands at volume (support). Two
tell you whether turning it is worth it: your unit economics and your defensibility. Those
four, in order.

---

## See clearly: add product analytics

You cannot improve what you cannot see, and you cannot iterate well if you don't know what's
broken. In the beginning you knew your customers by name — you could phone the coordinator at
the practice and ask how it was going. That doesn't scale. When you have two hundred
practices, "how's it going?" has to become a number you can read at a glance. That's what
product analytics is: instrumenting your product so it tells you the truth about what people
*do* — how many sign up, how many finish setup, which features they use, where they drop off,
whether they come back — instead of what they say they do. It doesn't replace customer
conversations; it keeps them honest.

Four things are worth measuring, and almost nothing else early on:

- **Events** — the specific actions that matter. Not "page views," but the handful of
  moments that mean value is being delivered: a practice connects its calendar, a no-show
  reminder goes out, an appointment gets rebooked. Name the few events that *are* your
  product working, and count those.
- **Funnels** — the ordered steps a customer takes to reach value, and where they fall out.
  Sign up → connect calendar → send first reminder → see first recovered appointment. If
  eight in ten practices sign up but only three connect their calendar, your funnel is
  screaming at you: the problem isn't acquisition, it's that first setup step. Fix the biggest
  drop-off first. (A funnel that reads "1,000 sign up, 150 connect a calendar" is telling you
  the problem is *activation*, not traffic — pouring more sign-ups in won't help.)
- **Session replay** — a recording of how a real customer moved through your product.
  Analytics tells you *where* something broke; a replay usually shows you *why*. When a funnel
  step leaks, watching three replays of people who fell out of it is often worth more than a
  day of guessing.
- **Retention** — do they keep coming back? This is the one that decides whether you have a
  business or a leaky bucket. And the right question isn't "do they come back every day?" —
  it's "do they come back at the **natural frequency of the problem you solve**?" A no-show
  tool is used whenever appointments are booked, not hourly; judge it against that rhythm. A
  cohort chart (this month's new practices, and how many are still active one, two, three
  months later) tells you in one picture whether the value is real. Rising acquisition on top
  of bad retention just fills the bucket faster than it drains — for a while.

The concrete tool most ventures reach for here is **PostHog** — it records events, draws your
funnels, plots retention cohorts, and captures session replays without you building any of
it. Setting it up has two parts, and only one of them is hard. The easy part is
*installation*: create a project, drop the library into your app, put the project key and
host in your environment variables (Chapter 2's secret management applies — never in the
code), and identify each user after they log in. The hard part is *deciding what to measure*,
and it's where founders go wrong in both directions — tracking almost nothing, or tracking
everything and drowning. Start with the few events that show whether a customer is moving
through the product successfully. A generic starter set looks like:

`signed_up` · `onboarding_completed` · `core_action_completed` · `trial_started` ·
`checkout_completed` · `subscription_upgraded` · `teammate_invited` · `support_ticket_opened`

— which, for our dental venture, becomes `practice_signed_up`, `calendar_connected`,
`first_reminder_sent`, `appointment_rebooked`, `subscription_started`. Use clear names, keep
staging and production data apart, and **never** track sensitive information — passwords,
payment details, private patient records, API keys.

Then run the analytics as its own tight loop:

1. Spot a drop-off or an odd pattern in a funnel or cohort.
2. Watch replays for that segment.
3. Talk to a few of the affected customers.
4. Form a hypothesis about the cause.
5. Ship one small change.
6. Measure whether the number actually moved.

But stay tool-light. A founder who watches four honest numbers beats one with a beautiful
dashboard of forty they never act on. Pick the few events that mean "value delivered," and
let everything else wait.

> **In the studio:** the loop that reads your product's behaviour and the loop that ships
> changes are the same loop. A lane can watch a funnel drop-off, draft the ticket to fix it,
> and surface it in your attention queue — with the number that justifies it attached, and a
> preview environment to click through. You approve the change; the studio never quietly
> ships one.

---

## Hold hands at volume: support that scales

The customers you fought to win gave you something valuable: trust. That trust has a limit —
there are only so many times a product can confuse someone before they leave. Support exists
to catch friction *before* it becomes churn. Every customer you add is another person who
will, eventually, get stuck.

Early on, support should be founder-led, and you should lean into it: watch your first
customers use the product, ask what they *expected* to happen, fix the bug in real time,
listen to the exact words they use for the problem. It doesn't scale, but it teaches you what
the product feels like from the customer's side — those conversations are how you learn. What
doesn't scale is answering the four-hundredth "how do I connect my calendar?" yourself.
Customers show up while you're asleep; they ask questions you've already answered a dozen
times; they hit bugs you can't personally triage at 2am. The job of scaling support is to
answer the *same* questions without a human each time, and save the humans for the questions
that are genuinely new.

Build it in layers:

1. **A knowledge base** — plain, searchable answers to the questions you're already tired of
   answering, written in the language *customers* use, not the language your codebase uses.
   Every support conversation you have now is a draft of a future article: write it down once,
   let it answer a thousand times. If customers keep asking the same thing, either the product
   is unclear or the docs are missing — usually both. Start with the basics: **getting
   started, core workflows, billing and plans, troubleshooting, account management, and known
   limitations.**
2. **Decision trees** — for common problems, a structured "is it this? then try that" path
   that walks a customer to the fix without a person, and makes escalation cleaner because
   whoever picks it up can see what's already been tried. Most support volume is a dozen
   issues repeating; a good tree resolves them at 2am when nobody's awake. Build trees for the
   most common and painful categories first: **login problems, billing questions, calendar or
   import failures, permission issues, core-workflow errors, cancellations, and bugs that
   block a customer from getting value.**
3. **AI support on top** — a layer that reads your knowledge base and answers in plain
   language, escalating to a human only when it genuinely can't. Tools like **Intercom's Fin**
   do exactly this: it comfortably handles the routine — password resets, billing updates,
   teammate invites, import failures, plan changes, basic troubleshooting — and hands you only
   what's worth your time. Draw the escalation line deliberately: it should **not** try to
   resolve refund disputes, security concerns, data loss, an angry enterprise customer, or a
   bug hitting many users at once. Those go to a human, or become product work. Automation
   isn't about hiding humans from customers; it's about resolving common questions quickly and
   *routing* the uncommon ones correctly.

The strategic point underneath the tactics: **support quality is a retention lever, and
retention is the whole game.** A practice that gets stuck and hears nothing churns; one that
gets an instant, correct answer stays — and your unit economics, next, are built almost
entirely on customers staying. There's a second dividend, too: the patterns you hear in
support are product feedback. A repeated question is a documentation gap or a UX flaw; a
repeated complaint is a roadmap item. Separate the one-off gripes from the patterns that
repeat, and feed the patterns back into the loop.

---

## Do the maths: unit economics, plainly

Revenue tells you how much money comes in. Profit tells you how much you keep. Both describe
the business from far away. To know whether it can actually *scale*, you have to zoom all the
way in to a single customer — and that's unit economics. It's just the answer to one
question: **for a single customer, do you make more than you spend?** If yes, every new
customer makes the venture healthier and you should grow hard. If no, growth is the worst
thing you can do. Let's build the picture one honest number at a time, with our dental
practices.

**ARPU — Average Revenue Per User.** What one customer pays you, on average, per period —
your total revenue divided by your number of customers. Say each practice pays **£200 a
month.** That's your ARPU.

> ARPU = total revenue ÷ number of customers

**Churn.** The share of customers who leave in a period. Be precise about two things. First,
the *period*: a 4% **monthly** churn is a completely different business from 4% **annual** —
always state which. Second, *what* is churning: **logo churn** is the percentage of
customers who leave; **revenue churn** is the percentage of recurring revenue that leaves
(the two differ when your bigger accounts leave at a different rate than your small ones). Say
**4% of practices cancel each month.** Churn is the number most founders underrate — it
silently sets everything below.

> revenue churn = recurring revenue lost in the period ÷ recurring revenue at the start of it

**Average customer lifetime.** How long a customer stays, which falls straight out of churn —
it's **1 ÷ churn** (in the same time unit as the churn rate). At 4% monthly churn, the
average practice stays **1 ÷ 0.04 = 25 months.** Halve your churn and you double how long
every customer stays — which is why the boring work of onboarding and support is an
*economic* decision, not a nicety.

> average lifetime = 1 ÷ churn rate

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
the tools, the ad spend that didn't convert. Founder-led selling is especially easy to
understate, because your own time looks free; it isn't, and that motion won't scale without
cost. If last quarter you spent **£30,000** across sales and marketing and won **30
practices**, then:

> COCA = sales & marketing spend ÷ new customers won = £30,000 ÷ 30 = **£1,000 per customer.**

**Now put the two together.** The comparison that decides everything is the **LTV:COCA
ratio:**

> £4,000 : £1,000 = **4 : 1.**

The rule of thumb: LTV should be at least **three times** COCA. Below that and there isn't
enough margin to cover the rest of the business; much above it and you're probably
*under*-spending on growth. If the ratio is upside down, you have five levers and only five:
lift retention, raise price, improve margin, lower acquisition cost, or revisit your ICP. At
4:1, our venture has a real engine.

And **payback period** — how long until a customer has paid back what it cost to win them.
Each practice throws off £160 a month in margin (£200 × 80%), so £1,000 ÷ £160 ≈ **6 months.**
After half a year, that customer is pure fuel. A short payback means you can grow from your
own cash flow instead of borrowing against a distant LTV.

The one number that ends the conversation: **if COCA is ever equal to or greater than LTV,
stop.** It costs more to win a customer than they're worth; no amount of scale fixes that —
it only enlarges the loss. Fix the model *before* you scale it.

A note on precision: with a small number of customers these figures will be noisy, so don't
obsess over the second decimal place early on. What you're reading is **direction.** Are
customers staying longer? Paying more? Costing less to acquire? If the arrows point the right
way, the machine is getting healthier — and *that's* the signal to lean in.

> **In the studio:** these aren't numbers you assemble in a spreadsheet at quarter-end. ARPU,
> churn, and a top-down COCA are read straight off the analytics, the billing data, and the
> sends the studio already tracks — surfaced in plain language, so a founder can see at 22:00
> exactly whether the engine is running rich or lean, and which segment is retaining best.

---

## Grow the map: expand the business

Once the beachhead is won, support is manageable, and the economics are sound, the next
question is how to raise the *ceiling* of the business. You expand — deliberately, one move at
a time. There are two directions, and it helps to name them:

- **Horizontal** — the *same* product to *new* markets. You've won small private practices;
  now you take dental groups, or physiotherapy clinics, or veterinary surgeries who lose
  money to no-shows in exactly the same way. Works best when your core technology ports to
  adjacent customers who share the pain, and the new segment is larger.
- **Vertical** — *new* products to the *same* customers. Your practices trust you; now you
  sell them the next thing they need — recall reminders, patient rebooking, payments. Works
  best when the adjacent pain is obvious, the customer already trusts you, and the new product
  lifts retention or ARPU.

Which way you go was sketched long before you got here. Back in Aulet's Step 14 you mapped
the **TAM for follow-on markets** — the markets that open up *after* the beachhead falls.
(TAM, "total addressable market," is the whole revenue opportunity if you won every customer
in a market.) That map wasn't meant to be worked early; it existed to prove the beachhead was
a doorway, not a dead end. Now it becomes your sequence.

The danger in both directions is the same: distraction. **Don't expand because you're bored**,
and don't expand while the current thing is still leaking. Before you enter any new market,
ask the pre-expansion questions honestly:

- **Is the beachhead *genuinely* won** — retention holding, economics proven — or am I running
  from a problem I haven't solved? Adding markets on top of unproven retention multiplies the
  leak, not the value.
- **Where is demand already showing up?** Look at inbound requests, support tickets, and sales
  conversations. If customers keep asking for the same adjacent thing, that's a signal worth
  taking seriously — far better than a hunch.
- **Does this improve the unit economics — retention, ARPU, COCA, or payback** — or just grow
  revenue? Expansion should make customers more valuable or cheaper to win. If it does
  neither, it's probably a distraction dressed up as growth.
- **Will it strengthen the core product or split focus?** The best expansions make the thing
  that's already working *better*. The worst ones divide engineering attention and slow it
  down. Does this next market share my **Core** — the same underlying advantage, dataset, or
  relationship — so the win compounds rather than starting from scratch?
- **Can I test demand before building the whole thing?** Sell the expansion before you build
  it: talk to customers, get a verbal commit or a letter of intent. If nobody will say yes
  before it exists, the demand may not be there. And does it *meaningfully* enlarge the TAM —
  enough to be worth the focus you're spending?

Each new market re-runs the earlier questions in miniature — a new persona, a new value
number, a new set of ten customers. It doesn't get to skip them because you're bigger now.

A word on **fundraising**, because expansion is when the temptation peaks. Raising money is a
**tool, not a goal.** It buys speed to run the scaling loop faster on a model you've *already
proven*; it cannot manufacture a model that isn't there. Raise when you have an engine that
turns cash into more cash than you put in, the opportunity in front of you is clearly bigger
than the business can self-fund, and you simply want to feed it faster. Raising to *find* that
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
  can point to turning, having run it by hand first and then handed the observing to systems.
- **Product analytics** live: the few **events** that mean value, the **funnels** where
  customers drop out, **session replays** for the segments that leak, and a **retention**
  cohort judged against the natural frequency of your problem — with a repeatable
  spot-it → watch → ask → hypothesise → ship → measure loop you actually run.
- **Support that scales** — a knowledge base, decision trees, and an AI layer (Fin) on top,
  with a deliberate escalation line — protecting the retention your economics depend on, and
  feeding repeated questions back into the product.
- Your **unit economics** written down and checked: ARPU, churn (logo vs revenue, and the
  period stated), average lifetime, **LTV**, a **top-down COCA**, an **LTV:COCA** ratio at
  3:1 or better, and a payback period you can live on — read for direction, not false
  precision.
- An **expansion sequence** from your follow-on-market map — horizontal or vertical — with the
  pre-expansion questions answered honestly, demand tested before you build, and a clear-eyed
  view of fundraising as fuel, not rescue.
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
