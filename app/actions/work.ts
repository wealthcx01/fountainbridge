'use server';

/**
 * Accept a piece of work from the studio (FB-064) — the click that ends the trip to github.com.
 *
 * Same shape as the approve action (FB-046/058), deliberately: a founder should learn one pattern
 * for "I am agreeing to something", whether it is a send going out or a piece of work landing.
 *   1. verify the session and that this venture is theirs (server-side, CLAUDE.md #6),
 *   2. check the work is in this venture's repos — never take the client's word for a repo,
 *   3. re-read it and re-decide acceptability against what is CURRENTLY true,
 *   4. for John only: merge with the commit he was looking at pinned, using a write-scoped
 *      credential. For a founder: write their sign-off on the work, and merge nothing.
 *
 * **Only John's Approve merges** (FB-272, CLAUDE.md rule 2). "John" is whoever `STUDIO_ADMIN_EMAILS`
 * names. A founder's Accept is their sign-off: it says "Signed off by <founder>, waiting for John" on
 * the pull request, where John reads it, and the work waits for him.
 */

import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient, GitHubError } from '@/lib/github';
import { approvalRepos } from '@/lib/venture-repos';
import { acceptability } from '@/lib/work';
import { githubWorkSource, loadWork } from '@/lib/work-load';
import { pressRecordFile, pressesFor, recordPress, type PressLine } from '@/lib/press-record';
import { cardOf } from '@/lib/review-load';
import { cardStore } from '@/lib/card-store-live';
import { isSettled, OUT_OF_DATE, stateAfter } from '@/lib/review';
import type { VentureSummary } from '@/lib/ventures';

export interface AcceptResult {
  ok: boolean;
  message: string;
  /**
   * True when a founder's Accept was recorded as their sign-off and nothing was merged (FB-272).
   * The screens use it to say "signed off" rather than "accepted".
   */
  signedOff?: boolean;
}

/** How long a note may be. Long enough for a paragraph; short enough that it is a note. */
const NOTE_LIMIT = 2000;

/**
 * Send a piece of work back with a note (FB-107).
 *
 * The other half of a decision page. Before this, a founder who did not want the work could only
 * leave it sitting there — and in the one case the page NAMES an action ("the team needs to bring
 * this up to date before it can be accepted") there was no way to ask for it. A page that states the
 * required action must offer it.
 *
 * The note goes to the work's own thread, which is what the venture's team reads on its next wake.
 * Nothing is merged, closed or changed: this is the founder talking, not the studio acting.
 */
