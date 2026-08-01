/**
 * Founder-facing glossary (FB-024). One place for the plain-English words a non-technical founder
 * reads, so the same concept always shows the same words. The engineering reality underneath (pull
 * requests, merges, lanes) is UNCHANGED — these are labels only. Internal ids, routes, test ids and
 * bcap-contracts field names keep their technical names; only visible copy comes from here.
 */

import type { TicketStatusGroup } from './tickets';

/**
 * Plain-English label for each ticket status, shown to founders (board columns + the ticket drawer).
 * "pr-open" — a change proposed and waiting on the human approval gate — reads as "Needs your OK"
 * rather than the git term "PR open".
 */
export const STATUS_LABEL: Record<TicketStatusGroup, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  'pr-open': 'Needs your OK',
  done: 'Done',
};

/** Founder-facing term for an agent "lane" (the URL /lanes and the `lane` contract field stay). */
export const WORKSTREAM = 'Workstream';
export const WORKSTREAMS = 'Workstreams';

/**
 * Plain reassurance that replaces the jargon "the workshop never merges, so each one needs a human".
 * Keeps the meaning — a human approves before anything goes live — without the git vocabulary.
 */
export const APPROVAL_REASSURANCE = 'Nothing goes live until you approve it.';


/**
 * What the automatic checks say, in the founder's words (FB-064, shared by FB-076).
 *
 * Here rather than in a component because two surfaces show the same fact and they drifted: the
 * work view said "This work has no automatic checks" while the attention queue said `CI UNKNOWN`
 * in monospace small-caps beside every item. Same underlying state, reassuring on one screen and
 * alarming on the other.
 *
 * `unknown` is the one that matters most: it means the repository has no automatic checks at all,
 * which is true of a young venture and completely fine. `unavailable` means the studio could not
 * find out — a different thing, and never presentable as a pass.
 */
export const CHECK_LABEL: Record<string, string> = {
  success: 'All automatic checks passed',
  failure: 'The automatic checks did not pass',
  pending: 'The automatic checks are still running',
  unknown: 'This work has no automatic checks',
  unavailable: 'The studio could not read the automatic checks',
};
