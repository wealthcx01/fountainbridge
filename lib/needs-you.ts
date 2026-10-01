/**
 * What waits on a founder — one definition, read by every surface that counts it (FB-149).
 *
 * ## Why this file exists
 *
 * Two kinds of thing wait on a founder: finished work (an open pull request) and an external send
 * (an email, a post, a spend) that cannot leave the company without their word. Before this file,
 * four places each decided for themselves which sends counted:
 *
 * - the desk's sentence and amber banner counted sends that were `proposed`;
 * - the desk's own "Waiting on you" list showed `proposed`, `failed` AND `unverified-action`;
 * - the rail's badge counted no sends at all;
 * - the Tickets screen's "Needs you" filter, where the badge leads, listed no sends at all.
 *
 * So on one screen a founder could read three different numbers for one question. The fix is not a
 * cleverer number. It is one predicate, here, and every surface asking it.
 *
 * ## Which sends wait on the founder
 *
 * The same three the desk's list already showed, for the reasons FB-207 gave:
 *
 * - `proposed` — nothing has happened yet. Their yes is what starts it.
 * - `failed` — it was approved, it was tried, and it did not go. Only they decide what happens next.
 * - `unverified-action` — a record says it was approved, and the studio cannot verify who did. That
 *   is an incident, and the founder is the only person who can say whether it was them.
 */

import type { ActiveGraphApproval } from './approvals';
import { waitingOnFounder } from './desk';
import type { TicketRow } from './tickets-view';

/** The send states that need the founder. See the header for why these three. */
export const SEND_STATES_WAITING_ON_FOUNDER: ReadonlySet<ActiveGraphApproval['status']> = new Set([
  'proposed',
  'failed',
  'unverified-action',
]);

/** The sends waiting on this founder, in the order the store gave them. */
export const sendsWaitingOnFounder = (approvals: readonly ActiveGraphApproval[]): ActiveGraphApproval[] =>
  approvals.filter((a) => SEND_STATES_WAITING_ON_FOUNDER.has(a.status));

/**
 * The one number: open pull requests plus sends waiting on the founder.
 *
 * The rail's badge, the desk's sentence, its amber banner and the Tickets "Needs you" filter all
 * state this. `openWork` is the attention queue's length — every open pull request, including work
 * tied to no ticket, because that is what the Tickets screen lists.
 */
export const needsYouCount = (openWork: number, approvals: readonly ActiveGraphApproval[]): number =>
  waitingOnFounder({ openWork, awaitingApproval: sendsWaitingOnFounder(approvals).length });

/**
 * What the meta line says about a send in each state.
 *
 * No "external send" in front: the row is already labelled "send", and the first screenshot of this
 * read "send · Build — Product · external send · waiting for your yes".
 */
const SEND_STATE_WORDS: Record<string, string> = {
  proposed: 'waiting for your yes',
  failed: 'tried and did not go',
  'unverified-action': 'recorded as approved by nobody the studio can name',
};

/**
 * A send, as a row on the Tickets screen.
 *
 * The row is a POINTER, not a second place to decide. FB-183 made the send's own page
 * (`/venture/<id>/approvals/<repo>/<id>`) the only place a grant is signed, and
 * `one-signing-surface.test.ts` holds that. So this row carries the address of that page and the
 * Tickets screen links to it; it never carries an approve control.
 *
 * Its id is prefixed `send-` so it can never collide with a ticket id or a `repo#number` row.
 */
export function sendRow(a: ActiveGraphApproval, ventureId: string, surface: string | null): TicketRow {
  return {
    id: `send-${a.id}`,
    title: a.summary,
    repo: a.repo,
    // A send has no column on the board. `pr-open` is the nearest — something finished, waiting on
    // a person — and the screen labels the row by `send`, not by this group.
    group: 'pr-open',
    item: null,
    progress: null,
    waiting: null,
    surface,
    send: {
      approvalId: a.id,
      ref: a.ticket ?? null,
      href: `/venture/${ventureId}/approvals/${a.repo}/${a.id}`,
      state: SEND_STATE_WORDS[a.status] ?? 'waiting on you',
      unverified: a.grantProvenance === 'unattested' || a.status === 'unverified-action',
    },
  };
}

/**
 * Which part of the company a send belongs to, by name ("Sell — Go-to-market").
 *
 * The proposal names its own department, and that wins. Sends are proposed from the venture's main
 * repository, so going by the repository alone labelled ARCA's investor email "Build — Product".
 * The repository is the fallback for a proposal that names no department.
 */
export function sendSurface(
  departments: readonly { id: string; name: string; repo: string | null }[],
  a: Pick<ActiveGraphApproval, 'department' | 'repo'>,
): string | null {
  const own = a.department ? departments.find((d) => d.id === a.department) : undefined;
  if (own) return own.name;
  return departments.find((d) => d.repo === a.repo)?.name ?? null;
}

/** Every send waiting on the founder, as Tickets rows. */
export const sendRows = (
  approvals: readonly ActiveGraphApproval[],
  ventureId: string,
  surfaceOf: (a: ActiveGraphApproval) => string | null,
): TicketRow[] => sendsWaitingOnFounder(approvals).map((a) => sendRow(a, ventureId, surfaceOf(a)));

/**
 * Where the studio-wide header's "Needs you" leads, and whose count it shows (FB-149).
 *
 * On a phone the rail is hidden, and this header is the only "Needs you" a founder sees. It used to
 * lead to `/attention` — finished work across every venture — and count only that. So a founder with
 * 4 pull requests and 6 sends read 4 in the header and 10 on their own desk.
 *
 * A founder has one venture, so their "Needs you" is that venture's: the same filter the rail's row
 * leads to, and the same number (the caller reads the rail's count for `venture`). Anyone who can
 * see several ventures — an admin — keeps the cross-venture page, because no single venture's list
 * would be an honest destination for them.
 */
export function headerNeedsYou(access: { isAdmin: boolean; ventureIds: readonly string[] }): {
  href: string;
  venture: string | null;
} {
  if (!access.isAdmin && access.ventureIds.length === 1) {
    const id = access.ventureIds[0];
    return { href: `/venture/${id}/tickets?filter=needs`, venture: id };
  }
  return { href: '/attention', venture: null };
}
