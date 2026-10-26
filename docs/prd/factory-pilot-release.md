# PRD: Foundry Studio, the factory pilot release

**Owner:** John · **Written:** 26 October 2026 · **Design:** the Claude Design prototype named in
`CLAUDE.md`, rule 11

## Goal

The factory can build and check Foundry Studio. The studio gains a factory page: the same cards and
buttons John gets on Telegram, where each founder sees only their own venture's. FB-266 and FB-267
fold into this release, with the studio as the factory's client. Each closes once its issues are
published. Old ticket numbers are in brackets.

## Done when

- Every journey in `harness/END-TO-END.md` passes against a test copy of the release.
- John has clicked through production as himself, and as `arca.founder@bruntsfield.capital`.
- One real run's card has shown in Telegram and on the page, with the same words. A press in one
  place has shown as done in the other.
- Every changed screen has been looked at beside its design, at 1440×1000 and 393×851, with its
  height recorded.

## The factory page

**What it shows.** Exactly what Telegram shows, from the same data. Today that is:

- 🟡 Needs you;
- ✅ Done, with its pull request;
- 🔴 Failed, with its "What to do next" line;
- the stuck card;
- the 💷 and 🛑 spend lines;
- the alert for work that reached `main` without John's Approve.

Each card gives its cost against its issue's budget. The page gives the running total, and says
that these dollars measure work, not a bill. The emoji stays. The colour is the studio's matching
tone: ok, attention or blocked.

**The buttons.** The same ones as Telegram: Try again (with an optional note), Split it and Stop.
Today only the stuck card has buttons. Telegram has no Approve or Reject button.

**What a press does.** It goes through the same path as a Telegram tap, so the two can't disagree:

1. The studio's server checks who pressed and records the press. It never calls Archon or GitHub
   itself. Archon's API is reachable only on the planning box's private network.
2. The box's listener, `factory-alerts listen`, collects the press, as it collects Telegram taps.
3. It runs the press through the same code as a tap: the button's signature, the run still waiting
   at the card, then Archon's API.
4. The result goes to both places. The first press wins. A second press gets Telegram's own words:
   "This card is out of date … Nothing was done."

**Who may press what.** John sees and presses everything, across all ventures and Bruntsfield's
own repositories. A founder sees only their venture's cards. What a founder may press is
Decisions 1 and 2. "Open the run in Archon" is for John only, because founders can't reach the
private network.

**How "only their own venture" is enforced.** On the server, at four points:

- **Storing.** Each card is stored with its venture, worked out from its repository and the
  manifests' `repos`. Cards on Bruntsfield's own repositories carry no venture, and only John reads
  them.
- **Reading and pressing.** Every read and every press, whether from a page, a server action or an
  API call, passes `requireVenture` (`lib/venture-access.ts`). The database's row-level security
  (FB-170) backs it up.
- **The button's signature.** It stays on the server. A browser never holds it.
- **The box.** It checks again that the presser may act on that card's repository.

A card that isn't yours gets the same answer as a card that doesn't exist. Journey 6 proves it.

**When the factory is down, or a card is stale.** The box reports every minute. After five minutes
of silence, the page says when it last heard from the box, and switches the buttons off with the
reason shown. A press the box hasn't collected within 10 minutes ends with "Nothing was done." A
card answered elsewhere, or for a run that moved on, loses its buttons and shows what happened, as
the Telegram card does. If the studio is down, Telegram works as before, and cards wait on the box
until the studio is back.

## The release, in order

1. **Ready for the factory** (small):
   - `/build-id` answers with `FACTORY_RUNTIME_CANDIDATE` when it is set, and the Git commit
     otherwise.
   - The test copy runs on a given port, from the fixtures, with the test sign-in door.
   - In the test copy, each decision and press is also written to a file in its state folder.
   - `harness/runtime.inputs.json` holds the start command, `/api/health` and the fixture folders.

   In cowgate at the same time: fountainbridge's issue budgets go in `archon/factory-budgets.json`,
   and `factory-main-watch` watches fountainbridge's `main`. **Proves:** journeys 1 to 3.
