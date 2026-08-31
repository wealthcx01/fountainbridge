import Link from 'next/link';
import type { HandbookChapter } from '@/lib/handbook';

/**
 * The handbook's chapter grid (FB-134), inside a venture or outside one.
 *
 * ## Why it takes a `base`
 *
 * The same handbook is reachable at `/handbook` and at `/venture/<id>/handbook`, and it must not
 * send a founder out of their venture to read it. The venture route used to re-export the global
 * page, which meant every chapter link, the back link and the prev/next pair pointed at `/handbook`
 * — outside the rail. A founder reading chapter three lost their desk to get to chapter four.
 *
 * ## Three across, on purpose
 *
 * Nine chapters, a 3×3. `.grid-3` rather than the auto-filling `.grid`, which gives four columns in
 * a wide window and breaks the shape into 4/4/1.
 */
export function HandbookIndex({
  chapters,
  base,
}: {
  chapters: Array<HandbookChapter & { minutes: number }>;
  /** Where a chapter link goes: `/handbook` or `/venture/<id>/handbook`. */
  base: string;
}) {
  return (
    <section data-testid="handbook-index">
      <p className="eyebrow"><span className="eyebrow-id">Handbook</span> — the method</p>
      <h1 style={{ margin: '0 0 0.5rem' }}>Handbook</h1>
      {/* The design's line, minus its claim that this is "rendered from the venture repo". It is
          not: the method is one method across every venture and lives in the studio. FB-134 settles
          that, and a sentence on screen is not the place to keep an aspiration. */}
      <p className="muted" style={{ maxWidth: 'var(--content-narrow)', fontSize: 'var(--fs-body-sm)' }}>
        How we start, build, sell and scale: the method your team already follows.
      </p>
      {/* FB-067: the Foundry story and the playbook left the header — they are things you read
          once, not places you work. They live here, where a founder already comes to read. */}
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Also here: <Link href="/playbook" data-testid="handbook-playbook">the playbook</Link> — the
        methods behind how work gets shaped — and{' '}
        <Link href="/foundry" data-testid="handbook-foundry">how the Foundry works</Link>.
      </p>

      <hr className="hr" />

      <div className="grid-3" data-testid="handbook-grid">
        {chapters.map((c) => (
          <Link key={c.slug} href={`${base}/${c.slug}`} className="card card-link" data-testid={`hb-${c.slug}`}>
            <span className="eyebrow-id mono" style={{ fontSize: 'var(--fs-meta)' }}>Chapter {c.order}</span>
            <h3 style={{ margin: '0.25rem 0 0.35rem', fontSize: 'var(--fs-h4)' }}>{c.title}</h3>
            <span className="muted mono" data-testid={`hb-${c.slug}-minutes`} style={{ fontSize: 'var(--fs-meta)' }}>
              {c.minutes} min read
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
