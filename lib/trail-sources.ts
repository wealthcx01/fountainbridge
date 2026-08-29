import 'server-only';

import { GitHubClient } from './github';
import { readEventsWithVerdict } from './activegraph-log';
import { threadPath, THREADS_REF, parseThread } from './threads';
import { fullRepoName } from './venture-repos';
import type { VentureSummary } from './ventures';
import type { RunReport } from './runreports';
import type { ActiveGraphApproval } from './approvals';
import type { PrApproval } from './attention';
import type { TrailSources } from './trail-load';
import type { TrailInputs } from './trail';

/**
 * The trail's sources, against real data (FB-130).
 *
 * FB-125 built the join and its loader and left this interface implemented only in tests. This is
 * the half that touches the network — and it deliberately touches as little of it as possible.
 *
 * ## It closes over what the caller already read
 *
 * The Tickets screen has already loaded the venture's approvals, its run reports and its open pull
 * requests to draw the list. Re-reading them here would double every one of those on a screen that
 * renders a trail per selected ticket, which is the shape FB-083 was written about and the shape
 * FB-128 got wrong by parallelising two calls that were secretly the same call.
 *
 * So the caller passes what it has. What is genuinely extra is exactly two reads: the signed events
 * for the approvals **this ticket** has, and the conversation it came out of.
 */
export interface AlreadyRead {
  approvals: ActiveGraphApproval[];
  runs: RunReport[];
  /** Open work, from the attention queue. */
  work: PrApproval[];
}

export function trailSources(venture: VentureSummary, already: AlreadyRead): TrailSources {
  const client = new GitHubClient();
  const secret = process.env.FOUNDRY_APPROVAL_SECRET ?? '';

  return {
    async events(repo, approvalId) {
      // Without the secret nothing can be verified, and showing events as unverified when the studio
      // simply has no key would be an accusation rather than a fact. The trail degrades instead.
      if (!secret) throw new Error('no approval secret configured');
      const read = await readEventsWithVerdict(client, venture.id, repo, approvalId, secret);
      return read.events;
    },

    async runs() {
      return already.runs;
    },

    async work(repo, ticketId) {
      const approvalIds = already.approvals
        .filter((a) => a.repo === repo && a.ticket === ticketId)
        .map((a) => a.id);

      const pr = already.work.find((w) => w.repo === repo && w.linkedTicketId === ticketId) ?? null;
      return {
        approvalIds,
        pr: pr
          ? {
              number: pr.number,
              url: pr.url,
              branch: pr.branch ?? '',
              createdAt: pr.createdAt,
              merged: false,
              checks: pr.ciStatus
                ? { conclusion: normaliseChecks(pr.ciStatus), at: pr.createdAt }
                : undefined,
            }
          : null,
      };
    },

    async preview(repo, ticketId) {
      const pr = already.work.find((w) => w.repo === repo && w.linkedTicketId === ticketId);
      // Only when the deploy actually reported one. A preview URL is the single hop that proves the
      // founder's words became something running, so it is never guessed at from a branch name.
      return pr?.previewUrl ? { url: pr.previewUrl, at: pr.createdAt } : null;
    },

    async thread(repo, ticketId): Promise<TrailInputs['thread']> {
      const raw = await client.getFileContent(fullRepoName(repo), threadPath(repo, ticketId), THREADS_REF);
      const parsed = parseThread(raw);
      const first = parsed?.messages[0];
      // No thread is not "the transcript was lost" — it is a ticket nobody discussed, and it gets no
      // hop at all. `kept: false` is reserved for a conversation that happened and was not stored,
      // which the studio cannot currently tell apart from the first case and therefore does not
      // claim. Said here rather than guessed at in the sentence a founder reads.
      return first ? { at: first.at, kept: true } : null;
    },
  };
}

/** The queue's check vocabulary, in the trail's. */
function normaliseChecks(ci: PrApproval['ciStatus']): 'success' | 'failure' | 'pending' | 'unknown' {
  switch (ci) {
    case 'success': return 'success';
    case 'failure': return 'failure';
    case 'pending': return 'pending';
    default: return 'unknown';
  }
}
