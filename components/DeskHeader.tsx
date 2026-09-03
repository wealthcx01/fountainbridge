import Link from 'next/link';
import { toneColor } from '@/lib/status';
import type { DegradedGroup } from '@/lib/desk';

/**
 * The top of the desk (FB-128): the sentence, then the banner, then what could not be read.
 *
 * The order is the argument and it is contractual. A founder opening this screen should learn, in
 * this sequence: where things stand, what they are personally blocking, and only then what the
 * studio could not see.
 *
 * **The degraded strip is last, deliberately.** It reports a condition that clears on its own, and a
 * thing that fixes itself must never sit above a thing that does not. Putting it at the top —
 * which is where a status banner instinctively goes — would push the one item a founder is blocking
 * below a sentence telling them there is nothing to do.
 */
export function DeskSummary({ sentence }: { sentence: string }) {
  return (
    <p
      // FB-160: not on a phone. The amber banner directly beneath it already says what a founder is
      // blocking, which is the one thing the design's pocket studio leads with.
      className="not-in-pocket"
      data-testid="desk-summary"
      style={{
        // `--fs-subhead` is 15px — SMALLER than body. It is a label size, and this is the lead
        // sentence of the screen a founder leaves open, so it takes the next real step up.
        fontFamily: 'var(--font-serif)',
        fontSize: 'var(--fs-h4)',
        lineHeight: 1.45,
        margin: '0.4rem 0 1rem',
        maxWidth: 'var(--content-narrow)',
      }}
    >
      {sentence}
    </p>
  );
}

/** The amber banner. Rendered only when something genuinely waits, so it never means nothing. */
export function BlockerBanner({ line, href }: { line: string | null; href: string }) {
  if (!line) {
    return (
      <p className="muted" data-testid="blocker-none" style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 1.25rem' }}>
        Nothing is waiting on you. Your team runs on.
      </p>
    );
  }
  return (
    <p
      className="card"
      data-testid="blocker-banner"
      style={{
        borderColor: toneColor('attention'),
        color: toneColor('attention'),
        fontSize: 'var(--fs-body-sm)',
        margin: '0 0 1.25rem',
        maxWidth: 'var(--content-narrow)',
      }}
    >
      <span aria-hidden="true">⚠ </span>
      <span className="sr-only">Needs you: </span>
      {line}{' '}
      <Link href={href} data-testid="blocker-decide">Decide now →</Link>
    </p>
  );
}

/**
 * What could not be read, grouped by cause.
 *
 * Named as a condition that clears rather than as a failure the founder must chase — because it is
 * one, and because the alternative teaches them to treat every amber thing on this page as noise.
 * Nothing here is swallowed (CLAUDE.md #10); it is placed, which is different.
 */
export function DegradedStrip({ groups, ventureId }: { groups: DegradedGroup[]; ventureId: string }) {
  if (groups.length === 0) return null;
  return (
    <section
      className="card"
      data-testid="degraded-strip"
      style={{ fontSize: 'var(--fs-body-sm)', margin: '1.5rem 0', maxWidth: 'var(--content-narrow)' }}
    >
      <p className="eyebrow" style={{ marginTop: 0 }}>One workstream is catching up</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {groups.map((g) => (
          <li key={g.cause} data-testid="degraded-group" className="muted" style={{ margin: '0 0 0.3rem' }}>
            {g.cause}
            {g.where.length ? <> <span className="mono">({g.where.join(', ')})</span></> : null}
          </li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.5rem 0 0' }}>
        Nothing for you to do; it clears on its own.{' '}
        <Link href={`/venture/${ventureId}?refresh=1`} className="mono" data-testid="degraded-refresh">refresh</Link>
      </p>
    </section>
  );
}
