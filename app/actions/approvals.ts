'use server';

/**
 * Approve an external action from the studio (FB-046) — the founder-facing end of the FB-044 gate.
 *
 * Flow (all server-side; the secret never reaches the client or the lane):
 *   1. verify the session + venture access (authz — CLAUDE.md #6),
 *   2. verify the signed-in user is the D7 approver for this department's change class,
 *   3. read the proposal, pin its blob sha, refuse if it's already granted/executed,
 *   4. sign the grant (HMAC attestation the executor verifies) and write grant.json to the
 *      `foundry-approvals` ref with a WRITE-scoped credential (never the read App, never the lane),
 *   5. record it in the ActiveGraph (FB-071): two signed events on the STUDIO's own ref, so the
 *      story of who asked and who agreed exists somewhere the proposing lane cannot author.
 * A recorded human act; the separate gated executor performs the action (never the studio, never the
 * lane). Fails graceful + explicit when approvals aren't configured.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import { APPROVALS_REF, approvalRepos, type ApprovalProposal } from '@/lib/approvals';
import { attestationFor, approverRoleForDepartment, canApprove } from '@/lib/approval-attestation';
import { verifyGrant } from '@/lib/provenance';
import { appendEvent } from '@/lib/activegraph-log';

export interface ApproveResult {
  ok: boolean;
  message: string;
}

export async function approveExternalAction(
  ventureId: string,
  approvalId: string,
  /**
   * Which repo the approval lives in (FB-045). Since departments got their own repos, an approval id
   * is only unique WITHIN a repo — a Sell proposal lives in the marketing repo, and approving it
   * against the product repo would look up the wrong file, or the wrong approval of the same name.
   *
   * Client-supplied, so it is checked against the venture's own declared repos below and never used
   * as given. Optional so the previous single-repo call still works.
   */
  repoParam?: string,
  /**
   * The sha of the proposal the founder was LOOKING AT when they clicked (FB-058).
   *
   * Without it the action re-read whatever was current and signed that, so a proposal swapped
   * between render and click was approved unexamined. Verification caught it afterwards — the pinned
   * sha stops matching and the card says so — but "we will notice later" is not the same as "it
   * cannot happen", and this is the one control in the product that causes something irreversible.
   *
   * Optional, because a card rendered before this shipped has no sha to send. When it is absent the
   * old behaviour stands and nothing breaks; when it is present it must match.
   */
  seenProposalSha?: string,
): Promise<ApproveResult> {
  if (!/^[A-Za-z0-9._-]+$/.test(approvalId)) return { ok: false, message: 'Invalid approval id.' };

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, message: 'You need to sign in.' };

  const admins = parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS);
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, admins);
  const venture = ventures.find((v) => v.id === ventureId);
  if (!venture || !canAccessVenture(access, ventureId)) {
    return { ok: false, message: 'You do not have access to this venture.' };
  }

  const secret = process.env.FOUNDRY_APPROVAL_SECRET;
  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!secret || !writeToken) {
    return { ok: false, message: 'Approvals are not set up on the studio yet (missing signing secret or write token).' };
  }

  // The repo must be one this venture actually declares. Taking the client's word would let a signed
  // grant be issued for a repo outside the venture — and while the attestation binds the repo (so the
  // executor would still be verifying the right thing), the studio would have written a founder's
  // approval into a repository nobody scoped them to.
  const allowedRepos = approvalRepos(venture);
  const repo = repoParam ?? allowedRepos[0];
  if (!repo) return { ok: false, message: 'This venture has no repo configured.' };
  if (!allowedRepos.includes(repo)) {
    return { ok: false, message: 'That approval is not in one of this venture’s repositories.' };
  }

  // Read the proposal (read App) + guard against re-granting.
  const reader = new GitHubClient();
  const proposalR = await reader.getFileWithSha(repo, `approvals/${approvalId}/proposal.json`, APPROVALS_REF);
  if (!proposalR) return { ok: false, message: 'That approval no longer exists.' };
  // VERIFY the existing grant rather than testing for the file. A lane can write grant.json, so
  // presence alone proved nothing — and refusing on presence dead-ended the founder: the card said
  // "the studio cannot verify this, treat it as unapproved", offered the only remedy, and the click
  // answered "this has already been approved". An UNATTESTED grant is not an approval, so the real
  // approver's signed grant may overwrite it; that is the only in-band repair, and it is safe because
  // only the studio can produce the replacement.
  // The proposal must be the one the founder read. A blob sha is content-addressed, so this is an
  // exact-content check, not a timestamp comparison: same bytes, same sha, whatever else moved.
  if (seenProposalSha && seenProposalSha !== proposalR.sha) {
    return {
      ok: false,
      message: 'This request changed after the page loaded, so it was not approved. Refresh and read it again before approving.',
    };
  }

  let proposal: ApprovalProposal;
  try { proposal = JSON.parse(proposalR.text) as ApprovalProposal; } catch { return { ok: false, message: 'The proposal could not be read.' }; }

  const existingGrant = await reader.getFileContent(repo, `approvals/${approvalId}/grant.json`, APPROVALS_REF);
  if (existingGrant) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(existingGrant); } catch { parsed = null; }
    const verified = verifyGrant(repo, approvalId, proposalR.sha, parsed as never, secret);
    if (verified.provenance === 'attested') {
      return { ok: false, message: `This was already approved by ${verified.approver}.` };
    }
  }
  const alreadyDone = await reader.getFileContent(repo, `approvals/${approvalId}/execution.json`, APPROVALS_REF);
  if (alreadyDone) return { ok: false, message: 'This approval has already been actioned — it cannot be approved again.' };

  // D7: is this user the approver for the department's change class?
  const role = approverRoleForDepartment(venture, proposal.department ?? 'general');
  if (!canApprove(email, role, venture, admins)) {
    return { ok: false, message: `This change is approved by ${role === 'dual' ? 'the founder and Bruntsfield' : role}; you are not that approver.` };
  }

  // Sign + write the grant (the executor verifies the attestation; a lane can't forge it).
  const attestation = attestationFor(repo, approvalId, proposalR.sha, email, secret);
  const grant = { id: approvalId, repo, decision: 'granted', approver: email, proposal_sha: proposalR.sha, attestation, granted_at: new Date().toISOString() };
  const writer = new GitHubClient({ token: writeToken });
  try {
    await writer.putFile(repo, `approvals/${approvalId}/grant.json`, {
      content: JSON.stringify(grant, null, 2),
      message: `grant ${approvalId} (approved by ${email})`,
      branch: APPROVALS_REF,
    });
  } catch (err) {
    // Surface the cause server-side: a 403 from a mis-scoped write token and a transient 502 are
    // indistinguishable to an operator otherwise (CLAUDE.md #10).
    console.error('[approve] grant write failed', { ventureId, approvalId, err });
    return { ok: false, message: 'Could not record the approval on GitHub — please try again.' };
  }

  // FB-071: the record. Two events, both signed with the same secret the executor verifies and no
  // lane holds, on a ref in the STUDIO's repository rather than the venture's — the ref a lane could
  // write was exactly what made FB-051's version prove nothing.
  //
  // The proposed event is written HERE rather than by the lane, because a lane cannot sign. It is
  // not a fabrication: it records what the studio itself just read and verified — this proposal, at
  // this exact blob sha, written by this lane — which is a true statement the studio can attest to.
  // The proposal carries no author or time of its own — it is a file a lane wrote — so the studio
  // attributes it to the lane and stamps it with the moment it verified it. The blob sha in `data`
  // is what actually pins WHICH proposal this is, and that is content-addressed.
  const proposer = 'foundry-lane';
  const recorded = await appendEvent(writeToken, {
    v: 1, seq: 1, venture: ventureId, repo, id: approvalId,
    type: 'approval.proposed', at: grant.granted_at,
    actor: { kind: 'agent', id: proposer },
    data: { proposal_sha: proposalR.sha, ...(proposal.summary ? { summary: proposal.summary } : {}) },
  }, secret);

  const grantRecorded = recorded.ok
    ? await appendEvent(writeToken, {
        v: 1, seq: 2, venture: ventureId, repo, id: approvalId,
        type: 'approval.granted', at: grant.granted_at,
        actor: { kind: 'human', id: email },
        data: { proposal_sha: proposalR.sha },
      }, secret)
    : recorded;

  if (!grantRecorded.ok) {
    // Said out loud, not swallowed. The approval itself is real — grant.json is written and the
    // executor will verify it — but the history is incomplete, and the last version of this told a
    // founder everything was fine while its audit write had quietly failed.
    console.error('[approve] activegraph append failed', { ventureId, approvalId, reason: grantRecorded.reason });
    return {
      ok: true,
      message: 'Approved, and the action will run shortly. The studio could not write it to the history, '
        + 'so this approval will show fewer details than usual — nothing else is affected.',
    };
  }

  return { ok: true, message: 'Approved. The action will run shortly, and you\'ll see it recorded here.' };
}
