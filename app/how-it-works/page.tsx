import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadSystem } from '@/lib/system';

// Private "How the Foundry works" index (FB-017). Middleware gates it; this self-guards too, for
// defense-in-depth consistency with the rest of the studio.
export default async function HowItWorksIndex() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const sections = loadSystem();
  return (
    <section data-testid="how-it-works-index">
      <p className="eyebrow"><span className="eyebrow-id">How it works</span> — Foundry</p>
      <h1>How the Foundry works</h1>
      <p className="muted" style={{ maxWidth: '46rem' }}>
        The real machinery behind the studio — how a venture actually gets built and sold, our way.
        Written plainly, and accurate to how it runs. Each part is its own page; the system grows, and
        so does this.
      </p>
      <hr className="hr" />
      <div className="stack" style={{ gap: '0.75rem' }}>
        {sections.map((s) => (
          <Link key={s.slug} href={`/how-it-works/${s.slug}`} className="card card-link" data-testid={`sys-${s.slug}`}>
            <div className="stack">
              <span className="eyebrow-id mono" style={{ fontSize: '12px' }}>{String(s.order).padStart(2, '0')}</span>
              <h3 style={{ margin: '0.1rem 0 0' }}>{s.title}</h3>
              <span className="muted" style={{ fontSize: '14px' }}>{s.summary}</span>
            </div>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: '2rem' }}>
        <Link className="pill" href="/playbook">The Foundry Playbook →</Link>
      </p>
    </section>
  );
}
