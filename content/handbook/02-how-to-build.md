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

There's a quieter version of the same mistake, and most first-time founders make it:
they think "building" means opening a code editor and hacking until something works.
That gets you a *prototype* — which is genuinely useful early — but it does not get you a
company. A real product needs architecture, a database, deployment, testing, security,
and a plan to keep it all running as you grow. This chapter walks the whole lifecycle,
from a one-page spec to a deployed product to keeping it alive under load. At each step
we'll say what matters, what most people get wrong, and how the Foundry does the heavy
lifting so you can stay on the one thing only you can do: deciding what to build and
what "good" looks like.

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

### Write the spec down — the three questions

Before a single line of code, turn that MVBP into a plan: a short, honest specification
of what the product does and who it's for. It doesn't need to be formal — a one-page
document or a tight bullet list is enough. What matters is that you've committed to a
boundary. Answer three questions:

- **What is the core problem you're solving?** Be ruthlessly specific. "Helping dental
  practices" is not a problem statement. "Independent practices lose money because
  patients no-show and no one reliably reminds them" is. The tighter the definition, the
  easier every later decision becomes.
- **What is the minimum set of features that solves it?** List everything you think you
  need, then cut it in half. Seriously. If the MVBP has more than three to five core
  features, it's too big — you're building the first thing a real user will test, not the
  final product. For us that's: send reminders, let the patient confirm or reschedule,
  take the monthly payment. That's it.
- **What platform are you building for?** Web, mobile, or desktop? For almost every early
  venture the answer is **web** — it's the fastest to build, the easiest to deploy, the
  simplest to iterate on. You can always go native later once the product is validated.
  Our reminder tool is a web app for the coordinator, and reminders reach patients by
  text and email — no app for the patient to install.

Write the answers down. That is your spec, and it's the thing the build is measured
against.

> **In the studio:** the spec isn't a document you write alone at a blank page. You shape
> it in conversation with a lane — an AI co-founder that helps you pressure-test the
> feature set, cut what isn't essential, and produce a structured plan you can build from.
> This *plan-first* step is deliberate: the discipline is **plan → review → ship**, and
> nothing large or ambiguous starts until the plan itself has been reviewed. It's most
> useful precisely when you're non-technical and unsure what's feasible — the plan is
> where "is this too big?" gets answered before it costs you a month.

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

### A home for the code: the repository

Everything the venture is made of — code and text alike — lives in one shared,
version-tracked folder of record called a **repository** (a "repo"). Under the hood this
is **Git**, a *version-control system* that records every change anyone makes, and
**GitHub**, the service that hosts the repo in the cloud and adds the tools for review
and collaboration. Why does this matter to a non-technical founder? Because without
version control you are one bad edit away from losing hours or days of work. With it, you
can experiment freely, roll back mistakes, and have several people (or several agents)
work without stepping on each other.

Setting a repo up well is mostly *hygiene* — a few unglamorous things that pay off
forever:

- A sensible **folder structure** for the tech stack, so the project isn't a junk drawer.
- **Branch protection** on the main line (more on branches below), so nobody — including
  you at 2 AM — can push broken code straight to production.
- A **README** — a plain-English file explaining what the project is, how to run it, and
  how to contribute.
- A **.gitignore** — a list of things Git should *never* record: secrets, giant
  auto-generated folders, local junk. It's the difference between a clean history and one
  with a password committed into it forever.

### Branches, pull requests, and the rule that makes speed safe

Nobody edits the live version directly. Instead, each change is made on a **branch**: a
parallel copy of the project where you can work without disturbing what customers are
using. Think of it like a suggestion on a shared document — you're *proposing* changes
that can be reviewed before they're accepted. When the change is ready, it opens as a
**pull request** (a "PR") — a formal "here's exactly what I changed, please review it"
request, shown as a reviewable before-and-after that a person reads and approves before
it becomes real. These two ideas — the branch and the PR — are the bedrock of how modern
software gets built, and you'll see them throughout this handbook.

That gives us the rule that makes speed safe, the same one from Chapter 1's studio:
**one ticket, one branch, one pull request — and the lane never merges itself.** Each
ticket is one small, readable change; a lane does that one change on its own branch and
opens one PR. No lane bundles unrelated work together ("while I was in there…"), and
discovered work becomes a *new* ticket rather than sprawling the current one. An agent
can do a piece of work as fast as it likes; the worst it can do is *propose* a change
that a human then reviews. The main line is protected server-side (this is what **branch
protection** means — a rule the server enforces so nothing reaches the live code except
through a reviewed PR), which means "a human always approves" isn't a good intention you
might forget under pressure. It's mechanically true. Git is also the *record*: the studio
keeps no separate database of your work — it reads the tickets and PRs straight from the
repo and renders them, so what you see is always what actually exists.

