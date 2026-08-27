# FB-129 — Tickets: master-detail, and deciding without leaving

**Status:** Todo · **Area:** Studio / tickets · **Depends on:** FB-124
**Design:** `docs/design/foundry-desk/` — screen 4; `screens/05-Tickets.txt` for exact copy and states.

## Why this matters (for the founder)

Today a founder reads a ticket in a drawer and approves work in a different place — the attention
queue. The design makes them one screen: a list on the left, the ticket on the right, and the decision
**in the ticket**, with what it reaches, what it costs and what proves it, so the founder never has to
hold two screens in their head to say yes.

And when they have said yes, **"Next decision →"** takes them to the oldest remaining one. Three
decisions become one sitting rather than three navigations.

## What is true today

`/attention` lists open PRs and the founder acts there. `components/TicketDrawer.tsx` shows the ticket.
`lib/approvals.ts`, `lib/approval-attestation.ts` and `lib/provenance.ts` already sign and verify
grants; `app/actions/approvals.ts` is the approve path; `sendBackWork` is the refuse path. The board's
five status groups are `lib/tickets.ts` — including `filed` from FB-120.

## Scope

- **Master-detail.** Filters: Needs you (N) / All / Underway / Done and stopped. A live summary
  sentence: *"9 tickets: 3 waiting on you, 2 moving, 4 settled. Every one can be followed to where it
  changed things."*
- **`/attention` is absorbed** as the "Needs you" filter. The old route redirects rather than 404s —
  a founder may have it bookmarked.
- **The detail**: state eyebrow, title, prose paragraphs, the trace line, "Discuss in the composer →",
  the branch and `docs/tickets/<id>.md` line, and clickable Depends-on chips from `depends_on`.
- **The selected ticket and the filter live in the URL.** Not component state: "Discuss in the
  composer →" leaves this screen and the founder comes back, dependency chips link ticket-to-ticket,
  and "Next decision →" is a navigation. All three break if the selection cannot be addressed. It is
  also what makes a ticket linkable at all — from the desk's queue, from a run report, from Slack.
- **The decision panel**, for items needing one: Reaches / Costs / Proven, Approve (or Approve-and-send),
  "Refuse, and say why" with a required note, and **"decision N of M"**.
- **Chaining.** After deciding, the panel becomes "Approved and verified" or "Sent back with your note",
  and offers **Next decision →** pointing at the oldest remaining.
- **The existing gate is untouched.** Approving signs the grant the executor verifies; refusing goes
  through `sendBackWork`. This ticket changes where the founder stands, not what is enforced.

## Out of scope

- The trail — FB-130, which fills the section this screen leaves room for.
- The composer — FB-131. This links to it.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
npx vitest run app/actions/__tests__/approvals.test.ts    # the gate must be untouched
make design-lint && make ticket-drift
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/attention"   # expect a redirect, never 404
```

## Acceptance criteria

- [ ] Master-detail renders with the four filters and the live summary sentence.
- [ ] The selected ticket and the active filter are in the URL, and a link to one restores both.
- [ ] `/attention` redirects to the Needs-you filter; no bookmark breaks.
- [ ] The decision panel shows Reaches / Costs / Proven and "decision N of M".
- [ ] Approve signs the grant through the existing attested path — the approvals tests still pass unchanged.
- [ ] Refuse requires a note and goes through `sendBackWork`; the copy reads "Sent back with your note".
- [ ] "Next decision →" appears after a decision and points at the oldest remaining one.
- [ ] Depends-on chips are clickable and resolve, including to tickets that are filed but unmerged (FB-120).
- [ ] A founder can clear three decisions without navigating away once.