export async function sendBackWork(
  ventureId: string,
  repo: string,
  number: number,
  note: string,
): Promise<AcceptResult> {
  if (!Number.isInteger(number) || number <= 0) return { ok: false, message: 'That work could not be found.' };

  const text = note.trim();
  if (!text) return { ok: false, message: 'Say what needs changing, and it goes straight to your team.' };
  if (text.length > NOTE_LIMIT) {
    return { ok: false, message: `That note is too long — keep it under ${NOTE_LIMIT} characters.` };
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
  if (!approvalRepos(venture).includes(repo)) {
    return { ok: false, message: 'That work is not part of this venture.' };
  }

  const card = await cardInTestCopy(venture, repo, number);
  if (card) return pressCard(card, { venture: venture.id, repo, number, by: email, decision: 'sent-back', note: text, seen: null });

  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) {
    return { ok: false, message: 'This studio is not set up to send work back yet — an admin needs to finish setting it up.' };
  }

  const org = process.env.GITHUB_ORG ?? 'wealthcx01';
  const full = repo.includes('/') ? repo : `${org}/${repo}`;
  // Attributed, because the team's next wake needs to know whose instruction this is — and because a
  // note that could have come from anywhere is not an instruction a founder can be held to.
  const body = `**${email} asked for a change before accepting this:**\n\n${text}`;

  try {
    await new GitHubClient({ token: writeToken }).commentOnPullRequest(full, number, body);
    return { ok: true, message: 'Sent. Your team picks this up on its next wake.' };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 403) {
      return { ok: false, message: 'The studio is not allowed to write to this repository. An admin needs to widen its access.' };
    }
    return { ok: false, message: 'Something went wrong sending that. Nothing was sent — try again.' };
  }
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
  /**
   * Notes that go with the Accept (FB-274): the Review screen lets a founder sign off and still
   * leave notes for their team. Written beside the sign-off, or beside John's approval.
   */
  note = '',
): Promise<AcceptResult> {
  if (!Number.isInteger(number) || number <= 0) return { ok: false, message: 'That work could not be found.' };
  const text = note.trim();
  if (text.length > NOTE_LIMIT) {
    return { ok: false, message: `Those notes are too long — keep them under ${NOTE_LIMIT} characters.` };
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
  if (!approvalRepos(venture).includes(repo)) {
    return { ok: false, message: 'That work is not part of this venture.' };
  }

  const card = await cardInTestCopy(venture, repo, number);
  if (card) {
    return pressCard(card, {
      venture: venture.id, repo, number, by: email,
      decision: access.isAdmin ? 'approved' : 'signed-off', note: text, seen: seenHeadSha ?? null,
    });
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

  // Same owner qualification as the read path — a short manifest name is not an API path.
  const org = process.env.GITHUB_ORG ?? 'wealthcx01';
  const full = repo.includes('/') ? repo : `${org}/${repo}`;
  const writer = new GitHubClient({ token: writeToken });

  // A founder signs off; only John merges. `access.isAdmin` is true only for an address in
  // STUDIO_ADMIN_EMAILS — being a venture's founder never makes it true.
  if (!access.isAdmin) {
    // The commit they read goes in the record, so John knows exactly what was signed off.
    const body =
      `**Signed off by ${email}, waiting for John.**\n\n` +
      `They read commit \`${work.headSha.slice(0, 7)}\`. Nothing has been merged: only John's approval merges this.` +
      (text ? `\n\n**Their notes for the team:**\n\n${text}` : '');
    try {
      await writer.commentOnPullRequest(full, number, body);
      return { ok: true, signedOff: true, message: 'Signed off by you, waiting for John. Nothing changes in your product until he approves it.' };
    } catch (e) {
      if (e instanceof GitHubError && e.status === 403) {
        return { ok: false, message: 'The studio is not allowed to write to this repository. An admin needs to widen its access.' };
      }
      return { ok: false, message: 'Something went wrong recording your sign-off. Nothing was recorded — try again.' };
    }
  }

  // John's own notes go on the work before it merges, where the team reads them. If they cannot be
  // written, nothing is merged: an approval must not quietly drop what he asked for.
  if (text) {
    try {
      await writer.commentOnPullRequest(full, number, `**Notes from ${email}, with their approval:**\n\n${text}`);
    } catch {
      return { ok: false, message: 'Your notes could not be written, so nothing was merged. Try again.' };
    }
  }

  try {
    // The sha is pinned server-side too: GitHub 409s if the branch moved between our read and this
    // call. The check above gives a good message; this makes the race impossible.
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

/**
 * A finished card from the factory, in a test copy (FB-274).
 *
 * The card comes from the card store (FB-275), but until presses have their own door (FB-276) a
 * press on one never reaches GitHub, and is only recorded in a test copy: as one line in its state
 * folder (`lib/press-record.ts`), as `harness/END-TO-END.md` says. FB-276 replaces this with the
 * press door, where the planning box collects it. Null for everything else, so every other Accept
 * and Send back works exactly as before, and in production this is always null.
 */
async function cardInTestCopy(venture: VentureSummary, repo: string, number: number) {
  const file = pressRecordFile();
  const card = file ? await cardOf(venture, repo, number, cardStore()) : null;
  return file && card ? { file, card } : null;
}

/** Record one press on a card, once. The first press that settles a card wins. */
function pressCard(
  at: NonNullable<Awaited<ReturnType<typeof cardInTestCopy>>>,
  press: Omit<PressLine, 'at'>,
): AcceptResult {
  const state = stateAfter(pressesFor(at.file, press.repo, press.number));
  if (isSettled(state)) return { ok: false, message: OUT_OF_DATE };
  if (press.seen && press.seen !== at.card.headSha) {
    return { ok: false, message: 'This work changed after the page loaded, so nothing was done. Refresh and look again.' };
  }
  if (press.decision === 'signed-off' && state.kind === 'signed-off' && state.by === press.by) {
    return { ok: true, signedOff: true, message: 'You have already signed this off. It is waiting for John.' };
  }

  recordPress(at.file, { at: new Date().toISOString(), ...press });
  if (press.decision === 'sent-back') return { ok: true, message: 'Sent back with your notes. Your team picks them up next.' };
  if (press.decision === 'signed-off') {
    return { ok: true, signedOff: true, message: 'Signed off by you, waiting for John. Nothing changes in your product until he approves it.' };
  }
  return { ok: true, message: 'Approved. It becomes part of the product.' };
}
