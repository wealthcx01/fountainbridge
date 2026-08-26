'use server';

/**
 * Release a plan the lane stopped to show the founder (FB-122).
 *
 * ## What this is
 *
 * When a ticket looks high-impact — auth, payments, migrations, secrets, credentials, external sends
 * — the lane refuses to touch it. It writes a plain-English plan of what it *would* do, surfaces it,
 * marks the ticket held, and stops. Correct and deliberate.
 *
 * Nothing could ever release it. The hold marker was written by the lane and no code anywhere deleted
 * it, so a plan the lane paused to show someone could not be approved by anyone, from anywhere.
 * ARCA-054 went in on 19 August, was still there a week later, and was eventually done by hand.
 *
 * ## What this gate is, and is not
 *
 * **A cost-and-attention gate, not a security boundary.** It exists so the lane does not spend model
 * time and open a pull request on high-blast-radius work before a person has read what it intends to
 * do. The security gates are elsewhere and unaffected: engineering change is gated on the pull
 * request, and anything leaving the building is gated on a signed ActiveGraph approval the lane holds
 * no secret for (`lib/activegraph.ts`, CLAUDE.md #4).
 *
 * That is what makes the design below acceptable rather than a repeat of FB-051. The release marker
 * lands on the venture's own `foundry-state` ref, which the lane can write — so **the lane could
 * forge its own release**. There is no arrangement that fixes that while the lane is both the thing
 * being gated and the thing reading the gate, and pretending otherwise is precisely the failure
 * FB-051 was withdrawn for. So the marker is unsigned and the lane trusts it, while the record of
 * *who actually released it* is appended to the studio's ActiveGraph, on the studio's own repository,
 * signed with a secret no venture box holds.
 *
 * A lane can therefore start work it was told to pause on. It still cannot produce a record saying a
 * human agreed to it.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import { approverRoleForDepartment, canApprove } from '@/lib/approval-attestation';
import { appendEvent } from '@/lib/activegraph-log';
import { STATE_REF } from '@/lib/runreports';
import { fullRepoName } from '@/lib/venture-repos';

export interface ReleaseResult {
  ok: boolean;
  message: string;
}

/** The marker the lane reads. Deliberately small: who, when, and which ticket. */
export interface PlanRelease {
  ticket: string;
  approver: string;
  released_at: string;
  /**
   * Stated in the file itself, because this is the one artefact someone will find later and have to
   * judge. A file that does not say what it is worth invites being read as more than it is.
   */
  note: string;
}

const SLUG = /^[A-Za-z0-9._-]+$/;

export async function releasePlan(
  ventureId: string,
  repoParam: string,
  ticketSlug: string,
): Promise<ReleaseResult> {
  if (!SLUG.test(ticketSlug)) return { ok: false, message: 'Invalid ticket.' };

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

  // Never take the client's word for which repository to write into. Same reasoning as the external
  // -action gate: a founder's release must not be written into a repository nobody scoped them to.
  const allowed = venture.repos ?? [];
  if (!allowed.includes(repoParam)) {
    return { ok: false, message: 'That work is not in one of this venture’s repositories.' };
  }

  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) {
    return { ok: false, message: 'Releasing is not set up on the studio yet (no write token).' };
  }

  // D7, the same matrix the external-action gate uses. A plan release and a send approval are the
  // same question — may this person say yes to this class of change — asked at opposite ends of the
  // job, so they must not have two different answers.
  const department = venture.departments?.find((d) => d.repo === repoParam)?.id ?? 'general';
  const role = approverRoleForDepartment(venture, department);
  if (!canApprove(email, role, venture, admins)) {
    return {
      ok: false,
      message: `This is released by ${role === 'dual' ? 'the founder and Bruntsfield' : role}; you are not that approver.`,
    };
  }

  const ghRepo = fullRepoName(repoParam);
  const at = new Date().toISOString();
  const release: PlanRelease = {
    ticket: ticketSlug,
    approver: email,
    released_at: at,
    note:
      'Releases the lane to begin work it paused on. This marker is unsigned and lives on a ref the ' +
      'lane can write, so it is not evidence a human approved anything — the signed record is in the ' +
      'studio ActiveGraph. See FB-122.',
  };

  const writer = new GitHubClient({ token: writeToken });
  try {
    await writer.putFile(ghRepo, `approvals/plan-${ticketSlug}.json`, {
      content: JSON.stringify(release, null, 2),
      message: `release plan ${ticketSlug} (${email})`,
      branch: STATE_REF,
    });
  } catch (err) {
    // Said out loud rather than swallowed: a 403 from a mis-scoped token and a transient 502 are
    // indistinguishable to an operator otherwise (CLAUDE.md #10).
    console.error('[release-plan] write failed', { ventureId, repoParam, ticketSlug, err });
    return { ok: false, message: 'Could not record the release on GitHub — please try again.' };
  }

  // The part a lane cannot produce. Best-effort by design: the release itself is already real, and
  // failing to write history must not tell the founder their click did nothing when it did.
  const secret = process.env.FOUNDRY_APPROVAL_SECRET;
  if (secret) {
    const recorded = await appendEvent(
      writeToken,
      {
        v: 1,
        seq: 1,
        venture: ventureId,
        repo: repoParam,
        id: `plan-${ticketSlug}`,
        type: 'approval.granted',
        at,
        actor: { kind: 'human', id: email },
        data: { kind: 'plan-release', ticket: ticketSlug },
      },
      secret,
    );
    // A taken position is not a failure: it means this plan was already released, and the marker
    // write above is idempotent. Reporting it as a history fault would send a founder looking for a
    // problem that does not exist.
    if (!recorded.ok && /already recorded/i.test(recorded.reason)) {
      return { ok: true, message: 'Already released — your team will pick it up on the next check-in.' };
    }
    if (!recorded.ok) {
      console.error('[release-plan] activegraph append failed', { ventureId, ticketSlug, reason: recorded.reason });
      return {
        ok: true,
        message:
          'Released — your team will pick it up on the next check-in. The studio could not write it ' +
          'to the history, so this will show fewer details than usual; nothing else is affected.',
      };
    }
  }

  return { ok: true, message: 'Released. Your team will pick it up on the next check-in.' };
}
