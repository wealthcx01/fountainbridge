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
