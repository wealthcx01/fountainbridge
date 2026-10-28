# FB-271 — "Both must approve" means both

**Status:** Done · **Phase:** 3 · **Kind:** a security fix · **Raised by:** John, 28 October
2026 · One ticket = one branch = one PR.

## Why

Some decisions need two people. The approval list in each venture's manifest marks a send, a
payment, a secret, an auth change or a migration as `dual`: the venture's founder **and**
Bruntsfield must both approve it. Every live venture (ARCA, THE RESET, the modernisation engine)
uses `dual` for these.

The studio did not do that. `canApprove()` in `lib/approval-attestation.ts` let **either** the
founder **or** a Bruntsfield admin approve a `dual` item alone ("v0: either party may issue"). As
soon as that one person pressed Approve, the studio signed the grant and wrote
`approvals/<id>/grant.json`. The executor on the venture's box sends as soon as it can check that
grant. So one person, alone, could send.

The same check decided who could let a held plan go ahead (`app/actions/release-plan.ts`), so one
person could also release high-impact work that needed two.

## What changed

**A `dual` item is granted only when the founder and a Bruntsfield admin have both approved it, in
either order.**

1. **The first approval is half, not a grant.** The first of the two people to press Approve gets a
   signed record, `approvals/<id>/first-approval.json`, on the same approvals ref. It says who
   approved and which version of the request they read. No grant is written, so nothing can go out.
   They see: "Approved by you. Waiting for Bruntsfield to approve it too. Nothing goes out until
   they do." (or "Waiting for Ross, the founder, …" when Bruntsfield went first).
2. **The second approval must come from the other side.** When the other person approves the same
   version, the studio writes the grant exactly as before. The grant format and the executor are
   unchanged. The grant names the second person, and also lists the first as `first_approver`. The
   signed `approval.granted` event in the studio's record names both people, and "What happened"
   says "Ross and John approved it."
3. **The first half has its own signature.** The signed text includes the word `first-approval`,
   the same way a refusal's includes `refused` (FB-183). So a first half can never be renamed
   `grant.json` and pass as a grant. Not in the studio, and not in the executor.
4. **One person is one person.** If one email address is both the founder and an admin, it counts
   as one side, never both. That person still needs someone else from Bruntsfield. Two admins
   (neither of them the founder) are also only one side.
5. **What makes a first half void:**
   - The request changed. A different version means both people approve again, so both have read
     what actually goes out.
   - A lane wrote the file. It has no real signature.
   - The person who gave it is no longer allowed to decide.

   In each case the next approval becomes the new first half.
6. **One "no" is still enough.** Either the founder or Bruntsfield can refuse alone, and a refusal
   closes the request, as before.
7. **Founder-only and Bruntsfield-only decisions are unchanged.** One approval, one grant.
8. **Held plans follow the same rule.** On a `dual` venture, the first "Go ahead with this" writes
   a signed first half at `approvals/first-approvals/plan-<ticket>.json` on the state ref. The lane
   never reads that path. The second person, from the other side, writes the release the lane reads.
   A plan has no version number, so its first half is tied to the ticket alone.

## What a person sees

- **Approval card, after the first approval:** the tag reads "needs one more approval" (it used to
  read "approved"). The message says who still has to approve.
- **Approval card, the same person again** (after reloading the page): "You have already approved
  this. It is waiting for … to approve it too."
- **Approval card, after the second approval:** "Approved by you and <first person>. The action
  will run shortly…"
- **"What happened" on an approval, and the trail:** a `dual` grant names both people.
- **Held plan, after the first go-ahead:** "You said go ahead. Your team starts once Bruntsfield
  says go ahead too."

## What it cannot see

The studio knows email addresses, not people. One person who signs in with two different
addresses, one the founder's and one an admin's, still counts as two. On ARCA and the
modernisation engine, John holds both kinds of address, so he can complete both halves himself.
That is a fact about who those ventures' founder is, not something code can fix.

## Acceptance

- [x] The founder alone, an admin alone, or one address that is both cannot produce `grant.json`
      for a `dual` item.
- [x] Founder then admin, and admin then founder, produce a grant the studio and the executor
      both accept.
- [x] The same person twice does not produce a grant. Two admins do not either.
- [x] A first half renamed `grant.json` does not verify as a grant (studio and executor formula).
- [x] A first half a lane wrote, or one for an older version of the request, does not count.
- [x] A refusal by either side alone still closes it.
- [x] Founder-only and Bruntsfield-only decisions behave as before.
- [x] Held plans on a `dual` venture need both, in either order.
- [x] The new tests fail on the code before this change (checked by running them against it).
- [ ] Every check in `CLAUDE.md` passes.

## Follow-ups (not in this PR)

- **Show the first half on the card itself.** After a reload, the card does not yet say "Ross has
  approved; waiting for Bruntsfield". The person who still has to approve sees the normal Approve
  button. The person who approved first is told when they press it again. Reading
  `first-approval.json` into the card is a separate, screen-level change.
- **FB-270 (changing the approval secret)** must carry first halves over too. They are one more
  kind of signed record.

## Out of scope

- The executor, the ActiveGraph reader (`deploy/activegraph/foundry_graph.py`) and the grant
  format. None of them change.