### Environments: where the product runs

An **environment** is just a running copy of your product, and you want a few of them so
that testing never happens on your customers by accident:

- **Development** is traditionally your own laptop, where code is written and tried
  first. (In the studio you can skip this entirely — agents write code and deploy it to a
  live preview, so you review a real URL instead of running anything locally.)
- **Staging** is a cloud copy that *mirrors production* — the safe rehearsal space where
  integrated changes are tested before they go live. It tracks your main development line.
- **Production** is the real one your customers touch. It should only ever receive code
  that has already proven itself in staging.
- A **preview** environment is a throwaway copy spun up for a single change. Every time a
  branch opens a PR, a unique live URL appears where you (and your customer) can *see* the
  reminder-reschedule flow working on a real screen before it ever reaches a real patient.

Preview environments matter more than they first appear, because agents work fast. A
single lane can open several PRs in the time it takes you to review one — and with a live
preview per PR you don't have to hold the change in your head or pull a branch onto your
laptop to picture it. You click through each one, in its own real environment, and merge
the ones that are right. That's the shift the whole model turns on: instead of being the
person who writes every line, you become the person who *steers* — directing lanes,
reviewing live output, and shipping the good stuff. Code review stops being a bottleneck
and becomes a light, fast quality gate.

### Secrets: keys stay out of the repo

A **secret** is a password or key that unlocks a paid service — your payments account,
your text-message provider, your database connection. Secrets **never** go in the repo,
not even briefly, not even in a private one. If a secret lands in a Git commit it's in the
history *forever* (or until a painful history rewrite), and a key that's been committed is
a key you have to treat as stolen. Instead they live as **environment variables** —
values stored outside the code and injected at runtime — set separately per environment,
so your staging copy talks to a staging database while production talks to the real one,
without changing a line of code. A few rules of thumb:

- **Never commit a `.env` file.** Add it to `.gitignore` immediately.
- **Use different secrets per environment.** Staging keys should not equal production keys.
- **Rotate secrets** periodically — and immediately if one is exposed or someone leaves.
- **Limit access.** Not everyone needs the production keys.

> **In the studio:** secrets are managed for you and never touch the repo — they live only
> on the venture's own box and deployment environment, synced across environments so a lane
> can use them without ever seeing them written into code. This is the same firm line that
> runs through the whole system: memory and tickets hold knowledge, never keys.

---

## The build stack, without the jargon

With the machinery understood, here's what actually gets assembled. Every modern web app
has two sides: the **frontend** (what users see and touch — buttons, forms, pages) and the
**backend** (what happens behind the scenes — storing data, signing users in, running the
logic, answering requests). We build the backend first, because it's the foundation
everything else sits on.

### Scaffold: don't start from a blank page

You start by **scaffolding**: standing up the skeleton of a working app so you're not
building from nothing. A scaffold is more than a folder tree — it's the wiring in place, so
a page can render a screen, a form can call an action, the action can validate input, and
the database can change and the screen refresh. Our ventures scaffold with **Next.js** (a
popular web framework that lets you build both the pages users see *and* the server-side
logic behind them in one project, built on **React**, the most widely used tool for
building interfaces) on top of **Supabase** (a hosted service that hands you a database,
user sign-in, and file storage out of the box — think of it as the back office of the app).
That combination — Next.js + Supabase — is battle-tested, well-documented, one of the
fastest routes from zero to a working product, and deliberately the *same* stack across
ventures, so the machinery above works identically everywhere.

On cost, so the numbers don't scare you: GitHub is free for private repos; Supabase has a
free tier that's more than enough for development and early users, with paid plans from
about **$25/month** when you need more storage or compute. Between hosting and Supabase you
can realistically run a real production app for **under $50/month** until you have
meaningful traffic. The expensive part of a startup is your *time*, not your server bill.

### The backend — four things

The backend is the part the customer never sees, and at minimum it's four things:

- **Auth** — short for *authentication*: how a person proves who they are when they sign
  in, so the coordinator sees her practice and no one else's. It covers sign-up, login,
  password reset, sessions, and social login (via Google, and so on). **Do not build your
  own.** Auth looks like just a login form, but underneath sit dozens of security concerns
  — safely storing passwords, managing sessions, blocking brute-force attacks, "forgot
  password" flows — and getting any one wrong exposes your users' accounts. Supabase Auth
  handles all of it, including *magic links* (passwordless login by email), and ties into
  the database's own security so each user only sees their own records.
