# FB-128 — The desk

**Status:** Todo · **Area:** Studio / desk · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 3 "The desk"; `screens/04-The_desk.txt` for exact copy.

## Why this matters (for the founder)

This replaces the venture board as the thing a founder opens and leaves open. It answers, in one
screen and in this order: *what is happening, what waits on me, what did my team do, and is any of it
working.*

The order is the argument and is contractual:

1. Eyebrow, title, and a **live serif summary sentence** — "Arca gives founders one place to raise…
   3 decisions wait on you; your team is on 2 moving tickets, and £220 of £700 is spent this month."
2. **The blocker banner**, amber: "You are the blocker on 3 items; the oldest has waited 3 days. Decide now →"
3. **The degraded strip**, when reads fail — grouped by cause, and *below* nothing the founder must act on.
4. **The prompt bar** — "Tell the studio what you want…" with example chips that seed the composer.
5. **The office** — the live plate beside the agent ledger. Same events, two renderings.
6. **What the engine did** — run reports, the heartbeat line, the held-plan release button.
7. **Waiting on you** — the queue, each row opening its ticket.
8. **The company, by surface** — Build, Sell, Scale.

## What is true today

Almost all of it exists and is being re-arranged, not invented: `lib/brief.ts` composes the summary,
`lib/attention.ts` the queue, `lib/runreports.ts` and `describeRun` the run log, `lib/budgets.ts` the
spend, `app/actions/release-plan.ts` and `components/ReleasePlanButton.tsx` the held-plan release
(FB-122 — and the design independently specifies the same label, *"Go ahead with this"*, never
"Approve"). `WhileWorking.tsx` holds the polling discipline.

**The venture page currently takes ~8.5 seconds.** FB-123 took it from ~41s by bounding the run-report
reads; the rest is nine sequential awaits on this page. This ticket rebuilds that page, so it is the
right moment to parallelise them rather than carry the shape forward.

## Scope

- The eight sections above, in that order, with the design's copy.
- The office plate is a **placeholder** here; the live feed is FB-139. It must read as not-yet-live.
- Sell's and Scale's outcome lines follow `docs/decision-surface-outcomes.md` — Build's line is true
  today; the others render what exists and invent nothing. Scale says "Not connected · platform tbd".
- The held-plan release uses the existing `releasePlan` action and its existing label.
- **Parallelise the page's loads.** The reads are independent; awaiting them in sequence is why the
  page is slow.

## Out of scope

- The live office feed (FB-139) and the desk's own live refresh beyond `WhileWorking`'s discipline.
- Tickets, composer, memory — their own tickets.
- Empty and degraded states, which FB-137 makes true on every screen at once rather than here alone.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift
```

Measured on production, signed in as ARCA's founder, three consecutive loads:

```bash
for i in 1 2 3; do curl -s -b cookies -o /dev/null -w "%{time_total}s\n" "$BASE/venture/arca"; done
```

## Acceptance criteria

- [ ] The eight sections render in the design's order, with its copy.
- [ ] The summary sentence, the blocker banner and the rail's "Needs you" badge read from one count.
- [ ] The degraded strip appears only when reads actually failed, groups by cause, and sits below
      anything the founder must act on.
- [ ] A prompt chip seeds the composer with that text; it does not file anything.
- [ ] The held-plan button is the existing `releasePlan` path and still reads "Go ahead with this".
- [ ] Scale renders "not connected · platform tbd" and counts tickets waiting on it — no invented number.
- [ ] **The page loads in under 3 seconds** on production with ARCA's real data, measured three times
      and recorded in the PR. The current 8.5s is the baseline to beat.
- [ ] Venture scoping unchanged; a founder sees only their venture.
