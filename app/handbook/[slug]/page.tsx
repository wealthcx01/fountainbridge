import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadHandbook } from '@/lib/handbook';
import { PlaybookProse } from '@/components/PlaybookProse';

// Private Founder Handbook chapter (FB-023). Self-guards in addition to the middleware. Reuses the
// shared prose renderer (PlaybookProse) — no new markdown primitive.
export default async function HandbookChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const { slug } = await params;
  const all = loadHandbook(); // read the content dir once
  const idx = all.findIndex((c) => c.slug === slug);
  const chapter = idx >= 0 ? all[idx] : null;
  if (!chapter) notFound();

  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <article data-testid="handbook-chapter">
      <p className="eyebrow"><Link href="/handbook" style={{ color: 'inherit' }}>← Handbook</Link></p>
      <PlaybookProse body={chapter.body} />
      <hr className="hr" />
      <nav style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {prev ? (
          <Link className="pill" href={`/handbook/${prev.slug}`}>← {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="pill" href={`/handbook/${next.slug}`}>{next.title} →</Link>
        ) : (
          <Link className="btn btn-primary" href="/">Open your ventures →</Link>
        )}
      </nav>
    </article>
  );
}
