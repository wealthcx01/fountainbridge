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
 *      A DUAL decision (FB-271) is different: the first of its two approvers gets a signed
 *      `first-approval.json` instead, and only the second, from the other side, gets the grant,
 *   5. record it in the ActiveGraph (FB-071): two signed events on the STUDIO's own ref, so the
 *      story of who asked and who agreed exists somewhere the proposing lane cannot author.
 * A recorded human act; the separate gated executor performs the action (never the studio, never the
 * lane). Fails graceful + explicit when approvals aren't configured.
 */

import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import { APPROVALS_REF, approvalRepos, type ApprovalProposal } from '@/lib/approvals';
import { fullRepoName } from '@/lib/venture-repos';
import {
  approverRoleForDepartment, attestationFor, canApprove, canDecide, firstApprovalAttestationFor, isDualPair,
  refusalAttestationFor, stillNeededAfter,
} from '@/lib/approval-attestation';
import { verifyFirstApproval, verifyGrant, verifyRefusal, type FirstApproval } from '@/lib/provenance';
import { appendEvent } from '@/lib/activegraph-log';
import { activeGraphGateMode, proposedEventData } from '@/lib/activegraph';

export interface ApproveResult {
  ok: boolean;
  message: string;
  /**
   * True when this click was the first of the two approvals a dual decision needs (FB-271): it was
   * recorded, and nothing goes out until the other side approves too. The card must not call that
   * "approved".
   */
  waiting?: boolean;
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

  // Read the proposal (read App) + guard against re-granting. GitHub is addressed by the FULL
  // `owner/slug` name; `repo` stays the manifest slug for events and messages (FB-094).
  const ghRepo = fullRepoName(repo);
  const reader = new GitHubClient();
  const proposalR = await reader.getFileWithSha(ghRepo, `approvals/${approvalId}/proposal.json`, APPROVALS_REF);
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

