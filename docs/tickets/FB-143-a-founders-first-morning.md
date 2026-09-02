# FB-143 — A founder's first morning

**Status:** Done · **Area:** Studio / onboarding · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 2 "Day one"; `screens/03-Day_one.txt`.

## Why this matters (for the founder)

This is the only screen a founder sees **before they have any reason to trust the studio**. Every
other screen is judged against what they already believe; this one creates the belief.

It is also the screen where nothing has happened yet, which is the hardest thing to render honestly. A
venture with no tickets, no runs, no memory and no history looks exactly like a venture that is
broken. The design's answer is to make emptiness read as *readiness*:

> **Good morning. Arca is ready.**
>
> Your team is set up and waiting for its first piece of work. Start with what you already have:
> research, notes, a deck, exports from other conversations. Hand it over, and it becomes what Arca
> knows.
>
> **Tell the studio what you want →**
>
> *What will be here*
> The office: your agents, live, at their desks.
> Tickets: everything you have asked for, each one followable to where it changed things.
> A queue that counts only what waits on you.

One action. Not three, not a tour, not a checklist. The handoff's own note says so: *"one action, per
FB-066 in the build."*

## Why this is its own ticket

It was inside FB-135 with the sign-in restyle, and it should not have been. Sign-in is a restyle of a
working screen; this is the venture's whole first impression and the only screen whose job is to make
absence feel deliberate. They share a route boundary and nothing else, and bundling them means the
harder one gets whatever attention the easier one leaves.

It is also the screen most likely to be **wrong in a way nobody notices**, because the people building
it never see it — we all work on a venture ten weeks in. The wireframe is explicit that day one is a
whole mode, not a screen: *"every screen has a truthful empty state (idle office, 'No runs yet', empty
memory with invitation)."* This ticket owns the day-one screen; FB-137 owns those states elsewhere.

## What is true today

`boardState` already computes `first-run`, and `components/FirstRun.tsx` renders it (FB-066). The
copy is operator-shaped and the screen carries more than one action.

Three things make a day-one venture genuinely different, and each has bitten already:

- **A venture may not be fully wired.** The admin ledger's own footnote is the warning: *"Caldera's
  composer key is not set; its founder meets a dead button on day one. Fix before invite."* A missing
  `COMPOSER_API_KEY_<VENTURE>` means the one action on this screen fails on press.
- **A venture may have no box yet.** `hasComposer` and `chatUrl` are already null-able for exactly this.
- **The empty states below are not free.** `lib/firstrun.ts`'s `emptyPanel` exists; it is applied unevenly.

## Scope

- The day-one screen, driven by the existing `boardState === 'first-run'`: greeting, exactly one
  action, and the "What will be here" list — with the design's copy.
- **The single action tells the truth about whether it will work.** If the venture has no composer key
  or no box, the screen says what is missing and who fixes it, in a founder's language, instead of
  offering a control that fails. A dead control is forbidden by the design contract; this is the
  screen most likely to ship one.
- The transition out of day one is not a reload the founder has to guess at: filing the first piece of
  work moves them on.

## Out of scope

- Sign-in — FB-135.
- Empty and degraded states on every other screen — FB-137. This ticket owns day one only.
- Provisioning a venture. This *surfaces* an unwired venture; fixing it is the runbook's job.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint      # fails on dead UI, which is this screen's specific risk
make ticket-drift
```

Against a genuinely empty venture, not a mocked one — the `example` manifest exists for this:

```
# 1. wired, empty        → greeting, one action, the list; pressing it opens the composer
# 2. no composer key     → says what is missing and who fixes it; no control that fails on press
# 3. no box at all       → same discipline
# 4. after the first filing → the founder is moved on, without a manual reload
```

## The defect this closes

`hasComposer` only ever asked whether a venture had a **box**. The failure the admin ledger warns
about is the other one — *"Caldera's composer key is not set; its founder meets a dead button on day
one"* — and a venture with a machine and no key passed that check. Day one offered its one action,
and the action failed on press, on the only screen a founder sees before they have any reason to
trust the studio.

Wiring is three states now, not a boolean: `ready`, `no-box`, `no-key`.

## Two places the design's copy did not survive contact

**"Good morning."** The design's line is *"Good morning. Arca is ready."* The half that does the work
is the second one — it is what turns an empty screen from evidence of a broken product into evidence
of a ready one. The first half is a claim about the reader's local time that the studio cannot check:
a founder outside Edinburgh is greeted with the wrong time of day on the one screen whose entire job
is to be believed. The readiness stays; the clock goes.

**"Your agents."** `copy-lint` refused *"The office: your agents, live, at their desks"*, and rightly.
The founder vocabulary has said "your team" since FB-103, after the studio drifted back into
engineering words four separate times. Day one is the worst possible screen to introduce "agent" on.
The image is the design's; the word is the contract's.

## Driven by hand, against a genuinely empty venture

Not ARCA with a flag forced — a build run with every fixture pointed at an empty directory, so the
venture is actually empty, with the composer key controlled per run.

| State | Heading | Actions | What it says |
| --- | --- | --- | --- |
| **1. wired, empty** | *Welcome, John. ARCA is ready.* | **1** | *"Your team is set up and waiting for its first piece of work… hand it over, and it becomes what ARCA knows."* |
| **2. box, no key** | *Welcome, John.* | **0** | *"ARCA has its own machine, but the studio cannot reach it yet. Bruntsfield is finishing the connection — there is nothing for you to do, and nothing is lost."* |
| **3. no box at all** | *Welcome, John.* | **0** | *"…its own machine is still being built… Bruntsfield is handling it — there is nothing for you to do."* |

All three show the "What will be here" list — three lines, beside the action rather than instead of
it, so a founder who presses nothing still leaves knowing what the page is for.

**State 2 is the one that changed.** Before this, ARCA-with-no-key rendered the action, because it
has a box.

## Acceptance criteria

- [x] A first-run venture renders the greeting, **exactly one** action, and the "What will be here"
      list. Driven, above.
- [x] A venture with no composer key or no box says what is missing, in plain words, and offers no
      control that would fail on press. `make design-lint` passes. Neither message blames the
      founder: both name Bruntsfield and say there is nothing for them to do.
- [x] Filing the first piece of work moves the founder off day one without a manual reload.
      `clearTicketCache` has been exported since FB-006 and **called by nothing**; `filePlan` clears
      it and the attention cache on both success paths. Without it a founder files their first work,
      returns to their desk, and is told their team is still waiting for its first piece of work —
      for up to two minutes, with no way past but a URL parameter they have never seen.
- [x] Checked against a genuinely empty venture in all four states, with what was seen recorded
      above — not against a ten-week-old ARCA with the flag forced.

## What is proven at the cache level rather than end to end

The transition is wired and the cache behaviour is tested directly — populate, confirm the second
read is cached, clear, confirm it re-reads. Driving it *through* a real filing needs a live composer
on a venture that is genuinely empty, which is the ARCA-token block (FB-072). The mechanism is the
part that was missing and it is now there.