2. **Every Telegram message becomes a card** (cowgate, medium). Needs you, Done, Failed, the spend
   lines and the main-watch alert are written as `factory-card/1` data, as the stuck card already
   is. Telegram draws them from that data, and a test proves its text is unchanged. `factory-alerts`
   also reads the new factory's runs, not only Archon 0.11.1's. **Proves:** one source of words.
3. **The door between the box and the studio** (medium). It is a signed endpoint, like
   `/api/machines`, used only by the box: it takes cards and the heartbeat, and hands out presses.
   Cards are stored by venture. **Proves:** isolation against real Postgres (PGlite), as the read
   model does.
4. **John's factory page** [FB-266] (medium). All cards, read only. **Proves:** journey 4 for John.
5. **The founder's factory page** [FB-266] (medium). `/venture/<id>/factory`, plus "Your team is
   working on ARCA-077" on the desk and in "What happened". **Proves:** journeys 4 and 6.
6. **The buttons, studio side** (medium). Checked, recorded, then "Sent to the factory". They show
   only when the box says it collects presses, so steps 6 and 7 merge in any order. **Proves:**
   journey 5, with the stand-in.
7. **The buttons, box side** (cowgate, medium). The listener's second inbox, as described above.
   **Proves:** a press in one place shows in the other.
8. **Down and stale** (small). **Proves:** journey 7.
9. **Approve and Reject on the Needs-you card** [FB-267] (medium; cowgate, then the studio). This
   step happens only if John says yes to Decision 3. Approving approves work in a branch only, and a
   test proves it grants no external action.
10. **The demo.** One real factory run on a venture repository, then John's click-through.

## Rules every issue keeps

- **Isolation is on the server,** with a test that tries to cross and fails.
- **One path for every press:** the box's listener. The studio never acts on a run itself.
- **The studio never rewords a card.**
- **Nothing private goes in this public repository.** Fixtures are invented.
- **Every changed screen is looked at beside its design,** at both sizes.

## Decisions for John

1. **Decision for John:** may a founder approve a merge of their own venture's work? The factory's
   rule (23 October) is that nothing merges without John's tap. This repository's `CLAUDE.md`,
   rule 2, lets a founder's approval in the studio merge their venture's work. `factory-main-watch`
   can't tell who pressed Approve. My recommendation: John only, for the pilot.
2. **Decision for John:** which buttons may a founder press? My recommendation: Stop, and a note.
   Try again and Split it spend from the issue's budget, so they stay John's.
3. **Decision for John:** should the Needs-you card get Approve and Reject buttons? If yes, Telegram
   and the page get them together.
4. **Decision for John:** what do founders see of each card? Two parts are in question: the dollar
   figures, and the lines written for John, such as "Tell the lane". The studio's own budgets are in
   pounds, per department, per month.
5. **Decision for John:** which venture does the factory work for the demo? ARCA's lane is paused
   (FB-264), and the queue never ranks ARCA. Without a run, a founder's page is empty.
6. **Decision for John:** staging, or the demo on production? The studio has only production, and
   Railway makes no pull request environments for it (FB-230).
7. **Decision for John:** a Claude Design screen first? The prototype has no factory page, and rule
   11 needs one to compare against. That screen would also name the page for founders.
8. **Open question:** can the runtime host give each run a fresh Postgres? If not, the test copy
   keeps cards in a file, and CI's PGlite tests prove the database's isolation.

## Not in this release

- Moving ARCA's work to the factory [FB-264, FB-268].
- The machines handover [FB-269].
- Decision times, a way out for old decisions, and speed work [FB-159, FB-265, FB-164].
- THE RESET's start [FB-010].
- Factory cards as phone notifications.
- Editing a plan from the studio.
