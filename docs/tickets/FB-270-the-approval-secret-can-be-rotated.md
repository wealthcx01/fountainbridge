# FB-270 — The approval secret can be changed without breaking past approvals

**Status:** Todo · **Phase:** 3 · **Kind:** medium · **Raised by:** John, 22 October 2026, after
Railway's security disclosure (cowgate CG-0042) · One ticket = one branch = one PR.

## Why

Railway cancelled every API token on 22 October 2026 and asked everyone to change the secrets
they keep there. The studio's `FOUNDRY_APPROVAL_SECRET` is one of them, but it can't be changed
safely today. Every signature the studio checks is made with that one secret and checked again
each time it is read:

- approval grants and refusals (`lib/approval-attestation.ts`);
- approval-log events (`lib/activegraph-log.ts`);
- the machine budget (`lib/machine-budget.ts`, signed in `app/actions/machine-budget.ts`);
- MCP tickets (`lib/mcp.ts`, read in `app/api/mcp/route.ts`).

The executor (`deploy/executor/executor.mjs`) and the activegraph reader
(`deploy/activegraph/foundry_graph.py`) hold the same secret and check the same signatures.

So a new secret makes every past grant show as "unattested". Old log events drop out of view,
and the machine budget in force disappears. `cowgate railway rotate` leaves this secret alone
until this ticket is done.

## What to do

Change the secret so that past approvals stay valid, without trusting the old secret afterwards.
Keeping the old secret as a second key forever would be simple but unsafe. Anyone who had the old
secret could still sign a back-dated grant that passes. So instead:

1. **A carry-over list, made once, at the change.** A command, `npm run approvals:carry-over`,
   reads every signed record the studio keeps. These are the grants, refusals, log events and the
   budget, in every venture repo the studio records to. It checks each one with the old secret.
   For each record that passes, it writes the record's hash to a carry-over list, then signs the
   whole list with the new secret. It prints counts only, never a secret.
2. **Every checker accepts two things:** a record signed with the current secret, or a record
   whose hash is on a carry-over list that is itself signed with the current secret. Nothing
   else.
   - Change the studio's checks in one place: a shared `verifyApprovalSignature()` that every
     check above calls.
   - Change the executor and the activegraph reader to match.
   - Records made after the change are signed with the new secret only.
3. **Re-sign the machine budget** with the new secret during the change. It is current state,
   not history.
4. **MCP tickets are not carried over.** They last 12 hours: people sign in again.
5. **A short runbook,** in `docs/deploy.md`, giving the order:
   - put the new secret in the studio and the executor without deploying;
   - run the carry-over;
   - deploy;
   - check that one old grant still shows as attested;
   - destroy the old secret.

   Then `cowgate railway rotate` can include this secret again (a cowgate change).

## Acceptance

- [ ] A grant signed with the old secret, carried over, shows as attested after the change.
- [ ] A grant signed with the old secret but *not* on the list (made after the list) is refused.
- [ ] A list changed by hand, or signed with the wrong secret, is refused whole.
- [ ] The executor and the activegraph reader pass the same three cases (their own tests).
- [ ] The carry-over command never prints a secret or a signature. It prints counts per kind of
      record and per venture.
- [ ] Every check in `CLAUDE.md` passes.

## Out of scope

- Changing the secret on Railway. John does that with `cowgate railway rotate`, after this
  merges and the runbook has been followed.
- Any other secret.