  const existingGrant = await reader.getFileContent(ghRepo, `approvals/${approvalId}/grant.json`, APPROVALS_REF);
  if (existingGrant) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(existingGrant); } catch { parsed = null; }
    const verified = verifyGrant(ghRepo, approvalId, proposalR.sha, parsed as never, secret);
    if (verified.provenance === 'attested') {
      return { ok: false, message: `This was already approved by ${verified.approver}.` };
    }
  }
  const alreadyDone = await reader.getFileContent(ghRepo, `approvals/${approvalId}/execution.json`, APPROVALS_REF);
  if (alreadyDone) return { ok: false, message: 'This approval has already been actioned — it cannot be approved again.' };

  // A refused send is closed. Without this, a send refused in one tab could be approved from an
  // older tab still showing the button — refusing does not change the proposal, so the "changed
  // since the page loaded" check above passes — and the signed grant written below is exactly what
  // the executor needs to send it. Only a refusal the studio can verify counts: an unsigned one
  // could be written by a lane, and must not be able to block the founder's real decision.
  const existingRefusal = await reader.getFileContent(ghRepo, `approvals/${approvalId}/refusal.json`, APPROVALS_REF);
  if (existingRefusal) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(existingRefusal); } catch { parsed = null; }
    const refused = verifyRefusal(ghRepo, approvalId, proposalR.sha, parsed, secret);
    if (refused) {
      return {
        ok: false,
        message: `This was refused by ${refused.refusedBy}, so it cannot be approved. Nothing was sent. If it should go after all, ask your team to propose it again.`,
      };
    }
  }

  // D7: is this user the approver for the department's change class?
  const role = approverRoleForDepartment(venture, proposal.department ?? 'general');
  if (!canDecide(email, role, venture, admins)) {
    return { ok: false, message: `This change is approved by ${role === 'dual' ? 'the founder and Bruntsfield' : role}; you are not that approver.` };
  }

  const writer = new GitHubClient({ token: writeToken });

  // FB-271: a dual decision needs the founder AND Bruntsfield. Before this, either of them alone got
  // the signed grant below, and the executor sends on that grant — so one person could send.
  let first: FirstApproval | null = null;
  if (role === 'dual') {
    const half = await halfOfDual(reader, writer, {
      ghRepo, approvalId, proposalSha: proposalR.sha, email, secret, venture, admins,
    });
    if (half.done) return half.result;
    first = half.first;
  } else if (!canApprove(email, role, venture, admins)) {
    return { ok: false, message: `This change is approved by ${role}; you are not that approver.` };
  }

  // Sign + write the grant (the executor verifies the attestation; a lane can't forge it).
  // The attestation is over the FULL name — the executor recomputes it with its REPO env, which is
  // `owner/slug`; signing over the bare slug produced grants it refused as forged (FB-094).
  //
  // For a dual decision the grant names the SECOND approver, signed exactly as any grant is, so the
  // executor and its check are unchanged. The first approver rides along as `first_approver` — not
  // covered by the grant's signature, but `first-approval.json` (which stays) and the signed
  // `approval.granted` event below both carry it under a signature.
  const attestation = attestationFor(ghRepo, approvalId, proposalR.sha, email, secret);
  const grant = {
    id: approvalId, repo: ghRepo, decision: 'granted', approver: email, proposal_sha: proposalR.sha, attestation,
    granted_at: new Date().toISOString(),
    ...(first ? { first_approver: first.approver, first_approved_at: first.approvedAt } : {}),
  };
  try {
    await writer.putFile(ghRepo, `approvals/${approvalId}/grant.json`, {
      content: JSON.stringify(grant, null, 2),
      message: `grant ${approvalId} (approved by ${first ? `${first.approver} and ` : ''}${email})`,
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
    data: proposedEventData(proposalR.sha, proposal),
  }, secret);

  const grantRecorded = recorded.ok
    ? await appendEvent(writeToken, {
        v: 1, seq: 2, venture: ventureId, repo, id: approvalId,
        type: 'approval.granted', at: grant.granted_at,
        actor: { kind: 'human', id: email },
        data: {
          proposal_sha: proposalR.sha,
          ...(first ? { first_approver: first.approver, first_approved_at: first.approvedAt } : {}),
        },
      }, secret)
    : recorded;

  if (!grantRecorded.ok) {
    // Said out loud, not swallowed. The approval itself is real — grant.json is written and the
    // executor will verify it — but the history is incomplete, and the last version of this told a
    // founder everything was fine while its audit write had quietly failed.
    console.error('[approve] activegraph append failed', { ventureId, approvalId, reason: grantRecorded.reason });
    if (activeGraphGateMode() === 'enforce') {
      // FB-171: once the executor requires ActiveGraph's agreement, a grant that never reached the
      // record does not go out. "Nothing else is affected" would be false, so it is not said.
      return {
        ok: true,
        message: 'Approved, but the studio could not write your approval to the record, and nothing goes '
          + 'out until it is there. Tell Bruntsfield that the approval record could not be written.',
      };
    }
    return {
      ok: true,
      message: 'Approved, and the action will run shortly. The studio could not write it to the history, '
        + 'so this approval will show fewer details than usual — nothing else is affected.',
    };
  }

  return {
    ok: true,
    message: first
      ? `Approved by you and ${first.approver}. The action will run shortly, and you'll see it recorded here.`
      : 'Approved. The action will run shortly, and you\'ll see it recorded here.',
  };
}

/**
 * One half of a dual decision (FB-271): the founder's, or Bruntsfield's.
 *
 * Reads the signed first approval, if there is one, and decides what this click is:
 *
 * - **The first half.** Nobody has approved this version yet. Write a signed `first-approval.json`
 *   and stop. No grant, so nothing can go out.
 * - **The same person again.** Say so, and write nothing.
 * - **The same side again** (two people at Bruntsfield, neither the founder). Say who is still
 *   needed, and write nothing.
 * - **The other side.** Return the first approval, and the caller writes the grant.
 *
 * A first approval counts only if the studio signed it, for this exact proposal, and the person who
 * gave it may still decide. A lane can write the file but cannot sign it, a changed proposal voids
 * it, and someone removed from the admin list no longer counts as half. In each of those cases this
 * click becomes the new first half and replaces the old file.
 */
