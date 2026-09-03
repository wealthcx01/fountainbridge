# FB-185 — Tickets shows every ticket the venture has ever had

**Status:** Open · **Phase:** 3 · **Found by:** the FB-175 audit, 2026-09-02

## The measurement

| | design | live desktop | live phone |
| --- | --- | --- | --- |
| Tickets | **1,090px** | **6,864px** | **8,008px** |
| a ticket | — | 6,864px | **8,859px** |

Six to eight times its design. This is now the least design-conformant screen in the studio.

## Why it matters more than it did last week

FB-178 removed the ticket board from the desk, on the grounds that Tickets is where the queue lives
and the desk should point at it. That reasoning was right and the change was right — and it makes
this screen the one a founder now uses for all of it. It should be the best list in the product and
it is the longest page in it.

## The likely cause, and the thing to check first

The design's Tickets is a **filtered** list — open work. Ours renders every ticket the venture has
ever had, finished ones included: ARCA has 73 in one surface alone, and "Done" is the largest group.

The screen already has filters (`tickets-filter-*`), and the rail's "Needs you" row already deep-links
to `?filter=needs`. So the machinery exists; what is wrong is most likely the **default**. Check that
before building anything.

The detail pane sits on the same page, which is why "a ticket" measures identically — a founder who
opens one ticket is still carrying the whole list beneath it. On a phone that is 8,859px.

## Scope

- Establish what the design's default filter is and match it. If the answer is "open work", say so in
  the ticket and change the default.
- Finished work still has to be reachable — the "Done and stopped" filter is where Claude Design put
  it (2026-09-02), so it is a filter away, not gone.
- On a phone the list and the detail should not both be full length. The design's phone treatment is
  one column at a time.
- Re-measure both viewports and put the numbers in the PR (CLAUDE.md rule 11).

## Acceptance criteria

- [ ] Tickets is under 2,000px on ARCA's production data at 1440×1000.
- [ ] Opening a ticket does not leave the founder scrolling the whole list beneath it on a phone.
- [ ] Every finished ticket is still reachable, in one press.
- [ ] The default filter is a stated decision in the code, with the reason.