- **The database** — where the durable facts live: practices, patients, appointments,
  which reminders were sent. Supabase gives you **PostgreSQL**, the same industrial-grade
  database that powers some of the largest apps in the world, so it's not something you'll
  outgrow. Think about your data's shape early — what does the app track, and how do the
  pieces connect (a practice has many patients; a patient has many appointments)? — but
  don't overthink it; the structure will evolve. When you later change that *shape* —
  adding a column for "reschedule link tapped," say — you can't just edit it like a
  document. You do it with a **migration**: a recorded, repeatable set of instructions that
  transforms the database from the old shape to the new one *without losing existing data*.
  This is one place where care genuinely pays: a botched migration on a production database
  full of real customer data is one of the worst spots a founder can be in, so migrations
  run every environment the same way and nothing is done by hand in the dark.
- **An API layer** — the set of doors through which the pages ask the backend to do things
  ("send this reminder," "book this new time," "load this patient's list"). In Next.js you
  define these right inside the project — no separate server. Keep them clean: check that
  incoming data is *valid* before doing anything with it, and return helpful errors when
  something's wrong. These boring fundamentals are what separate a production app from a
  hackathon demo.
- **Integrations** — the outside services you plug in rather than build. For the dental
  MVBP that's **Stripe** for taking the monthly payment (it handles cards, subscriptions,
  invoicing and tax; it charges **2.9% + 30¢ per transaction** with no monthly fee, so you
  only pay when you make money) and a messaging or email provider like **Postmark** for
  actually delivering the reminders (focused on *transactional* email — receipts,
  reminders, resets — with strong deliverability so messages land in inboxes, not spam;
  free to develop on, paid plans from about **$15/month** for 10,000 emails). These often
  talk back to you through a **webhook** — an automated message a service sends the moment
  something happens (Stripe pinging your app the instant a practice's payment succeeds), so
  your app reacts to real events instead of constantly asking "has it happened yet?"
  Webhooks look simple but carry the edge cases — failed payments, refunds, cancellations,
  upgrades — so this is exactly the kind of integration worth getting right and testing.

### Security, explained simply

You are responsible for making sure the app doesn't leak user data — and this is the thing
that trips up most first-time founders. In plain terms:

- **Only send users the data they need.** If the coordinator asks for her profile, don't
  accidentally include anyone else's data in the response.
- **Don't trust anything from the browser.** A user — or an attacker — can send your server
  anything they like, so always re-check data on the server before saving or acting on it.
- **Make sure users can only see their own data**, and enforce it at the database, not just
  in the screens. This is **row-level security (RLS)**: a rule the *database itself* obeys
  about who may read which rows. Instead of trusting every screen to remember "only show
  this coordinator her own practice," the database refuses to hand over another practice's
  rows in the first place — so even a bug in your code can't expose someone else's records.
  It's the difference between a locked door and a sign asking people not to enter; for
  anything holding customer data, you want the lock.
- **Keep secrets out of the code** (as above), and **use HTTPS everywhere** — the encrypted
  version of web traffic, so data can't be read in transit. Your host handles this
  automatically.

None of this is optional. A data breach can kill a startup legally *and* reputationally,
and even with the studio setting up good defaults, understanding your own security posture
stays your job as the founder.

> **In the studio:** the backend arrives with these best practices already wired — Supabase
> Auth, a schema with row-level security, environment-variable secrets, and validated API
> routes. That's a strong starting point, not a substitute for understanding it: you are
> ultimately responsible for your users' data.

### The frontend — and design without designers

The **frontend** is the part the coordinator actually touches: the screen where she
switches reminders on, sees which patients confirmed, and where the patient taps
"reschedule." In 2026 this is built in **TypeScript** (a safer, typed version of the
JavaScript language) using component frameworks like React — and it happens to be one of
the things AI agents do best: turning a described flow into working interface code.

But an agent is only as good as your direction, and *design thinking* is still yours to
own. Before anything gets built, you need to understand:

- **The core user flows** — every path a user takes, from sign-up to their first valuable
  moment to everyday use.
- **What happens at each step** — what's shown, what actions are possible, what happens
  when something goes wrong, what the edge cases are.
- **What it looks like** — not pixel-perfect, but a clear sense of layout, hierarchy, and
  interaction. A rough sketch is fine.

Traditionally this meant hiring a designer to make mockups in a tool like Figma, then
handing them to a developer to rebuild — slow, expensive, and full of back-and-forth. Now
agents can **design directly in code**: you describe what you want and the agent builds a
*working* version you can click through and iterate on in real time. The artifact is
working software, not a static picture — so you can try ten variations in the time it used
to take to get feedback on one. It should do the one job of the MVBP cleanly and nothing
more; resist dressing it up before you know the loop works.

Then you run the **frontend loop**: use the app like a customer, find the parts that feel
off (confusing copy, dead ends, awkward states), fix the smallest useful thing, and repeat
— cycling until the flow feels obvious to someone seeing it for the first time.

> **In the studio:** frontend iteration becomes a conversation. See something that looks
> wrong, describe the change, and a lane updates the code and redeploys the preview — a
> real-time loop, not a slow dev cycle. Every one of those changes still travels the same
> road: one ticket, one branch, one PR, a live preview to look at, and a human merge.

### Deploy to production

You've got a working app in staging. Going live is a *deliberate, reviewed, reversible*
step — never a heroic Friday-night push. If the pipeline's set up, promotion is five plain
steps:

1. **Check the preview.** Before anything merges toward staging, click through the change
   in its own preview URL. Does it look and work the way you expect?
2. **Test in staging.** Once merged, exercise the integrated result like a real user would.
   Try to break it — click what you shouldn't, enter what you shouldn't. Find bugs *now*.
3. **Merge to main** through a pull request with a review — even if, early on, you're
   reviewing your own change. In the studio a *human* does this; the lane never does.
4. **Deploy.** The main branch promotes to production. Set up correctly, this is close to
   one click.
5. **Verify in production.** Confirm it works in the live environment — occasionally
   something that passed in staging trips on a real difference (different keys, different
   database, different domain).

One more piece: **background jobs.** A normal request has to answer in a few seconds, but
some work takes far longer — sending a thousand reminders, processing an upload, running a
multi-step pipeline. Those run as background jobs: kicked off separately, retried
automatically if a step fails, resumed if interrupted, and visible on a dashboard showing
exactly what ran and when. For our reminder tool, "send tonight's batch to every practice"
is a background job, not something a single web request should try to hold open.

Ours run on **Railway** for hosting alongside Supabase; the point isn't the brand names,
it's that every stage above is gated, legible, and reversible.

---

## Testing, and avoiding AI slop

Because agent lanes can produce code fast, the real risk shifts. The danger isn't slow
work; it's **plausible-looking work that's subtly wrong** — what the industry, and we,
bluntly call *AI slop*. Code that runs, looks reasonable, and quietly does the wrong thing.
Keeping it out takes discipline, and generated code should pass three checks before it
ships: does the core flow actually work, is the code consistent and low-risk, and does it
feel right when a human uses it in the app.

- **Write tests.** Tests are small automated checks that assert behaviour — "when a patient
  taps reschedule, the old slot really is freed." *Unit* tests check one piece in isolation,
  *integration* tests check that pieces work together, and *end-to-end* tests simulate a
  real user clicking through the flow. You don't need total coverage on day one; start with
  the *critical paths* that would make the app unusable if they broke, then widen over time.
  They run on every pull request, so a change that breaks the paid loop is caught before a
  human even reviews it. **One warning:** a bad test is another form of slop. Agents
  sometimes write tests that are circular ("does this code do what this code does?") or
  quietly rigged to pass no matter what. A test must prove a *user outcome*, not just echo
  the implementation — so review the test logic, and be suspicious of any test that looks
  too clean to be checking anything.
- **Set up linting and formatting.** A *linter* automatically scans code for likely bugs
  and style slips — spell-check and grammar-check for code. The standard pair for this stack
  is **ESLint** (catches likely mistakes) and **Prettier** (keeps formatting consistent).
  Run them automatically on every save and commit. This matters *especially* with agents,
  because different agents — or the same one on a different day — drift in style; the linter
  keeps everything uniform.
- **Configure agent rules.** Give the agents a rules file (an `agents.md` in the repo root)
  that tells them your tech stack and versions, your naming and file conventions, which
  libraries to use and avoid, examples of good code in *your* project, and the pitfalls
  specific to it. Think of it as onboarding documentation for an AI teammate — the better
  the rules, the better the output.
- **Test like a user.** Finally, use your own product, constantly. Every feature, use it the
  way a real coordinator would — on your phone, on slow internet, clicking things you
  shouldn't. This catches what automated tests miss: awkward flows, confusing copy,
  interactions that technically work but feel wrong.

The habit above all others is **the human gate itself** — a person reading the diff is the
backstop no test fully replaces. Fast building only stays safe because *nothing ships
unread*. Speed and the review gate aren't in tension; the gate is what lets you go fast
without fear.

---

## When it breaks

It will break — every real product does. Not *if*, *when*: a query times out, an
integration returns something unexpected, a user finds a flow you never tested. A founder
blocked at 22:00 needs to see *why*, in plain language, not a wall of silence. So the rule
is: **fail loud.** When a reminder fails to send, that failure surfaces as a legible run
report, not a swallowed error.

The first question when something breaks is *where do you look?* Almost always one of a
short list:

- **Hosting logs** show what's happening in your API routes and server-side functions. If a
  page won't load or an API call is failing, start here — you get real-time logs, error
  rates, and response times.
- **Supabase logs** show what's happening in the database. If data isn't saving, queries are
  slow, or sign-in is failing, look here — query performance, auth events, database errors.
- **Browser developer tools** are your frontend toolkit, opened in any browser (usually with
  F12). For a non-technical founder the two useful tabs are **Console** (which shows
  JavaScript errors) and **Network** (which shows the requests the app is making).
- **Error monitoring** — a service like **Sentry** — automatically captures errors in the
  live app, shows exactly where each happened, and groups similar ones so you can prioritise.

The reassuring truth about debugging: most bugs aren't mysterious. They're usually a typo,
a missing environment variable, an API that changed its response, or a query that didn't
account for a new edge case. The hard part is rarely *fixing* the bug — it's *finding* it,
which is exactly why the infrastructure underneath is kept simple and inspectable, and why
failures are surfaced honestly. You fix the root cause with one more small ticket, one more
reviewed change — never a frantic hot-patch straight onto the live system.

---

## Keeping it running: infrastructure as you grow

Once the app is live you have to keep it running, and post-launch that comes down to two
things: reliability and cost.

- **Scaling the database.** As users grow, the same lookup that was instant at 100 users can
  crawl at 100,000. The usual fix is an **index** — think of it as a table of contents that
  helps the database find things fast; Supabase's dashboard shows you which lookups are slow
  so you know where to add one. Watch two more things: **storage growth** (database storage
  costs money — move rarely-touched data, like old logs, out of the main database, and set
  retention policies early) and **too many simultaneous users** (each active user takes a
  connection, and there's a limit — connection errors mean it's time to upgrade the plan).
- **Scaling compute.** Hosting scales the app up and down with traffic automatically, which
  is great for spikes — but usage-based billing means a spike (or a bot hammering you) can
  run up a bill fast. Four defences: **cache** aggressively (save the result of an expensive
  operation and reuse it instead of recomputing every time); **rate-limit** your APIs (cap
  how many requests any one user or bot can make); **monitor usage** with billing alerts so
  you're never surprised; and **optimise** slow functions (three seconds where 200
  milliseconds would do is money leaking).

