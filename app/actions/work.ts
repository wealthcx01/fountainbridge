'use server';

/**
 * Accept a piece of work from the studio (FB-064) — the click that ends the trip to github.com.
 *
 * Same shape as the approve action (FB-046/058), deliberately: a founder should learn one pattern
 * for "I am agreeing to something", whether it is a send going out or a piece of work landing.
 *   1. verify the session and that this venture is theirs (server-side, CLAUDE.md #6),
 *   2. check the work is in this venture's repos — never take the client's word for a repo,
 *   3. re-read it and re-decide acceptability against what is CURRENTLY true,
 *   4. merge with the commit the founder was looking at pinned, using a write-scoped credential.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient, GitHubError } from '@/lib/github';
import { approvalRepos } from '@/lib/venture-repos';
import { acceptability } from '@/lib/work';
import { githubWorkSource, loadWork } from '@/lib/work-load';

export interface AcceptResult {
  ok: boolean;
  message: string;
}

export async function acceptWork(
  ventureId: string,
  repo: string,
  number: number,
  /**
   * The commit the founder was reading. Optional so an older page still works, but when present it
   * must still be current — otherwise they would be accepting something they never saw.
   */
  seenHeadSha?: string,
): Promise<AcceptResult> {
  if (!Number.isInteger(number) || number <= 0) return { ok: false, message: 'That work could not be found.' };

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
  if (!approvalRepos(venture).includes(repo)) {
    return { ok: false, message: 'That work is not part of this venture.' };
  }

  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) {
    return { ok: false, message: 'This studio is not set up to accept work yet — an admin needs to finish setting it up.' };
  }

  // Re-read rather than trusting anything the page sent. The founder's view may be minutes old, and
  // checks can fail or a clash appear in that time.
  const reader = new GitHubClient();
  const work = await loadWork(venture, repo, number, githubWorkSource(reader));
  if (!work) return { ok: false, message: 'That work could not be found.' };

  const verdict = acceptability(work, { seenHeadSha, configured: true });
  if (!verdict.ok) {
    return { ok: false, message: verdict.nextStep ? `${verdict.text} ${verdict.nextStep}` : verdict.text };
  }

  const writer = new GitHubClient({ token: writeToken });
  try {
    // The sha is pinned server-side too: GitHub 409s if the branch moved between our read and this
    // call. The check above gives a good message; this makes the race impossible.
    // Same owner qualification as the read path — a short manifest name is not an API path.
    const org = process.env.GITHUB_ORG ?? 'wealthcx01';
    const full = repo.includes('/') ? repo : `${org}/${repo}`;
    const res = await writer.mergePullRequest(full, number, { sha: work.headSha, method: 'squash', title: work.title });
    if (!res.merged) return { ok: false, message: 'GitHub did not accept the change. Nothing was merged.' };
    return { ok: true, message: 'Accepted. It is now part of your product.' };
  } catch (e) {
    if (e instanceof GitHubError) {
      if (e.status === 409) {
        return { ok: false, message: 'This work changed while you were reading it, so nothing was accepted. Refresh and read it again.' };
      }
      if (e.status === 405) {
        return { ok: false, message: 'This cannot be accepted yet — it clashes with something else that changed. The team needs to bring it up to date.' };
      }
      if (e.status === 403) {
        return { ok: false, message: 'The studio is not allowed to accept work in this repository. An admin needs to widen its access.' };
      }
    }
    return { ok: false, message: 'Something went wrong accepting this. Nothing was merged.' };
  }
}
