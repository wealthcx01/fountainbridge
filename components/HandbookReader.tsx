import Link from 'next/link';
import type { HandbookChapter } from '@/lib/handbook';
import { PlaybookProse } from './PlaybookProse';

/**
 * One chapter, at the reading measure (FB-134).
 *
 * ## No heading of its own
 *
 * The chapter's markdown opens with `# Chapter 1 — How to Start`. Adding a title above it would
 * print the name twice, and the alternative — stripping the heading out of the body — is editing the
 * copy, which this ticket forbids and which would be the wrong trade anyway.
 *
 * ## 62 characters
 *
 * `var(--measure)`, the Bruntsfield design system's figure, passed to the shared prose renderer
 * rather than set on it: the playbook keeps the width it has.
 */
export function HandbookReader({
  chapter,
  minutes,
  prev,
  next,
  base,
}: {
  chapter: HandbookChapter;
  minutes: number;
  prev: HandbookChapter | null;
  next: HandbookChapter | null;
  /** `/handbook` or `/venture/<id>/handbook` — a founder reading inside their venture stays there. */
  base: string;
}) {
  return (
    <article data-testid="handbook-chapter">
      <p className="eyebrow">
        <Link href={base} style={{ color: 'inherit' }} data-testid="handbook-back">← Handbook</Link>
      </p>
      <p className="eyebrow" data-testid="handbook-chapter-meta" style={{ marginBottom: '0.75rem' }}>
        <span className="eyebrow-id">Chapter {chapter.order}</span> — {minutes} min read
      </p>

      <PlaybookProse body={chapter.body} measure="var(--measure)" />

      <hr className="hr" />

      <nav style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {prev ? (
          <Link className="pill" href={`${base}/${prev.slug}`} data-testid="handbook-prev">← {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="pill" href={`${base}/${next.slug}`} data-testid="handbook-next">{next.title} →</Link>
        ) : (
          <Link className="btn btn-primary" href={base} data-testid="handbook-done">Back to the handbook →</Link>
        )}
      </nav>
    </article>
  );
}
