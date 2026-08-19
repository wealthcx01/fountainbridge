'use server';

/**
 * Deciding about a routine, from the studio (FB-047).
 *
 * Same shape as the approve action (FB-046/058) on purpose: verify the session, check the venture is
 * this founder's, check the repo is one the venture declares, re-read what is CURRENTLY there, and
 * write with a pinned sha. A founder should learn one pattern for "I am agreeing to something",
 * whether it is a send going out, a piece of work landing, or an agent being told to do something
 * every Monday without being asked again.
 *
 * ## Why this is not signed like an external-action grant
 *
 * A grant under FB-044/051 is HMAC-signed because it authorises a *separate executor* to do
 * something irreversible outside the company, and the record has to survive a compromised lane.
 * Approving a routine authorises the lane to keep doing what it already does, on a cadence — the
 * external actions inside a routine still gate individually, every time, through that same signed
 * path. Signing here would imply a guarantee this action cannot make.
 *
 * What it does guarantee is that **the lane cannot do it**: the studio holds the write credential
 * for the state ref, and `fromStored` refuses to read an approval that no `approved_by` stands
 * behind. A lane can write the file; it cannot make the studio believe it.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import { approvalRepos, fullRepoName } from '@/lib/venture-repos';
import { STATE_REF } from '@/lib/runreports';
import { ROUTINES_DIR, approve, fromStored, pause, resume, type Routine } from '@/lib/routines';

export interface RoutineResult {
  ok: boolean;
  message: string;
}

type Decision = 'approve' | 'pause' | 'resume';

/** What the founder is told after each decision — their words, not the state machine's. */
const CONFIRMATION: Record<Decision, (r: Routine) => string> = {
  approve: (r) => `“${r.title}” is on. Your team will do it ${r.cadence}.`,
  pause: (r) => `“${r.title}” is paused. It will not run until you turn it back on.`,
  resume: (r) => `“${r.title}” is on again.`,
};

/**
 * Approve, pause or resume a routine.
 *
 * `seenSha` pins the routine the founder was looking at. Same reasoning as FB-058: without it, a
 * routine edited between render and click is decided unexamined — and a routine is a standing
 * instruction, so an unexamined yes keeps being true every week.
 */
export async function decideRoutine(
  ventureId: string,
  routineId: string,
  decision: Decision,
  repoParam?: string,
  seenSha?: string,
): Promise<RoutineResult> {
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

  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) {
    return { ok: false, message: 'The studio cannot change routines yet — it has no write access set up.' };
  }

  // Never the client's word for which repo. Same reason as the approve action: otherwise a decision
  // could be written into a repository nobody scoped this founder to.
  const allowed = approvalRepos(venture);
  const repo = repoParam ?? allowed[0];
  if (!repo) return { ok: false, message: 'This venture has no records set up yet.' };
  if (!allowed.includes(repo)) {
    return { ok: false, message: 'That routine is not in one of this venture’s records.' };
  }

  const ghRepo = fullRepoName(repo);
  const path = `${ROUTINES_DIR}/${routineId}.json`;
  const reader = new GitHubClient();
  const current = await reader.getFileWithSha(ghRepo, path, STATE_REF);
  if (!current) return { ok: false, message: 'That routine no longer exists.' };

  if (seenSha && seenSha !== current.sha) {
    return {
      ok: false,
      message: 'This routine changed after the page loaded, so nothing was done. Refresh and read it again.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(current.text);
  } catch {
    return { ok: false, message: 'That routine could not be read.' };
  }

  const routine = fromStored(parsed, ventureId);
  if (!routine) return { ok: false, message: 'That routine could not be read.' };

  // Decide against what is true NOW, not against what the page said. Each of these refusals is a
  // real sequence: two tabs open, or a click after the lane changed something underneath.
  if (decision === 'approve' && routine.state !== 'proposed') {
    return { ok: false, message: 'That routine has already been decided.' };
  }
  if (decision === 'pause' && routine.state !== 'active') {
    return { ok: false, message: 'That routine is not running, so there is nothing to pause.' };
  }
  if (decision === 'resume' && routine.state !== 'paused') {
    return { ok: false, message: 'That routine is not paused.' };
  }

  const now = new Date().toISOString();
  const updated =
    decision === 'approve' ? approve(routine, email, now) : decision === 'pause' ? pause(routine) : resume(routine);

  // `resume` refuses a routine no founder ever approved. If that guard fired we would be writing a
  // paused record back unchanged and telling the founder it was on — so say nothing happened.
  if (updated.state !== (decision === 'pause' ? 'paused' : 'active')) {
    return { ok: false, message: 'That routine has not been approved, so it cannot be turned on.' };
  }

  const writer = new GitHubClient({ token: writeToken });
  try {
    await writer.putFile(ghRepo, path, {
      content: `${JSON.stringify(updated, null, 2)}\n`,
      message: `routine ${routineId}: ${decision} (by ${email})`,
      branch: STATE_REF,
      sha: current.sha,
    });
  } catch (err) {
    // Say which cause server-side: a 403 from a mis-scoped write token and a transient 502 read
    // identically to an operator otherwise (CLAUDE.md #10).
    console.error('[routine] write failed', { ventureId, routineId, decision, err });
    return { ok: false, message: 'Could not save that change — please try again.' };
  }

  return { ok: true, message: CONFIRMATION[decision](updated) };
}
