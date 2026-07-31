'use server';

/**
 * Approve an external action from the studio (FB-046) — the founder-facing end of the FB-044 gate.
 *
 * Flow (all server-side; the secret never reaches the client or the lane):
 *   1. verify the session + venture access (authz — CLAUDE.md #6),
 *   2. verify the signed-in user is the D7 approver for this department's change class,
 *   3. read the proposal, pin its blob sha, refuse if it's already granted/executed,
 *   4. sign the grant (HMAC attestation the executor verifies) and write grant.json to the
 *      `foundry-approvals` ref with a WRITE-scoped credential (never the read App, never the lane).
 * A recorded human act; the separate gated executor performs the action (never the studio, never the
 * lane). Fails graceful + explicit when approvals aren't configured.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import { APPROVALS_REF, type ApprovalProposal } from '@/lib/approvals';
import { attestationFor, approverRoleForDepartment, canApprove } from '@/lib/approval-attestation';
import { verifyGrant } from '@/lib/provenance';

export interface ApproveResult {
  ok: boolean;
  message: string;
}

export async function approveExternalAction(ventureId: string, approvalId: string): Promise<ApproveResult> {
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

  const repo = venture.repos[0];
  if (!repo) return { ok: false, message: 'This venture has no repo configured.' };

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

  // FB-051 (narrowed): no event is appended here. grant.json plus its attestation IS the record —
  // it is what the executor verifies and what the studio can later re-verify. An append-only file
  // beside it on a ref the lane can write proves nothing, and the previous version swallowed its own
  // write failure, so a founder was told "Approved" while the audit write silently did not happen.
  return { ok: true, message: 'Approved. The action will run shortly, and you\'ll see it recorded here.' };
}
