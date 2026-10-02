/**
 * One line, on every ticket, saying where a founder can see the result (FB-184).
 *
 * ## The question it answers
 *
 * At the end of a piece of work a founder does not ask "was it merged?". They ask **"can I see it?"**
 * This is the studio's one answer to that, worked out in one place so the ticket and its trail cannot
 * give two different answers.
 *
 * ## The rule it keeps
 *
 * **A link is shown only when it has been checked and opens.** A "see it running" that lands on a
 * 404, or quietly on a different site, is worse than no link: it teaches a founder that the studio's
 * promises are decorative. Railway previews did exactly that for weeks (FB-243): every preview
 * redirected to the live site and every health check stayed green.
 *
 * So a preview is never trusted because a deploy reported it. It is opened first
 * (`lib/preview-check.ts`), and the three ways that can come out are three different sentences:
 * it opened, it did not, or the studio did not look. None of the last two carries a link.
 *
 * ## By surface
 *
 * - **Build**: the running preview of the work.
 * - **Sell**: the send's own page — what went out, to whom, and who approved it.
 * - **Scale**: no ad account can be connected yet, so it says so and links nowhere.
 * - **Not started**: "Nothing to follow yet."
 *
 * Pure: the caller does the reading and the checking. This is the part with the cases.
 */

/** What a check of a preview address found. `null` on a ticket that has no preview at all. */
export type PreviewCheck =
  | { url: string; state: 'opens' }
  | { url: string; state: 'does-not-open'; reason: string }
  | { url: string; state: 'not-checked' };

/** The most telling external send tied to the ticket, when there is one. */
export interface SendForTicket {
  /** The send's own page in the studio. */
  href: string;
  status: string;
}

export interface FollowInput {
  /** The department id of the ticket's repository: `build`, `sell`, `scale`, or another. */
  department: string | null;
  /** True when work for this ticket exists — an open pull request carrying it. */
  hasWork: boolean;
  preview: PreviewCheck | null;
  send: SendForTicket | null;
}

export interface FollowLine {
  /** What the line says, in full, with no link in it. */
  text: string;
  /** Present only when the address was checked and opens, or is a page inside the studio. */
  link: { href: string; label: string; external: boolean } | null;
}

/** What each send state means for a founder following it. Said plainly, never as a status word. */
const SEND_WORDS: Record<string, string> = {
  proposed: 'draft, not sent',
  granted: 'approved, not sent yet',
  executing: 'going out now',
  executed: 'sent',
  failed: 'tried, and it did not go',
  rejected: 'refused, so nothing went out',
  'unverified-action': 'recorded as sent, on an approval nobody can name',
};

/** The line for one ticket. Always a sentence; a link only when it will open. */
export function followLine(input: FollowInput): FollowLine {
  // A send is the result, whatever the repository it was proposed from. ARCA proposes its sends from
  // the Build repository, so deciding by the ticket's surface alone would send a founder to a preview
  // of code when what they asked for was an email.
  if (input.send) {
    const words = SEND_WORDS[input.send.status] ?? 'its state is on its page';
    return {
      text: `Follow it to your outbox: ${words}`,
      link: { href: input.send.href, label: 'open it', external: false },
    };
  }

  if (input.department === 'scale') {
    // Nothing in the studio connects an ad account yet. Absent on purpose, and said as absent.
    return { text: 'Follow it to the ad account: not connected yet', link: null };
  }

  if (input.preview) {
    switch (input.preview.state) {
      case 'opens':
        return {
          text: 'Follow it to the preview: running',
          link: { href: input.preview.url, label: 'see it', external: true },
        };
      case 'does-not-open':
        return { text: `Follow it to the preview: it did not open when the studio checked, because ${input.preview.reason}`, link: null };
      case 'not-checked':
        return { text: 'Follow it to the preview: not checked yet, so there is no link', link: null };
    }
  }

  if (input.hasWork) {
    return { text: 'Follow it to the preview: none has been built for this work yet', link: null };
  }

  return { text: 'Nothing to follow yet', link: null };
}

/**
 * The send that best answers "where did it go?" for one ticket.
 *
 * The newest one, because a ticket that was refused and then re-proposed is about the second
 * proposal. Matched by ticket id within the venture, and by the repository or the department, because
 * a send is proposed from one repository and may name another department's ticket.
 */
export function sendForTicket(
  approvals: ReadonlyArray<{ id: string; repo: string; ticket: string | null; department: string | null; status: string; committedAt: string | null }>,
  ticket: { id: string; repo: string; department: string | null },
  hrefFor: (repo: string, id: string) => string,
): SendForTicket | null {
  const mine = approvals.filter((a) =>
    a.ticket === ticket.id && (a.repo === ticket.repo || (a.department !== null && a.department === ticket.department)),
  );
  if (mine.length === 0) return null;
  const newest = [...mine].sort((a, b) => (b.committedAt ?? '').localeCompare(a.committedAt ?? ''))[0];
  return { href: hrefFor(newest.repo, newest.id), status: newest.status };
}

/**
 * Why a checked address is not drawn as a link, in words — or `null` when it opens (FB-184).
 *
 * The other places a founder is offered "see it" — the work page, the cross-venture queue and a
 * surface's door on the desk — use this, so they say the same thing the "Follow it to…" line says
 * and draw a link on exactly the same condition: the address was opened and it worked.
 */
export function whyNoLink(check: PreviewCheck): string | null {
  switch (check.state) {
    case 'opens':
      return null;
    case 'does-not-open':
      return `it did not open when the studio checked, because ${check.reason}`;
    case 'not-checked':
      return 'it has not been checked yet, so there is no link';
  }
}
