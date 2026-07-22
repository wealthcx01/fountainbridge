import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadSystem } from '@/lib/system';
import { PlaybookProse } from '@/components/PlaybookProse';

// Private "How the Foundry works" section (FB-017). Self-guards in addition to the middleware.
export default async function HowItWorksSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const { slug } = await params;
  const all = loadSystem(); // read the content dir once
  const idx = all.findIndex((s) => s.slug === slug);
  const section = idx >= 0 ? all[idx] : null;
  if (!section) notFound();

  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <article data-testid="how-it-works-section">
      <p className="eyebrow"><Link href="/how-it-works" style={{ color: 'inherit' }}>← How it works</Link></p>
      <PlaybookProse body={section.body} />
      <hr className="hr" />
      <nav style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {prev ? (
          <Link className="pill" href={`/how-it-works/${prev.slug}`}>← {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="pill" href={`/how-it-works/${next.slug}`}>{next.title} →</Link>
        ) : (
          <Link className="btn btn-primary" href="/">Open your ventures →</Link>
        )}
      </nav>
    </article>
  );
}
