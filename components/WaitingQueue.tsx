import Link from 'next/link';
import { howLong } from '@/lib/when';
import { deskQueue } from '@/lib/desk';
import type { PrApproval } from '@/lib/attention';
import type { ActiveGraphApproval } from '@/lib/approvals';

/**
 * Waiting on you (FB-128) — section 7 of the desk.
 *
 * The design's own shape: reference, title, one line of meta, how long it has waited, a way in. It
 * exists because the amber banner has to land somewhere. Before this it linked to an anchor that sat
 * above the external-approval cards alone, so a founder blocking four pull requests — the common
 * case — pressed "Decide now" and was scrolled past the office to an empty space.
 *
 * The rows are compact on purpose. `/attention` renders the same work as full cards with check
 * states and preview links; this is the desk's index of it, and two full renderings of one queue on
 * one screen is how a desk becomes a scroll.
 *
 * ## External sends are rows here too (FB-183)
 *
 * They used to be 282px cards each, in their own section below this one — the largest single thing
 * standing between the desk and its design. The design has no such section: its third waiting row is
 * *"ACT-3 · October investor email to 41 people · Sell · Marketing · external send · waiting 1
 * hour →"*, in this list, beside the pull requests. One queue, because a founder has one queue.
 *
 * The row is a pointer. The decision is made on the page it opens, and nowhere else.
 */
export interface WaitingItem {
  /** React key and test id suffix. */
  key: string;
  testId: string;
  /** `ARCA-5`, `arca#12`, or the send's own id. */
  ref: string;
  title: string;
  /** The surface, and for a send the fact that it leaves the company. Never a repository name. */
  meta: string;
  /** When it started waiting. Null when the studio does not know, which is not "just now". */
  since: string | null;
  href: string;
  /**
   * The loudest thing the studio can say, and it must survive becoming a row (FB-183).
   *
   * `grantProvenance === 'unattested'` means a grant file exists for this send and the studio cannot
   * verify it — a signature that does not check out, of the kind a lane could have written. That is
   * an incident, not a queue item.
   *
   * Turning the desk's cards into rows nearly lost this: the card carried the warning, and the first
   * version of the row carried only the title. A founder would have seen a forged grant as an
   * ordinary line in a list. Distinct from `none`, which is the normal case of nothing signed yet.
   */
  unverified?: boolean;
  /**
   * True for something leaving the company (FB-183), false for finished work waiting to be read.
   *
   * Carried explicitly rather than sniffed from the test id, because `deskQueue` uses it to make
   * sure the desk's cap never erases one whole kind of decision — and a rule that important should
   * not rest on a string prefix.
   */
  external?: boolean;
}

/** A pull request waiting on the founder, as a row. */
export const prWaitingItem = (a: PrApproval, ventureId: string, surface?: string | null): WaitingItem => ({
  key: `${a.repo}#${a.number}`,
  testId: `${a.repo}-${a.number}`,
  ref: a.linkedTicketId ?? `${a.repo}#${a.number}`,
  // The ticket's own title when the work matched one, because that is the name a founder knows it
  // by (FB-099). The pull request's title otherwise — never a guess between.
  title: a.ticketTitle ?? a.title,
  meta: surface ?? 'Your venture',
  since: a.createdAt,
  href: `/venture/${ventureId}/work/${a.repo}/${a.number}`,
  external: false,
});

/**
 * An external send waiting on the founder, as a row (FB-183).
 *
 * `· external send` is not decoration. It is the one thing that tells a founder this row is not
 * their team asking to merge something — it is something leaving their company, and the design puts
 * exactly that phrase on exactly this row.
 */
export const externalWaitingItem = (a: ActiveGraphApproval, ventureId: string, surface?: string | null): WaitingItem => ({
  key: `${a.repo}/${a.id}`,
  testId: `external-${a.repo}-${a.id}`,
  ref: a.ticket ?? a.id,
  title: a.summary,
  meta: `${surface ?? 'Your venture'} · external send`,
  unverified: a.grantProvenance === 'unattested',
  // A proposal carries no time of its own — it is a file a lane wrote, and `lib/approvals` says so
  // where it reads one. So the studio does not know how long this has waited, and the row says
  // "waiting on you" rather than inventing "a moment" for something that may have sat for weeks.
  since: null,
  href: `/venture/${ventureId}/approvals/${a.repo}/${a.id}`,
  external: true,
});

/**
 * How many rows the desk shows (FB-203, item 10).
 *
 * The design caps this at three or four. It is an index, not the queue itself: "Needs you" holds the
 * whole of it, and a desk that lists twenty decisions is a desk a founder scrolls rather than reads.
 * The heading's own link is what carries the rest.
 */
const DESK_ROWS = 4;

export function WaitingQueue({ items, ventureId }: { items: WaitingItem[]; ventureId?: string }) {
  if (items.length === 0) {
    return (
      <p className="muted" data-testid="waiting-queue-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
        Queue clear. Finished work lands here first.
      </p>
    );
  }

  const shown = deskQueue(items, DESK_ROWS);

  return (
    <>
      <ul data-testid="waiting-queue" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {shown.map((it) => (
          <li key={it.key} data-testid={`waiting-${it.testId}`}>
            {/* FB-138 put "Decide →" at the end of the row and FB-203 made the row itself the
                target. The link kept its test id: it is the same door, and it is where the amber
                banner sends a founder, so the specs that press it are pressing the right thing.
    
                The link this replaced was once `?work=<repo>#<number>` — a query parameter nothing
                reads. The most important link on the screen a founder leaves open did nothing at
                all when pressed. It goes where every other route into a decision goes: for work,
                the work page; for a send, its own page, where Approve signs the grant and Refuse
                takes a note. Same path on a phone as at a desk — a founder who can only READ on
                mobile stays the bottleneck until they get home. */}
            <Link className="waiting-row" href={it.href} data-testid={`waiting-decide-${it.testId}`}>
              <span className="mono waiting-ref">{it.ref}</span>
              <span className="waiting-body">
                <span className="waiting-title">{it.title}</span>
                {/* The design puts one line of meta under the title, and it names the surface a
                    founder owns rather than the repository git keeps it in. */}
                <span className="waiting-meta" data-testid={`waiting-${it.testId}-meta`}>{it.meta}</span>
                {it.unverified ? (
                  <span className="waiting-alarm" data-testid={`waiting-${it.testId}-unverified`}>
                    <span aria-hidden="true">⚠ </span>
                    <span className="sr-only">Warning: </span>
                    The studio cannot verify this approval. Open it before anything else.
                  </span>
                ) : null}
              </span>
              <span className="waiting-when">
                {it.since && howLong(it.since) ? `waiting ${howLong(it.since)}` : 'waiting on you'} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Said only when there is more, and it names the number rather than hinting at it. A capped
          list that does not admit it is capped is a list that quietly hides a founder's decisions. */}
      {items.length > shown.length && ventureId ? (
        <p className="muted" data-testid="waiting-queue-more" style={{ fontSize: 'var(--fs-meta)', margin: '0.6rem 0 0' }}>
          <Link href={`/venture/${ventureId}/tickets?filter=needs`}>
            {items.length - shown.length} more waiting on you →
          </Link>
        </p>
      ) : null}
    </>
  );
}
