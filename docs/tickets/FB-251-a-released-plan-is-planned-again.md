# FB-251 — a released plan was planned again, every five minutes, for five weeks

**Status:** Done · **Phase:** 3 · **Found by:** FB-162, counting ARCA's run reports

## What happened

ARCA's run history holds 10,213 reports. **10,036 of them are ARCA-061** ("saved card lists not
persisting"), one every five minutes since 26 August, and still going on 2 October.

ARCA-061 mentions sign-in, so the lane treats it as high-impact: it writes a plan and waits for the
founder's go before building anything (FB-122). John gave that go from the studio. Then, on every
wake, the lane:

1. saw the go, cleared the hold, and picked ARCA-061;
2. ran the high-impact check again, which still matched the word "auth" in the ticket;
3. ran a fresh Claude session of about four minutes to write the plan again;
4. parked the ticket, waiting for a go it already had.

Each plan counts against the lane's daily allowance of wakes. So every day the re-planning used up
the whole allowance — **730 planning sessions** over the five weeks — and every wake after that
picked ARCA-061 again, found the allowance spent, and wrote "Daily lane budget reached": **9,308**
of those. The founder's approval never became any work, and no other ticket could be worked at all.
Every screen showed "waiting for your go", which was false: it had been given.

## What changed

- The "plan first?" decision is one function, `plan_before_work`, in `deploy/lane/foundry-lib.sh`.
  It answers no once the founder has released the plan. The work is still gated on its pull request,
  like every other change.
- The lane remembers who released the ticket it picked, and forgets it for each new ticket, so one
  ticket's go can never carry over to another.
- The lane log says so: "high-impact, and <who> read its plan and gave the go — working it".

## Acceptance criteria

- [x] A ticket whose plan the founder released is worked, not planned again. Tested through the real
      library; putting the old behaviour back turns the test red.
- [x] A high-impact ticket nobody has released is still planned first.
- [x] One ticket's release never applies to another.

The fix reaches ARCA only once the lane files are copied to its server; that is recorded on the PR.