There's a classic founder dilemma here — throw money at infrastructure to move fast, or
optimise ruthlessly for efficiency? Early on, optimise for **speed**: your time is worth
more than your server bill. As you scale, efficiency starts to matter because infrastructure
cost eats into margin. Judge it by your stage, not by instinct.

> **In the studio:** the machine watches its own infrastructure — flagging performance
> issues, opening PRs to fix them, and helping you make scaling calls as the venture grows —
> all of it still arriving at your queue as a reviewable change, never an autonomous one.

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
- A written **spec** — the core problem, the three-to-five essential features, and the
  platform — that the build can be measured against.
- A ranked list of **key assumptions**, with the most fatal-and-uncertain one **tested
  cheaply** by an experiment that could genuinely have failed.
- The **machinery** understood and running: a repository with good hygiene (README,
  `.gitignore`, folder structure), branch protection, and the one-ticket-one-branch-one-PR
  discipline where a human always approves the merge.
- Separate **environments** (development, staging, production, and per-PR previews) and
  **secrets** kept out of the repo, set as environment variables per environment.
- A working **build stack** — scaffolded frontend and backend, with auth, a PostgreSQL
  database and its migrations, an API layer that validates its input, payment and messaging
  integrations (Stripe, Postmark) with their webhooks handled, and security you understand:
  **RLS**, server-side validation, HTTPS.
- **Tests** on your core flows running on every change, **linting/formatting** and an
  **agent-rules** file keeping output consistent, and a **fail-loud** habit — so slop is
  caught and failures are legible.
- A place to **look when it breaks** (hosting and database logs, browser dev tools, error
  monitoring) and a rough grasp of how you'll **scale** the database and compute — and their
  cost — as you grow.
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
