import Link from 'next/link';
import { welcome, firstName } from '@/lib/firstrun';
import { toneColor } from '@/lib/status';

/**
 * Day one (FB-066).
 *
 * A founder's first ten seconds used to be four empty panels — every sentence well written, and
 * together an argument that the product does nothing. This replaces them with a welcome and
 * **exactly one action**.
 *
 * One, deliberately. A second button here is a choice, and offering a choice to someone who has just
 * arrived at an empty product is asking them to guess what it is for.
 */
export function FirstRun({
  ventureId,
  ventureName,
  founderName,
  hasComposer,
}: {
  ventureId: string;
  ventureName: string;
  founderName: string | null;
  hasComposer: boolean;
}) {
  const w = welcome(ventureName, firstName(founderName), hasComposer);

  return (
    <section data-testid="first-run">
      <p className="eyebrow">
        <span className="eyebrow-id">{ventureId}</span> — Venture
      </p>
      <h1 style={{ margin: '0 0 0.75rem' }}>{w.greeting}</h1>
      <p style={{ fontSize: 'var(--fs-body)', maxWidth: 'var(--content-narrow)', marginTop: 0 }}>
        {w.body}
      </p>

      {w.action ? (
        <p style={{ marginTop: '1.5rem' }}>
          <Link className="btn btn-primary" href={w.action.href(ventureId)} data-testid="first-run-action">
            {w.action.label}
          </Link>
        </p>
      ) : null}

      {w.coming.length > 0 ? (
        <div data-testid="first-run-coming" style={{ marginTop: '1.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.4rem' }}>What will be here</p>
          <ul style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)', margin: 0, paddingLeft: '1.1rem' }}>
            {w.coming.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      ) : null}

      {w.waiting ? (
        <p className="muted" data-testid="first-run-waiting" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
          {w.waiting}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Nothing to show, and a reason to doubt that means nothing is there (FB-066).
 *
 * The counterpart to the welcome, and the reason the two are separate components rather than one
 * with a flag: showing a founder "welcome, nothing here yet" when the studio simply could not read
 * their venture states a fact we do not have. This says what failed instead (CLAUDE.md #10).
 */
export function BoardUnreadable({
  ventureId,
  ventureName,
  reasons,
}: {
  ventureId: string;
  ventureName: string;
  reasons: string[];
}) {
  return (
    <section data-testid="board-unreadable">
      <p className="eyebrow">
        <span className="eyebrow-id">{ventureId}</span> — Venture
      </p>
      <h1 style={{ margin: '0 0 0.5rem' }}>{ventureName}</h1>
      <p style={{ fontSize: 'var(--fs-body)', maxWidth: 'var(--content-narrow)', color: toneColor('attention') }}>
        <span aria-hidden="true">⚠ </span>
        <span className="sr-only">Problem: </span>
        The studio could not read this venture, so this page is empty — that is not the same as
        nothing having happened. Until it can, treat this page as unknown rather than as quiet.
      </p>
      <ul style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        {reasons.map((r, i) => (
          <li key={i} data-testid="board-unreadable-reason">{r}</li>
        ))}
      </ul>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        This is usually the studio&rsquo;s access to GitHub rather than anything wrong with your
        venture. If it does not clear on its own,{' '}
        <Link href={`/venture/${ventureId}?refresh=1`}>refresh</Link> — and tell us if it persists.
      </p>
    </section>
  );
}
