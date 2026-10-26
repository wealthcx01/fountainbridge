# PRD: Foundry Studio, the factory pilot release

**Owner:** John · **Written:** 26 October 2026, revised the same day with John's answers ·
**Design:** new screens come from the "Studios, aligned" Claude Design canvas, in the Bruntsfield
Studios design system. Existing screens follow the prototype named in `CLAUDE.md`, rule 11.

## Goal

The factory can build and check Foundry Studio. Each venture shows its factory work where the
founder already looks, and every finished piece of work gets a Review screen. FB-266 and FB-267
fold into this release. Each closes once its issues are published. Old ticket numbers are in
brackets.

## Done when

- Every journey in `harness/END-TO-END.md` passes against a test copy.
- John has clicked through staging as himself and as Ross.
- One real piece of factory work on THE RESET has been reviewed by Ross and approved by John. Its
  card showed the same state in Telegram and in the studio throughout.
- Every new or changed screen has been looked at beside its design, at 1440×1000 and 393×851.

## Where factory work shows

**There is no separate factory page.** Cards appear in the views a founder already has:

- **"Needs you":** the desk's list (`components/VentureBoard.tsx`, drawn by
  `app/venture/[id]/page.tsx`), and the Tickets screen's "Needs you" filter
  (`components/TicketsView.tsx`, `lib/tickets-view.ts`).
- **"What happened":** `app/venture/[id]/activity/page.tsx`, drawn by `components/ActivityFeed.tsx`.

A card has one of three states: **finished** (waiting for review), **stuck**, or **sent back**.
The desk's layout doesn't change. D10 is still John's decision.

**The Review screen** opens from a finished card. It has:

- a live preview link, from the pull request's Railway preview environment;
- before and after screenshots, at 1440×1000 and 393×851;
- a plain-English summary, taken from the plan's "What this does";
- feedback placed on a screenshot or on the page, which becomes "Send back with a note";
- Accept and Send back.

The nearest thing today is the work page, `components/WorkDetail.tsx`.

**There is no shared Decision component.** Nothing in `components/` has that name. Accept and Send
back are drawn three times, in `WorkDetail.tsx`, `TicketsView.tsx` and `TicketDrawer.tsx`. Each
calls `acceptWork` and `sendBackWork` and shares only the `noteDecision` helper (`lib/decided.ts`).
Approving a send has its own card, `ApprovalCard.tsx`. Step 8 makes the one shared component.

## Who may press what (settled by John, 26 October)

- **John** sees every card, with Telegram's words and costs. He has Approve and Reject on 🟡
  Needs-you cards, which are new on Telegram too, plus Try again, Split it and Stop.
- **A founder** sees only their venture's cards, in plain English: no dollar figures, no "What to
  do next" lines, no Archon links. They may press Stop, and Send back with a note, which is the Note.
  Accept is theirs too; what it means is decision 1.
- **Only John approves a merge.** Today's `CLAUDE.md` rule 2, and `acceptWork` in
  `app/actions/work.ts`, let a founder's Accept merge their venture's work. Step 1 changes both.

**What a press does.** The studio checks who pressed and records it. It never calls Archon or
GitHub. The planning box's listener (`factory-alerts listen`) collects the press as it collects a
Telegram tap. It runs the press through the same code: the button's signature, the run still
waiting at the card, then Archon's API. The result shows in both places. The first press wins.

**Isolation is enforced on the server.** Each card is stored with its venture, worked out from its
repository and the manifests' `repos`. Every read and press passes `requireVenture`, backed by the
database's row-level security (FB-170). The parts meant for John are removed on the server, never
sent to a founder's browser. A card that isn't yours gets the same answer as one that doesn't exist.

**Down or stale.** The box reports every minute. After five minutes of silence, buttons switch off
and say why. A press the box hasn't collected in 10 minutes ends with "Nothing was done." A card
answered elsewhere loses its buttons and shows what happened.

## The release, in order

Steps in different repositories merge in any order. Steps in one repository are worked one after
another, each from `main` after the last has merged. No pull request sits on another.

