import Link from 'next/link';
import { howLong } from '@/lib/when';
import type { PrApproval } from '@/lib/attention';

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
 */
export function WaitingQueue({ work, ventureId }: { work: PrApproval[]; ventureId: string }) {
  if (work.length === 0) {
    return (
      <p className="muted" data-testid="waiting-queue-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
        Queue clear. Finished work lands here first.
      </p>
    );
  }

  return (
    <ul data-testid="waiting-queue" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {work.map((a) => (
        <li
          key={a.id}
          data-testid={`waiting-${a.repo}-${a.number}`}
          style={{
            display: 'flex', gap: '0.75rem', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '0.55rem 0', borderTop: '1px solid var(--color-border)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="mono" style={{ fontSize: 'var(--fs-meta)' }}>
              {a.linkedTicketId ?? `${a.repo}#${a.number}`}
            </span>{' '}
            {/* The ticket's own title when the work matched one, because that is the name a founder
                knows it by (FB-099). The pull request's title otherwise — never a guess between. */}
            <span>{a.ticketTitle ?? a.title}</span>
          </div>
          {/* FB-138: "Decide →", and it goes to the decision.
           *
           * This link was `?work=<repo>#<number>` — a query parameter **nothing reads**. The desk
           * ignores it, so the row that the amber banner sends a founder to did nothing at all when
           * pressed. The most important link on the screen a founder leaves open, on the queue the
           * whole banner exists to reach.
           *
           * It goes where every other route into a decision goes: the work page, where Approve signs
           * the grant and Refuse takes a note. Same path on a phone as at a desk — a founder who can
           * only READ on mobile stays the bottleneck until they get home. */}
          <span className="muted" style={{ flexShrink: 0, fontSize: 'var(--fs-meta-lg)' }}>
            waiting {howLong(a.createdAt) ?? 'a moment'}{' '}
            <Link
              href={`/venture/${ventureId}/work/${a.repo}/${a.number}`}
              data-testid={`waiting-decide-${a.repo}-${a.number}`}
            >
              Decide →
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