async function halfOfDual(
  reader: GitHubClient,
  writer: GitHubClient,
  p: {
    ghRepo: string; approvalId: string; proposalSha: string; email: string; secret: string;
    venture: VentureSummary; admins: string[];
  },
): Promise<{ done: true; result: ApproveResult } | { done: false; first: FirstApproval }> {
  const path = `approvals/${p.approvalId}/first-approval.json`;
  const existing = await reader.getFileWithSha(p.ghRepo, path, APPROVALS_REF);
  let parsed: unknown = null;
  if (existing) {
    try { parsed = JSON.parse(existing.text); } catch { parsed = null; }
  }
  const signed = verifyFirstApproval('external-action', p.ghRepo, p.approvalId, p.proposalSha, parsed, p.secret);
  const first = signed && canDecide(signed.approver, 'dual', p.venture, p.admins) ? signed : null;
  const me = p.email.trim().toLowerCase();

  if (!first) {
    const approvedAt = new Date().toISOString();
    const record = {
      id: p.approvalId, repo: p.ghRepo, decision: 'first-approval', approver: me,
      proposal_sha: p.proposalSha, approved_at: approvedAt,
      attestation: firstApprovalAttestationFor('external-action', p.ghRepo, p.approvalId, p.proposalSha, me, approvedAt, p.secret),
      note: 'The first of two approvals. This is not a grant: nothing goes out until the other side approves too. See FB-271.',
    };
    try {
      await writer.putFile(p.ghRepo, path, {
        content: JSON.stringify(record, null, 2),
        message: `first approval ${p.approvalId} (approved by ${me})`,
        branch: APPROVALS_REF,
        // Replacing a void file needs its sha. It also means two first halves written at the same
        // moment cannot both land: GitHub refuses the second, and that person tries again and finds
        // the first.
        ...(existing ? { sha: existing.sha } : {}),
      });
    } catch (err) {
      console.error('[approve] first-approval write failed', { approvalId: p.approvalId, err });
      return { done: true, result: { ok: false, message: 'Could not record your approval on GitHub — please try again.' } };
    }
    return {
      done: true,
      result: {
        ok: true,
        waiting: true,
        message: `Approved by you. Waiting for ${stillNeededAfter(me, p.venture, p.admins)} to approve it too. Nothing goes out until they do.`,
      },
    };
  }

  if (first.approver === me) {
    return {
      done: true,
      result: {
        ok: false,
        message: `You have already approved this. It is waiting for ${stillNeededAfter(me, p.venture, p.admins)} to approve it too. Nothing goes out until they do.`,
      },
    };
  }

  if (!isDualPair(first.approver, me, p.venture, p.admins)) {
    return {
      done: true,
      result: {
        ok: false,
        message: `${first.approver} has already approved this for Bruntsfield. It now needs ${stillNeededAfter(first.approver, p.venture, p.admins)} to approve it.`,
      },
    };
  }

  return { done: false, first };
}

/**
 * Refuse an external action from the studio (FB-183).
 *
 * The founder could approve a send and could not refuse one. The only way to say no was to leave it
 * sitting in the queue for ever, which reads on every screen as a decision the founder has not got
 * round to rather than one they have made.
 *
 * Mirrors the approve path deliberately, check for check — same session, same venture access, same
 * D7 approver, same pinned proposal sha — because the two are the same decision with opposite
 * answers, and a refusal that anyone may write is a way to stop a founder's send without being the
 * founder.
 *
 * What it does NOT do is write `grant.json`. Nothing goes out on a refusal; the executor runs on a
 * verified grant and there is none. The refusal file is the record, not the mechanism.
 *
 * A note is required. A refusal with no reason gives the lane nothing to come back with — the same
 * rule `sendBackWork` has applied to pull requests since FB-064.
 */
