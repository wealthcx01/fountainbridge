import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPlaybook } from '@/lib/playbook';
import { PlaybookProse } from '@/components/PlaybookProse';

// Public playbook section (FB-013).
export default async function PlaybookSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = loadPlaybook(); // read the content dir once
  const idx = all.findIndex((s) => s.slug === slug);
  const section = idx >= 0 ? all[idx] : null;
  if (!section) notFound();

  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  return (
    <article data-testid="playbook-section">
      <p className="eyebrow"><Link href="/playbook" style={{ color: 'inherit' }}>← Playbook</Link></p>
      <PlaybookProse body={section.body} />
      <hr className="hr" />
      <nav style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        {prev ? (
          <Link className="pill" href={`/playbook/${prev.slug}`}>← {prev.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className="pill" href={`/playbook/${next.slug}`}>{next.title} →</Link>
        ) : (
          <Link className="btn btn-primary" href="/login">Sign in to the studio →</Link>
        )}
      </nav>
    </article>
  );
}
