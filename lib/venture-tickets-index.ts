import 'server-only';

/**
 * What the studio knows about a venture's tickets, in the shape the matcher wants (FB-099).
 *
 * Both the board and the "Needs you" queue need this, and they must build it the same way: the whole
 * bug was two surfaces answering "how much is waiting?" from different knowledge. One helper, one
 * answer.
 *
 * It reads through `loadVentureTickets`, which is cached per venture — so the queue and the board
 * share one network read rather than each paying for their own.
 */

import { loadVentureTickets, STATUS_GROUPS, type LaneTickets } from './tickets';
import type { MatchableTicket } from './ticket-match';
import type { VentureSummary } from './ventures';

/**
 * The same index, from lanes a caller has ALREADY loaded (FB-128).
 *
 * Pure, and the reason it exists: the venture page loads the backlog for its columns and needs this
 * index for the matcher, and calling `ticketsByRepo` for the second half re-enters
 * `loadVentureTickets`. Sequentially that was free — the second call hit the per-venture cache. Run
 * in parallel it is not: neither call has finished when the other starts, both miss, and the venture
 * fires two full backlog reads per repository. `GitHubClient.graphql` is neither coalesced nor
 * gated by `MAX_CONCURRENT`, so that lands as a burst against exactly the secondary rate limit
 * FB-083 exists to avoid.
 *
 * So a caller that already holds the lanes passes them, and pays for one read.
 */
export function ticketsByRepoFrom(lanes: LaneTickets[]): Map<string, MatchableTicket[]> {
  const byRepo = new Map<string, MatchableTicket[]>();
  for (const lane of lanes) {
    const list: MatchableTicket[] = [];
    for (const group of STATUS_GROUPS) {
      for (const { ticket } of lane.groups[group]) {
        list.push({ id: ticket.id, title: ticket.title, path: ticket.path, branch: ticket.branch ?? null });
      }
    }
    byRepo.set(lane.repo, list);
  }
  return byRepo;
}

export async function ticketsByRepo(
  venture: VentureSummary,
  opts: { refresh?: boolean } = {},
): Promise<Map<string, MatchableTicket[]>> {
  let byRepo = new Map<string, MatchableTicket[]>();
  try {
    const data = await loadVentureTickets(venture, opts);
    byRepo = ticketsByRepoFrom(data.lanes);
  } catch {
    // A read that failed leaves the matcher with less to work with, which it handles: work stays
    // unmatched and SAYS so. Blanking the queue because the tickets could not be read would be the
    // worse failure — the queue is the surface a founder came to act on.
  }
  return byRepo;
}