export async function refuseExternalAction(
  ventureId: string,
  approvalId: string,
  repoParam: string | undefined,
  /** The proposal the founder was reading. Same guard as approving: refusing what changed is wrong. */
  seenProposalSha: string | undefined,
  note: string,
): Promise<ApproveResult> {
  if (!/^[A-Za-z0-9._-]+$/.test(approvalId)) return { ok: false, message: 'Invalid approval id.' };

  const reason = (note ?? '').trim();
  if (reason.length < 3) {
    return { ok: false, message: 'Say why you are refusing this, so your team knows what to change.' };
  }

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

  const allowedRepos = approvalRepos(venture);
  const repo = repoParam ?? allowedRepos[0];
  if (!repo) return { ok: false, message: 'This venture has no repo configured.' };
  if (!allowedRepos.includes(repo)) {
    return { ok: false, message: 'That approval is not in one of this venture’s repositories.' };
  }

  const ghRepo = fullRepoName(repo);
  const reader = new GitHubClient();
  const proposalR = await reader.getFileWithSha(ghRepo, `approvals/${approvalId}/proposal.json`, APPROVALS_REF);
  if (!proposalR) return { ok: false, message: 'That approval no longer exists.' };
  if (seenProposalSha && seenProposalSha !== proposalR.sha) {
    return {
      ok: false,
      message: 'This request changed after the page loaded, so it was not refused. Refresh and read it again.',
    };
  }

  let proposal: ApprovalProposal;
  try { proposal = JSON.parse(proposalR.text) as ApprovalProposal; } catch { return { ok: false, message: 'The proposal could not be read.' }; }

  // Refusing something that has already gone out would be a lie on the record. Checked in the same
  // order approving checks it, and for the stronger reason: approving twice is refused as
  // redundant, but a refusal written over a completed send would claim the founder stopped
  // something that had already left the company.
  const existingGrant = await reader.getFileContent(ghRepo, `approvals/${approvalId}/grant.json`, APPROVALS_REF);
  if (existingGrant) {
    let parsed: unknown = null;
    try { parsed = JSON.parse(existingGrant); } catch { parsed = null; }
    const verified = verifyGrant(ghRepo, approvalId, proposalR.sha, parsed as never, secret);
    if (verified.provenance === 'attested') {
      return { ok: false, message: `This was already approved by ${verified.approver}, so it cannot be refused now.` };
    }
  }
  const alreadyDone = await reader.getFileContent(ghRepo, `approvals/${approvalId}/execution.json`, APPROVALS_REF);
  if (alreadyDone) return { ok: false, message: 'This approval has already been actioned — it cannot be refused now.' };

  // Either side of a dual decision may refuse alone: one "no" is enough to stop it (FB-271).
  const role = approverRoleForDepartment(venture, proposal.department ?? 'general');
  if (!canDecide(email, role, venture, admins)) {
    return { ok: false, message: `This change is decided by ${role === 'dual' ? 'the founder and Bruntsfield' : role}; you are not that approver.` };
  }

  const refusedAt = new Date().toISOString();
  const attestation = refusalAttestationFor(ghRepo, approvalId, proposalR.sha, email, secret, refusedAt, reason);
  const refusal = {
    id: approvalId, repo: ghRepo, decision: 'refused', refused_by: email,
    proposal_sha: proposalR.sha, attestation, refused_at: refusedAt, note: reason,
  };
  const writer = new GitHubClient({ token: writeToken });
  try {
    await writer.putFile(ghRepo, `approvals/${approvalId}/refusal.json`, {
      content: JSON.stringify(refusal, null, 2),
      message: `refuse ${approvalId} (refused by ${email})`,
      branch: APPROVALS_REF,
    });
  } catch (err) {
    console.error('[refuse] refusal write failed', { ventureId, approvalId, err });
    return { ok: false, message: 'Could not record the refusal on GitHub — please try again.' };
  }

  // The record, on the studio's own ref, signed with the secret no lane holds — the same two-event
  // shape approving writes, so the history of a refused send reads like the history of an approved
  // one and neither can be authored by the party being audited.
  const recorded = await appendEvent(writeToken, {
    v: 1, seq: 1, venture: ventureId, repo, id: approvalId,
    type: 'approval.proposed', at: refusedAt,
    actor: { kind: 'agent', id: 'foundry-lane' },
    data: proposedEventData(proposalR.sha, proposal),
  }, secret);

  const refusalRecorded = recorded.ok
    ? await appendEvent(writeToken, {
        v: 1, seq: 2, venture: ventureId, repo, id: approvalId,
        type: 'approval.rejected', at: refusedAt,
        actor: { kind: 'human', id: email },
        data: { proposal_sha: proposalR.sha, note: reason },
      }, secret)
    : recorded;

  if (!refusalRecorded.ok) {
    console.error('[refuse] activegraph append failed', { ventureId, approvalId, reason: refusalRecorded.reason });
    return {
      ok: true,
      message: 'Refused, and nothing will go out. The studio could not write it to the history, so this '
        + 'decision will show fewer details than usual — nothing else is affected.',
    };
  }

  return { ok: true, message: 'Refused. Nothing goes out, and your team can see why.' };
}
