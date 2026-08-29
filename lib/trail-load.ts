/**
 * Reading what the trail joins (FB-125, gap G1).
 *
 * `trail.ts` holds the join and is pure. This is the half that touches the network, kept separate for
 * the same reason `githubTicketFetcher` is separate from `groupRepoTickets`: the part with the edge
 * cases has to be testable without one.
 *
 * ## The read budget
 *
 * FB-083's rule, and the lesson FB-123 cost forty seconds to learn: **bounded per page load, never
 * repeating on a timer, and never a function of how much history a venture has.** A trail is opened
 * on one ticket, so its cost is a function of that ticket's own events — not of the venture's
 * approvals, not of its run reports, and not of its backlog.
 *
 * Concretely: run reports are loaded once through `loadRunReports`, which FB-123 already bounded, and
 * then filtered in memory. Approval events are read only for approvals that belong to this ticket.
 * A venture with two thousand run reports and four hundred approvals costs exactly what one with
 * twenty costs, and there is a test that says so.
 */

import { cache } from 'react';
import type { VentureSummary } from './ventures';
import type { ActiveGraphEvent } from './activegraph';
import type { RunReport } from './runreports';
import { buildTrail, type Trail, type TrailInputs } from './trail';

/** The reads a trail needs. Injectable so the budget can be counted and the join tested offline. */
export interface TrailSources {
  /** Signed approval events for one approval id, with whether each verified. */
  events(repo: string, approvalId: string): Promise<Array<{ event: ActiveGraphEvent; verified: boolean }>>;
  /** Every run report for the venture. Bounded by `loadRunReports`; filtered here, not re-read. */
  runs(): Promise<RunReport[]>;
  /** The approval ids belonging to this ticket, and the pull request carrying its work. */
  work(repo: string, ticketId: string): Promise<{ approvalIds: string[]; pr: TrailInputs['pr'] }>;
  /** The running preview from the venture box, when the deploy reported one. */
  preview(repo: string, ticketId: string): Promise<TrailInputs['preview']>;
  /** The conversation this ticket came out of (FB-130). One read, or none. */
  thread(repo: string, ticketId: string): Promise<TrailInputs['thread']>;
}

/**
 * The trail for one ticket.
 *
 * Every source degrades independently and sets `degraded` rather than throwing. A trail that 500s
 * takes the ticket page with it, and a founder looking at a ticket whose history cannot be read still
 * needs the ticket (CLAUDE.md #10). A short trail and an unreadable one are told apart by that flag,
 * because otherwise they look identical and one of them is a lie.
 */
export const loadTrail = cache(
  async (venture: VentureSummary, repo: string, ticketId: string, sources: TrailSources): Promise<Trail> => {
    let degraded = false;
    const fell = <T,>(fallback: T) => (): T => {
      degraded = true;
      return fallback;
    };

    const [work, allRuns, preview, thread] = await Promise.all([
      sources.work(repo, ticketId).catch(fell<{ approvalIds: string[]; pr: TrailInputs['pr'] }>({ approvalIds: [], pr: null })),
      sources.runs().catch(fell<RunReport[]>([])),
      sources.preview(repo, ticketId).catch(fell<TrailInputs['preview']>(null)),
      sources.thread(repo, ticketId).catch(fell<TrailInputs['thread']>(null)),
    ]);

    // One read per approval this ticket actually has — not per approval the venture has.
    const eventLists = await Promise.all(
      work.approvalIds.map((id) =>
        sources.events(repo, id).catch(fell<Array<{ event: ActiveGraphEvent; verified: boolean }>>([])),
      ),
    );

    return buildTrail({
      ventureId: venture.id,
      repo,
      ticketId,
      events: eventLists.flat(),
      // Filtered in memory from the one bounded load. Re-reading per ticket is how a page becomes
      // slow one reasonable-looking decision at a time.
      runs: allRuns.filter((r) => !r.isHeartbeat && r.repo === repo && r.ticketsTouched.includes(ticketId)),
      pr: work.pr,
      preview,
      thread,
      degraded,
    });
  },
);
