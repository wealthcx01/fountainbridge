# FB-100 — Words a founder should never meet

**Status:** Done · **Phase:** 3 · **Found by:** the founder walkthrough, 2026-08-03 — every item
below was seen through `arca.founder@`'s eyes on a production build · **Repo:** fountainbridge ·
**Branch:** `fb-100-words-a-founder-should-never-meet` · One ticket = one branch = one PR.

## Why one ticket

Each item here is five minutes of work; none deserves a branch of its own; together they are the
difference between a product that sounds finished and one that sounds like its own build system.
This is the FB-063/FB-024 discipline applied to what the walkthrough actually met. One pass, one
review, with each fix listed so nothing is silently dropped.

## The list, in walk order

1. **The sign-in page disowns its own second door.** The subtitle still reads *"Foundry Studio is
   invite-scoped. Sign in with your venture Google account."* — directly above the email-and-
   password form FB-092 added. A founder holding an email login is told, by the page offering it,
   that Google is the way in. One sentence covering both doors.
2. **"🤖 Generated with [Claude Code](https://claude.com/claude-code)" inside the founder's review.**
   The work page's "what the team says about it" quotes the lane's PR body, machinery footer and
   all — and in the expanded record it renders as raw markdown, brackets, URL and robot emoji
   included. Strip the footer server-side when presenting a PR body to a founder (FB-060 will stop
   it being written eventually; the presenter should not wait).
3. **The expanded record shows raw markdown.** In "THE DESCRIPTION OF THE WORK", `**Status:**` and
   `##` render as literal asterisks and hashes while the summary above it renders properly. One
   renderer for both, or plain-prose the record deliberately — either, consistently.
4. **"8 non-ticket files skipped."** The lane header's parser aside (`arca · 42 tickets · 8
   non-ticket files skipped`) is a debugging note. Founders need "42 tickets"; the skip count
   belongs in the admin/warnings surface where the parser already reports specifics.
5. **The same alarm fifteen times.** Every attention-queue card carries the identical mono badge
   *"THIS WORK HAS NO AUTOMATIC CHECKS"*. True of the whole repository (ARCA-34 exists to fix it),
   so say it once for the repository — a single line above the list — and keep the per-card badge
   for the day items *differ*. FB-068 already decided this class of question: one alarm.
6. **"waiting 3 days" with no verb owner.** Queue cards read `ARCA · waiting 3 days · Read it and
   decide`. Waiting on whom? The sentence that works is the one FB-064's page already uses —
   "Waiting 3 days for you."
7. **The board's founder line names the wrong person for the walkthrough account.** "Founder: John
   Gallagher" while signed in AS the founder is narratively odd ("you are John Gallagher"?). Small:
   when the signed-in user IS the named founder, say "Founder: you". (Manifest data is correct;
   this is presentation.)

## Explicitly NOT here

- Queue title translation (FB-099 owns matching PRs to ticket names; FB-076 owns the vocabulary).
- Activity feed vocabulary (FB-096).
- Any behaviour change beyond presentation.

## Acceptance criteria

- [x] Each numbered item fixed, or explicitly recorded here as rejected with a reason.
- [x] No founder-visible surface renders the Claude Code footer, raw markdown control characters,
      parser internals, or a repeated identical badge.
- [x] The e2e screenshots (the PR UI-gate gallery) show the corrected copy.

## What happened to each item

1. **The sign-in page disowned its own second door.** Fixed — and the sentence now follows the doors
   that are actually open, rather than being written once for whichever configuration was live the
   day it was typed.
2. **The Claude Code footer inside the founder's review.** Already fixed, by **FB-107**:
   `stripMachinery` takes the tool's signature off the summary and the record together, so the two
   cannot disagree about what the team wrote.
3. **The expanded record showed raw markdown.** Fixed by taking the ticket's second option — *one
   renderer for both*. It was a `<pre>`, so `**Status:**` and `##` reached the founder as literal
   characters while the summary directly above rendered properly: one document, two renderers.
4. **"8 non-ticket files skipped".** Already fixed, by **FB-103** — off the founder's header. Giving
   the count an admin home was this ticket's half and remains unbuilt; it is a debugging note whose
   only reader is the person reading the parser's warnings, and it is not worth a surface of its own
   until someone wants it. **Recorded as deliberately not built** rather than silently dropped.
5. **The same alarm fifteen times.** Fixed. When every item in the queue shares one check state it is
   said once above the list and the per-card badge disappears; the moment items DIFFER the badges
   come back, which is when they carry information. A single-item queue keeps its badge — "the same
   for everything below" over one card is a sentence about nothing.
6. **"waiting 3 days" with no verb owner.** Fixed — "waiting 3 days for you", the sentence FB-064's
   page already used.
7. **The board named the wrong person to the founder.** Fixed: when the signed-in account IS the
   venture's named founder, the line reads "Founder: you". The manifest was always right; this was
   presentation.
