import 'server-only';

import { GitHubClient } from './github';
import { readEventsWithVerdict } from './activegraph-log';
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
  /**
   * `repo ticketId` → the pull request number carrying a ticket a founder just FILED (FB-120).
   *
   * A composer filing arrives on a `foundry/<slug>` branch whose title carries no ticket id, so it
   * links to nothing — and the ticket a founder opens immediately after using the composer showed no
   * work hop, no preview, and no history at all, while the same screen showed it waiting on them.
   * The headline story of the trail, missing on exactly the ticket most likely to be read.
   */
  filedPrNumbers?: Record<string, number>;
}

export function trailSources(venture: VentureSummary, already: AlreadyRead): TrailSources {
  const client = new GitHubClient();
  const secret = process.env.FOUNDRY_APPROVAL_SECRET ?? '';
  // The one well-known switch that turns the studio into a test rig, exactly as the approvals and
  // run-report sources use it. Without this the UI gate reached api.github.com for signed events —
  // so in CI the approval hops either never appeared or arrived by network, and the test carrying
  // this PR's central claim (no dead link renders) was asserting over whatever happened to survive.
  const testRig = Boolean(process.env.APPROVALS_FIXTURE_DIR) && process.env.E2E_TEST_LOGIN === '1';

  /** The work carrying this ticket — by its linked id, or by the filing that created it. */
  const workFor = (repo: string, ticketId: string): PrApproval | undefined => {
    const linked = already.work.find((w) => w.repo === repo && w.linkedTicketId === ticketId);
    if (linked) return linked;
    const filed = already.filedPrNumbers?.[`${repo} ${ticketId}`];
    return filed === undefined ? undefined : already.work.find((w) => w.repo === repo && w.number === filed);
  };

  return {
    async events(repo, approvalId) {
      // A fixture venture has no signed event store, and reaching for one would be a network read in
      // a suite that has none. No events is the honest answer there, not a failure.
      if (testRig) return [];
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

      const pr = workFor(repo, ticketId) ?? null;
      return {
        approvalIds,
        pr: pr
          ? {
              number: pr.number,
              url: pr.url,
              branch: pr.branch ?? '',
              createdAt: pr.createdAt,
              merged: false,
              // No checks hop unless there is something true to say AND a time it happened.
              //
              // `unavailable` means "the studio could not find out" (`lib/attention.ts`), and
              // `buildTrail` renders `unknown` as "This work has no automatic checks" — so mapping
              // one to the other made the trail tell a founder their work has no CI when the rollup
              // read had simply failed.
              //
              // And the attention queue carries no check TIMESTAMP. Stamping the hop with the pull
              // request's own `createdAt` dated it days early and sorted it into the wrong place in
              // an ordered history whose only key is time. A hop the studio cannot date is a hop it
              // does not have.
              checks: undefined,
            }
          : null,
      };
    },

    async preview(repo, ticketId) {
      const pr = workFor(repo, ticketId);
      // Only when the deploy actually reported one. A preview URL is the single hop that proves the
      // founder's words became something running, so it is never guessed at from a branch name.
      //
      // Dated by the pull request, and that is the honest limit: the queue does not carry when the
      // preview built. It is the right order relative to the work hop — a preview cannot precede the
      // branch it built from — which is what the trail uses the time for.
      return pr?.previewUrl ? { url: pr.previewUrl, at: pr.createdAt } : null;
    },

    async thread(): Promise<TrailInputs['thread']> {
      // Nothing yet.
      //
      // `buildTrail` renders this hop and it is tested, but the studio has no surface that shows a
      // stored conversation — `readThread` has no caller outside its own tests, and
      // `/composer?about=` seeds a fresh box rather than opening the thread. So "this conversation
      // is its source · read it →" would deliver an empty composer, which is the dead link the
      // trail's whole claim forbids.
      //
      // Nothing writes thread files either, so reading one per ticket selection was a guaranteed
      // 404 for a hop that could never appear. Wired when FB-144 gives a conversation a door.
      return null;
    },
  };
}