0. **First: "both must approve" means both** (small). `canApprove` in
   `lib/approval-attestation.ts` lets either person alone grant a "dual" item: a send, a payment, a
   secret. It goes first because it is a live gap in production's gate today, and every later step
   adds approvals on top of this code. **Proves:** one person alone can't grant a dual item.
1. **Ready for the factory** (medium):
   - `/build-id`;
   - a test copy on a given port, from the fixtures, with the test sign-in door and a throwaway
     database on the box for each run, never Supabase;
   - `harness/runtime.inputs.json`;
   - `CLAUDE.md` brought up to date: it still says "Phase 0", that the app "does not exist yet",
     and that Chromium can't run on the box;
   - the README's Vercel corrected to Railway;
   - rule 2 rewritten, and `acceptWork` merging for John only;
   - checks on staging: it deploys `main`, and Google sign-in works at its own address.

   Railway reports pull request environments as on for this project, but FB-230 says none were ever
   made. This step finds out which is true. In cowgate: fountainbridge's budgets and its
   `main`-watch. **Proves:** journeys 1 and 2.

**While the design is made** (underneath only, no screen work):

2. **Every Telegram message becomes a card** (cowgate, medium). Founder-safe parts are marked. (The
   new factory's runs already send Telegram cards: cowgate CG-0056.)
3. **Approve and Reject on Telegram's Needs-you cards,** for John only [FB-267] (cowgate, medium).
   A test proves an Approve grants nothing external.
4. **Screenshots** (cowgate, medium). When a pull request's preview is up, the box takes before and
   after pictures at both sizes, and sends them with the card.
5. **The listener's second inbox** (cowgate, medium).
6. **The door and the card store** (medium). Cards, heartbeats, screenshots and preview links,
   stored by venture. Preview links are checked by `lib/preview-check.ts`.
7. **Presses, on the server** (medium). Checked and recorded. A founder's other presses are
   refused.

**Design, in parallel:** John's Claude drafts the Review screen and the three card states in
"Studios, aligned". The steps below are built only against it.

8. **One Decision component** (small), from the three copies.
9. **Cards in "Needs you" and "What happened"** [FB-266] (medium). **Proves:** journey 3.
10. **The Review screen** (medium). **Proves:** journeys 4 and 5.
11. **Down and stale** (small). **Proves:** journey 7. Journey 6 grows with steps 6, 7, 9 and 10.
12. **The demo on THE RESET.** It needs:
    - **THE RESET unparked.** FB-010 parks it "until ARCA runs cleanly on the new setup".
    - **A repository.** The manifest names `thereset-platform` and `thereset-marketing`. Neither
      exists on GitHub today. It needs its checks, the factory installed, a budget, its
      `main`-watch, and both GitHub Apps.
    - **Its app on Railway,** connected to GitHub, with preview environments on for pull requests
      opened by bots. Those were FB-230's two traps on ARCA.
    - **Its manifest** moved from `draft` to `active`.
    - **Ross's sign-in on staging,** and one small first issue.

## Rules every issue keeps

- **Isolation is on the server,** with a test that tries to cross and fails.
- **One path for every press:** the box's listener.
- **No screen before its design.** The desk's layout doesn't change.
- **Nothing private in this public repository.** Screenshots of a venture live in the studio's
  database, never in git.

## Decisions for John

1. **Decision for John: what a founder's Accept and Send back mean.** My proposal is below.
   - **Accept** records the founder's sign-off in the signed record. The card then says "Signed off
     by Ross, waiting for John", and Telegram says so too. John's Approve still merges.
   - **Send back** goes to the box as the Note. John sees it on Telegram and in the studio, and
     passes it on with Reject or Try again.
2. **Decision for John: how THE RESET starts for the demo.** One option is FB-010's full start:
   old tickets decided first, and a week of Ross's use. The other is a smaller setup, just for the
   demo. A second question: does Ross click through himself?
3. **Decision for John: staging's database.** Staging has no `DATABASE_URL`, and the cards need
   one. Where should it live?

## Not in this release

- A new desk (D10).
- Moving ARCA's work [FB-264, FB-268], and the machines handover [FB-269].
- Decision times, a way out for old decisions, and speed work [FB-159, FB-265, FB-164].
- Cards as phone notifications.
