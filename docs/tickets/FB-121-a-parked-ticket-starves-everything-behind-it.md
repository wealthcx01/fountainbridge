# FB-121 — One ticket waiting on the founder stops the lane working anything else

**Status:** Todo · **Area:** Lane / supervisor · **Depends on:** —

## What is happening right now

ARCA's lane is healthy, awake every five minutes, and has done nothing for five days. Its last commit
was 21 August. There are ten Todo tickets it has never looked at.

Every wake, for 864 wakes:

```
[lane] skip ARCA-047-sign-in-tagline-fix — gave up after 3 attempts (surfaced)
[lane] skip ARCA-048-real-history-honest-gaps — gave up after 3 attempts (surfaced)
[lane] ARCA-054-settings-pricing-keys-route-shadowed already surfaced for founder go — skipping
```

and then exits.

## Why

`scan_department` (`deploy/lane/run-once.sh:163`) walks `docs/tickets/*.md` and takes the FIRST
workable ticket as `PICK`, then breaks. ARCA-047 and ARCA-048 are correctly skipped inside the scan —
the attempt limit is a `continue`, so the scan carries on. ARCA-054 is Todo, has no branch, and is
under the attempt limit, so it is picked and the scan stops.

Then, much later and outside the scan, ARCA-054 is classified sensitive, a plan has already been
surfaced for the founder, and line 261 runs:

```sh
if [ -f "$STATE_DIR/awaiting-$PICK_SLUG" ]; then
  flog "$PICK_SLUG already surfaced for founder go — skipping"; exit 0
fi
```

`exit 0` ends the entire wake. Not "skip this ticket and take the next one" — skip the ticket and go
back to sleep. So a ticket parked on the founder becomes a permanent stop for everything alphabetically
behind it.

The two behaviours are inconsistent in a way that is invisible from either place. Inside the scan,
"can't work this one" means `continue`. Outside it, the same conclusion means `exit`. Both read
correctly on their own line.

## What it costs

- **Ten tickets never attempted**: ARCA-055, 057, 058, 059, 060, 061, 062, 063, 064, 067. Several are
  bugs a founder reported (mobile nav hides most tabs; saved lists not persisting; prices always show
  zero synced).
- **It is silent.** The lane writes an idle-ish heartbeat and the studio shows a lane that is running.
  Nothing anywhere says "I am not working ten tickets because one is waiting on you." That is a
  CLAUDE.md #10 failure — a founder blocked at 22:00 cannot see why.
- **It gets worse as the backlog grows.** The starving ticket only needs to sort early. ARCA-054
  blocks 067; a parked ARCA-005 would block everything.
- **It punishes the founder for the gate working.** Sensitive tickets stopping for approval is correct
  and deliberate. Turning that into a queue-wide halt makes the safety feature the reason nothing
  ships.

## Scope

- A parked ticket must be skipped like any other unworkable ticket: the scan continues to the next
  candidate, in the same department and then the next, rather than ending the wake.
- Move the decision to where the other skips live. The reason the parked check sits after the scan is
  that classification needs the ticket's text and the department's gate — so the scan must be able to
  ask "is this parked?" before it commits to a pick, rather than discovering it afterwards.
- Say it out loud. An idle wake that is idle *because* work is waiting on the founder is not the same
  as an idle wake with an empty queue, and the run report must distinguish them so the studio can.
- Cover it: a queue where the first workable ticket is parked and a later one is not must work the
  later one; a queue where every workable ticket is parked must report idle-awaiting-founder, not
  idle-nothing-to-do.

## Out of scope

- Changing what makes a ticket sensitive, or the attempt limit. Both are working as intended — this is
  only about what the lane does next after deciding it cannot work a given ticket.
- Un-parking ARCA-054, which is a real decision for the founder and not something to route around.
- The three-attempt give-up on ARCA-047 and ARCA-048. They are surfaced and skipped correctly; why
  they failed three times is separate work.

## Acceptance criteria

- [ ] With the first workable ticket parked awaiting the founder, the lane works the next unparked
      ticket in the same wake.
- [ ] With every workable ticket parked, the lane reports idle *and says the queue is waiting on the
      founder*, naming how many tickets are held.
- [ ] A parked ticket is never worked twice and never loses its parked state.
- [ ] The skip decisions live in one place, so "cannot work this" cannot mean `continue` in one branch
      and `exit` in another.
- [ ] Proved on the ARCA box: after the fix, a wake picks up one of the ten currently-starved tickets.
