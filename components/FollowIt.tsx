import Link from 'next/link';
import type { FollowLine } from '@/lib/result-link';

/**
 * "Follow it to…" — the one line on a ticket that says where to see the result (FB-184).
 *
 * The design's words and weight (R-04): one line, 13px, sans, 600, in the accent colour, directly
 * above "Your decision". The link is drawn only when `followLine` gave one, which it does only for an
 * address that was checked and opens, or for a page inside the studio. `↗` leaves the studio and `→`
 * stays in it, the same rule as the trail.
 */
export function FollowIt({ line }: { line: FollowLine }) {
  return (
    <p
      data-testid="detail-follow"
      data-linked={line.link ? 'true' : 'false'}
      style={{
        margin: '1.25rem 0 0',
        fontSize: 'var(--fs-meta-lg)',
        fontWeight: 600,
        color: 'var(--color-accent)',
      }}
    >
      {line.text}
      {line.link ? (
        <>
          {' · '}
          {line.link.external ? (
            <a href={line.link.href} target="_blank" rel="noreferrer" data-testid="detail-follow-link">
              {line.link.label} ↗
            </a>
          ) : (
            <Link href={line.link.href} data-testid="detail-follow-link">{line.link.label} →</Link>
          )}
        </>
      ) : null}
    </p>
  );
}
