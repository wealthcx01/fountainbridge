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

import { loadVentureTickets, STATUS_GROUPS } from './tickets';
import type { MatchableTicket } from './ticket-match';
import type { VentureSummary } from './ventures';

export async function ticketsByRepo(
  venture: VentureSummary,
  opts: { refresh?: boolean } = {},
): Promise<Map<string, MatchableTicket[]>> {
  const byRepo = new Map<string, MatchableTicket[]>();
  try {
    const data = await loadVentureTickets(venture, opts);
    for (const lane of data.lanes) {
      const list: MatchableTicket[] = [];
      for (const group of STATUS_GROUPS) {
        for (const { ticket } of lane.groups[group]) {
          list.push({ id: ticket.id, title: ticket.title, path: ticket.path, branch: ticket.branch ?? null });
        }
      }
      byRepo.set(lane.repo, list);
    }
  } catch {
    // A read that failed leaves the matcher with less to work with, which it handles: work stays
    // unmatched and SAYS so. Blanking the queue because the tickets could not be read would be the
    // worse failure — the queue is the surface a founder came to act on.
  }
  return byRepo;
}
