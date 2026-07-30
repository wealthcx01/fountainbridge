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
import { nextEvent, type ActorKind, type ApprovalEvent } from '@/lib/activegraph';
import type { VentureSummary } from '@/lib/ventures';

export interface ApproveResult {
  ok: boolean;
  message: string;
}

/**
 * Whether this approver acts as the founder or as Bruntsfield. Both are human and both may grant;
 * the distinction is what a D7 audit asks for — which side signed off.
 */
function approverActorKind(email: string, venture: VentureSummary, admins: string[]): ActorKind {
  const isFounder = venture.founderEmail?.toLowerCase() === email.toLowerCase();
  if (isFounder) return 'founder';
  return admins.some((a) => a.toLowerCase() === email.toLowerCase()) ? 'bruntsfield' : 'founder';
}

/** The existing event log, so the appended event continues the chain rather than restarting it. */
async function sourceEvents(reader: GitHubClient, repo: string, approvalId: string): Promise<ApprovalEvent[]> {
  const entries = await reader.listDir(repo, `approvals/${approvalId}/events`, APPROVALS_REF).catch(() => []);
  const out: ApprovalEvent[] = [];
  for (const entry of entries) {
    if (entry.type !== 'file' || !entry.name.endsWith('.json')) continue;
    const file = await reader.getFileContent(repo, `approvals/${approvalId}/events/${entry.name}`, APPROVALS_REF);
    if (!file) continue;
    try {
      const parsed = JSON.parse(file) as ApprovalEvent;
      if (typeof parsed.seq === 'number') out.push(parsed);
    } catch {
      // A malformed event file must not stop a founder approving. project() reports the gap.
    }
  }
  return out;
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
  const alreadyGranted = await reader.getFileContent(repo, `approvals/${approvalId}/grant.json`, APPROVALS_REF);
  if (alreadyGranted) return { ok: false, message: 'This has already been approved.' };
  const alreadyDone = await reader.getFileContent(repo, `approvals/${approvalId}/execution.json`, APPROVALS_REF);
  if (alreadyDone) return { ok: false, message: 'This approval has already been actioned.' };

  let proposal: ApprovalProposal;
  try { proposal = JSON.parse(proposalR.text) as ApprovalProposal; } catch { return { ok: false, message: 'The proposal could not be read.' }; }

  // D7: is this user the approver for the department's change class?
  const role = approverRoleForDepartment(venture, proposal.department ?? 'general');
  if (!canApprove(email, role, venture, admins)) {
    return { ok: false, message: `This change is approved by ${role === 'dual' ? 'the founder and Bruntsfield' : role}; you are not that approver.` };
  }

  // Sign + write the grant (the executor verifies the attestation; a lane can't forge it).
  const attestation = attestationFor(approvalId, proposalR.sha, email, secret);
  const grant = { id: approvalId, decision: 'granted', approver: email, proposal_sha: proposalR.sha, attestation, granted_at: new Date().toISOString() };
  const writer = new GitHubClient({ token: writeToken });
  try {
    await writer.putFile(repo, `approvals/${approvalId}/grant.json`, {
      content: JSON.stringify(grant, null, 2),
      message: `grant ${approvalId} (approved by ${email})`,
      branch: APPROVALS_REF,
    });
  } catch {
    return { ok: false, message: 'Could not record the approval on GitHub — please try again.' };
  }

  // FB-051: append the `approval.granted` event — the audit record proper. Written AFTER grant.json
  // and deliberately not fatal if it fails.
  //
  // The ordering is the safety-critical part. grant.json is what the deployed executor verifies, so
  // it must land first: an event written before a failed grant write would claim an approval that
  // can never execute. The reverse — a grant with a missing event — is a gap the bridge fills from
  // the file, with the HMAC attestation still binding the approver. So a failure here costs record
  // fidelity, never correctness, and the founder is not told their approval failed when it did not.
  try {
    const events = await sourceEvents(reader, repo, approvalId);
    const event = nextEvent(events, {
      type: 'approval.granted',
      at: grant.granted_at,
      // The one actor kind that may grant. This is the same claim the attestation binds, now stated
      // in the log itself so a replay can see WHO, not just THAT.
      actor: { kind: approverActorKind(email, venture, admins), id: email },
      data: { proposal_sha: proposalR.sha, attestation },
    });
    await writer.putFile(repo, `approvals/${approvalId}/events/${String(event.seq).padStart(4, '0')}-granted.json`, {
      content: JSON.stringify(event, null, 2),
      message: `event ${approvalId}#${event.seq} approval.granted (${email})`,
      branch: APPROVALS_REF,
    });
  } catch {
    // Intentionally swallowed — see above. The grant stands.
  }

  return { ok: true, message: 'Approved. The action will run shortly, and you\'ll see it recorded here.' };
}
