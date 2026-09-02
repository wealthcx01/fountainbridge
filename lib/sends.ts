/**
 * What happened to what went out (FB-142, gap G2).
 *
 * ## The loop this closes, and the half of it that cannot be closed
 *
 * The studio's hardest gate is on sending: nothing leaves the building without a signed approval
 * (CLAUDE.md #4). A founder approves a send, it goes, and then the studio never mentions it again.
 * Someone asked to keep making a decision with no feedback stops reading it, and the gate becomes a
 * rubber stamp.
 *
 * The design's line is *"Last send: 41 delivered · 29 opened · 3 replied"*. **Two of those three
 * numbers cannot be obtained**, and this module exists to say so rather than to invent them.
 *
 * ## Why, in one paragraph — the provider decision the ticket asked for
 *
 * `docs/research-gtm.md` §7 is ratified and it settles this without naming a service: sends go from
 * **the venture's own Google Workspace**, on a venture-owned domain, with SPF/DKIM/DMARC aligned,
 * through an internal-user-type OAuth app on `gmail.send` where that is sufficient. There is no
 * third-party email service in the architecture, and adding one would break its premise — a
 * different sending domain, alignment redone, and the founder's own identity no longer the sender.
 * So: **the Gmail API, no ESP.** That is the decision, and it follows from the research rather than
 * from whichever SDK someone installs first.
 *
 * The consequence is the finding:
 *
 * - **Sent** — known. The API returns a message id. That is the whole of what it reports.
 * - **Delivered** — *not* known. Acceptance by Gmail for delivery is not delivery, and calling it
 *   that would be the overstatement this studio refuses everywhere else. Bounces arrive as a message
 *   in the mailbox, which needs a read scope we do not have and would not casually take.
 * - **Opened** — obtainable only with a tracking pixel, which the ratified posture argues against
 *   (interest-based, consent-first, one-click unsubscribe) and which Apple's Mail Privacy Protection
 *   has made close to meaningless anyway.
 * - **Replied** — visible only by reading the founder's mailbox: `gmail.readonly` is a restricted
 *   scope requiring CASA verification, and it is a large thing to take in order to render a number.
 *
 * `docs/decision-surface-outcomes.md` said Sell's numbers *"arrive free with FB-142 because the
 * provider reports them."* That was written before the provider question was settled, and it is
 * wrong. Corrected there.
 *
 * ## So what this reports
 *
 * What the studio genuinely holds: that a send was approved, that it went, when, and what it was.
 * That is the feedback the gate actually needs — *the thing you approved on Tuesday went out* — and
 * it is true.
 */

import type { ActiveGraphApproval } from './approvals';
import { howLong } from './when';

/** One send the studio can speak about. */
export interface Send {
  id: string;
  repo: string;
  /** What the founder approved, in the words they approved it in. */
  summary: string;
  /** When it went, or when it was recorded. Null when the record carries no time. */
  at: string | null;
  /** `sent` went out; `failed` did not; `unverified` went out on a grant that does not verify. */
  outcome: 'sent' | 'failed' | 'unverified';
}

/** Only approvals that are actually sends. A post is not a send and must not be counted as one. */
const isSend = (a: ActiveGraphApproval): boolean => a.actionType === 'send';

/**
 * Every send this venture has made, newest first.
 *
 * Includes failures and unverified actions deliberately. A send that failed is the single most
 * important thing on this surface — FB-058's rule, and CLAUDE.md #10's — and a "last send" line that
 * quietly skipped to the last *successful* one would hide exactly the event a founder must see.
 */
export function sends(approvals: readonly ActiveGraphApproval[]): Send[] {
  return approvals
    .filter(isSend)
    .filter((a) => a.status === 'executed' || a.status === 'failed' || a.status === 'unverified-action')
    .map((a) => ({
      id: a.id,
      repo: a.repo,
      summary: a.summary,
      at: a.committedAt,
      outcome:
        a.status === 'executed' ? ('sent' as const)
          : a.status === 'failed' ? ('failed' as const)
            : ('unverified' as const),
    }))
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''));
}

export const lastSend = (approvals: readonly ActiveGraphApproval[]): Send | null =>
  sends(approvals)[0] ?? null;

/**
 * The Sell surface's line on the desk.
 *
 * Says what went and when — and says plainly that what happened next is not reported, rather than
 * printing a zero for it. `docs/decision-surface-outcomes.md`'s rule: sourced or silent.
 */
export function sellOutcome(send: Send | null, ticketCount: number): string {
  const tickets = ticketCount === 0 ? 'No tickets yet' : `${ticketCount} ticket${ticketCount === 1 ? '' : 's'}`;
  if (!send) {
    return `${tickets}. Nothing has been sent yet — the first send appears here once you approve one.`;
  }

  const when = send.at ? (howLong(send.at) ? `${howLong(send.at)} ago` : 'recently') : 'at an unrecorded time';

  if (send.outcome === 'failed') {
    return `Last send did not go out: ${send.summary} (${when}). Nothing left the building.`;
  }
  if (send.outcome === 'unverified') {
    return `Last send went out ${when} — ${send.summary} — on an approval the studio cannot verify.`;
  }
  // What happened after it left is genuinely unknown, and the sentence says which part is which.
  return `Last send: ${send.summary}, ${when}. Whether it was opened or replied to is not reported.`;
}

/**
 * The venture's own outbox — the design's *"Open your outbox ↗"*.
 *
 * Gmail's own sent view for the identity the send went from. A reference, not a route through: the
 * studio does not read the mailbox (see the header on why), so this is the one place a founder can
 * see the message itself.
 *
 * Null without a workspace address, rather than a link that lands on somebody's personal inbox.
 */
export function outboxUrl(founderEmail: string | null): string | null {
  const email = founderEmail?.trim();
  if (!email || !email.includes('@')) return null;
  return `https://mail.google.com/mail/u/${encodeURIComponent(email)}/#sent`;
}
