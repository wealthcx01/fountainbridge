import Link from 'next/link';
import type { Brief, BriefLine } from '@/lib/brief';
import { toneColor } from '@/lib/status';

/**
 * The founder brief (FB-042, recomposed FB-104) — where the venture stands, at the top of the board.
 *
 * Deliberately the first thing on the page and deliberately prose. Everything below it is a
 * dashboard, and a dashboard tells you what exists without telling you what to do about it. The
 * ordering is decided in lib/brief.ts and this component does not re-sort: two places deciding what
 * matters most is how a headline ends up disagreeing with the list beneath it.
 *
 * FB-104 made every sentence a way in rather than a report. A summary that states a number a founder
 * then has to go and find is a summary that costs them a search — so the number is the link.
 */
export function FounderBrief({ brief }: { brief: Brief }) {
  return (
    <section
      className="card"
      data-testid="founder-brief"
      data-degraded={brief.degraded ? 'true' : 'false'}
      style={{ marginBottom: '1.25rem' }}
      aria-label="Where this venture stands"
    >
      <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>Where things stand</p>
      <p
        data-testid="brief-headline"
        style={{ fontSize: 'var(--fs-subhead)', fontWeight: 600, margin: '0 0 0.6rem', maxWidth: 'var(--content-narrow)' }}
      >
        <Expanded href={brief.headlineHref}>{brief.headline}</Expanded>
      </p>
      <ul data-testid="brief-lines" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {brief.lines.map((line, i) => (
          <li
            key={i}
            data-tone={line.tone}
            style={{
              fontSize: 'var(--fs-body-sm)',
              margin: '0 0 0.3rem',
              maxWidth: 'var(--content-narrow)',
              color: line.tone === 'blocked' || line.tone === 'attention' ? toneColor(line.tone) : undefined,
              fontWeight: line.tone === 'blocked' ? 600 : undefined,
            }}
          >
            {/* The glyph is decorative and the word beside it is not: a state carried only by colour
                or a symbol is a state a screen-reader user does not get (the design contract). */}
            <span aria-hidden="true">{GLYPH[line.tone]} </span>
            <span className="sr-only">{LABEL[line.tone]}: </span>
            <Expanded href={line.href}>{line.text}</Expanded>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A sentence that knows where it is expanded — or, when it does not, plain text.
 *
 * The honesty line is the one that never links, because there is nowhere to send someone whose
 * meaning is "the studio could not read part of this". A link that goes nowhere useful is worse than
 * no link: it teaches the founder that the brief's links are decoration.
 *
 * Anchors on this page are `<a>`; other surfaces are Next links, so the queue is prefetched by the
 * time the founder decides to open it.
 */
function Expanded({ href, children }: { href?: string; children: BriefLine['text'] }) {
  if (!href) return <>{children}</>;
  if (href.startsWith('#')) return <a className="quiet-link" href={href}>{children}</a>;
  return <Link className="quiet-link" href={href}>{children}</Link>;
}

const GLYPH: Record<string, string> = { attention: '●', blocked: '▲', working: '◐', ok: '✓', idle: '○' };
const LABEL: Record<string, string> = {
  attention: 'Needs you', blocked: 'Stopped', working: 'Running', ok: 'Done', idle: 'Nothing yet',
};
