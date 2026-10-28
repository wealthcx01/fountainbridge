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
 *
 * ## Both must say go ahead (FB-271)
 *
 * A plan is held because the work is high-impact, and on a venture whose matrix makes that class
 * `dual`, it needs the founder AND Bruntsfield — the same rule as a send. The first of the two gets a
 * signed first-approval record on the state ref, at a path the lane never reads, and the lane is not
 * released. Only the second, from the other side, writes the marker the lane reads. The first half is
 * signed, unlike the marker, because the signed history names both people: a lane that could write a
 * first half naming the founder would let one Bruntsfield click put the founder's name on the record.
 */

import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import {
  approverRoleForDepartment, canApprove, canDecide, firstApprovalAttestationFor, isDualPair, stillNeededAfter,
} from '@/lib/approval-attestation';
import { verifyFirstApproval, type FirstApproval } from '@/lib/provenance';
import { appendEvent } from '@/lib/activegraph-log';
import { STATE_REF } from '@/lib/runreports';
import { fullRepoName } from '@/lib/venture-repos';

export interface ReleaseResult {
  ok: boolean;
  message: string;
  /** True when this was the first of two go-aheads a dual plan needs (FB-271): nobody starts yet. */
  waiting?: boolean;
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
  /** For a dual plan (FB-271): who said go ahead first. `approver` is the second. */
  first_approver?: string;
  first_approved_at?: string;
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
  if (!canDecide(email, role, venture, admins)) {
    return {
      ok: false,
      message: `This is released by ${role === 'dual' ? 'the founder and Bruntsfield' : role}; you are not that approver.`,
    };
  }

  const ghRepo = fullRepoName(repoParam);
  const writer = new GitHubClient({ token: writeToken });
  const secret = process.env.FOUNDRY_APPROVAL_SECRET;

  let first: FirstApproval | null = null;
  if (role === 'dual') {
    if (!secret) {
      return {
        ok: false,
        message: 'This needs the founder and Bruntsfield to say go ahead, and the studio cannot record the first of the two yet (no signing secret).',
      };
    }
    const half = await halfOfDualRelease(writer, { ghRepo, ticketSlug, email, secret, venture, admins });
    if (half.done) return half.result;
    first = half.first;
  } else if (!canApprove(email, role, venture, admins)) {
    return { ok: false, message: `This is released by ${role}; you are not that approver.` };
  }

  const at = new Date().toISOString();
  const release: PlanRelease = {
    ticket: ticketSlug,
    approver: email,
    released_at: at,
    note:
      'Releases the lane to begin work it paused on. This marker is unsigned and lives on a ref the ' +
      'lane can write, so it is not evidence a human approved anything — the signed record is in the ' +
      'studio ActiveGraph. See FB-122.',
    ...(first ? { first_approver: first.approver, first_approved_at: first.approvedAt } : {}),
  };

  try {
    await writer.putFile(ghRepo, `approvals/plan-${ticketSlug}.json`, {
      content: JSON.stringify(release, null, 2),
      message: `release plan ${ticketSlug} (${first ? `${first.approver} and ` : ''}${email})`,
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
        data: {
          kind: 'plan-release', ticket: ticketSlug,
          ...(first ? { first_approver: first.approver, first_approved_at: first.approvedAt } : {}),
        },
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

  return {
    ok: true,
    message: first
      ? `Released by you and ${first.approver}. Your team will pick it up on the next check-in.`
      : 'Released. Your team will pick it up on the next check-in.',
  };
}

/**
 * Where the first go-ahead on a dual plan is kept (FB-271). On the state ref, beside the marker, but
 * in its own folder: the lane reads exactly `approvals/plan-<ticket>.json`, and a ticket slug cannot
 * contain a `/`, so nothing here can ever be read as a release.
 */
function firstReleasePath(ticketSlug: string): string {
  return `approvals/first-approvals/plan-${ticketSlug}.json`;
}

/**
 * One half of a dual plan release (FB-271). The same four cases as `halfOfDual` in approvals.ts:
 * first half (record it, release nothing), the same person again, the same side again, or the other
 * side (the caller writes the marker).
 *
 * A plan has no proposal file and no sha, so the first half is pinned to the ticket alone (the id
 * `plan-<ticket>` is in the signed string, and the proposal sha is empty). The lane writes a ticket's
 * plan once, so there is no later version for it to be confused with.
 */
async function halfOfDualRelease(
  writer: GitHubClient,
  p: { ghRepo: string; ticketSlug: string; email: string; secret: string; venture: VentureSummary; admins: string[] },
): Promise<{ done: true; result: ReleaseResult } | { done: false; first: FirstApproval }> {
  const path = firstReleasePath(p.ticketSlug);
  const id = `plan-${p.ticketSlug}`;
  const existing = await writer.getFileWithSha(p.ghRepo, path, STATE_REF);
  let parsed: unknown = null;
  if (existing) {
    try { parsed = JSON.parse(existing.text); } catch { parsed = null; }
  }
  const signed = verifyFirstApproval('plan-release', p.ghRepo, id, '', parsed, p.secret);
  const first = signed && canDecide(signed.approver, 'dual', p.venture, p.admins) ? signed : null;
  const me = p.email.trim().toLowerCase();

  if (!first) {
    const approvedAt = new Date().toISOString();
    const record = {
      id, repo: p.ghRepo, ticket: p.ticketSlug, decision: 'first-approval', approver: me,
      proposal_sha: '', approved_at: approvedAt,
      attestation: firstApprovalAttestationFor('plan-release', p.ghRepo, id, '', me, approvedAt, p.secret),
      note: 'The first of two go-aheads. This does not release the plan: your team waits for the other side too. See FB-271.',
    };
    try {
      await writer.putFile(p.ghRepo, path, {
        content: JSON.stringify(record, null, 2),
        message: `first go-ahead ${p.ticketSlug} (${me})`,
        branch: STATE_REF,
        ...(existing ? { sha: existing.sha } : {}),
      });
    } catch (err) {
      console.error('[release-plan] first go-ahead write failed', { ticketSlug: p.ticketSlug, err });
      return { done: true, result: { ok: false, message: 'Could not record your go-ahead on GitHub — please try again.' } };
    }
    return {
      done: true,
      result: {
        ok: true,
        waiting: true,
        message: `You said go ahead. Your team starts once ${stillNeededAfter(me, p.venture, p.admins)} says go ahead too.`,
      },
    };
  }

  if (first.approver === me) {
    return {
      done: true,
      result: {
        ok: false,
        message: `You have already said go ahead. Your team starts once ${stillNeededAfter(me, p.venture, p.admins)} says go ahead too.`,
      },
    };
  }

  if (!isDualPair(first.approver, me, p.venture, p.admins)) {
    return {
      done: true,
      result: {
        ok: false,
        message: `${first.approver} has already said go ahead for Bruntsfield. It now needs ${stillNeededAfter(first.approver, p.venture, p.admins)} to say go ahead too.`,
      },
    };
  }

  return { done: false, first };
}
