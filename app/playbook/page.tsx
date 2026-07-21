import Link from 'next/link';
import { loadPlaybook } from '@/lib/playbook';

// Public playbook index (FB-013).
export default function PlaybookIndex() {
  const sections = loadPlaybook();
  return (
    <section data-testid="playbook-index">
      <p className="eyebrow"><span className="eyebrow-id">Playbook</span> — Foundry</p>
      <h1>The Foundry Playbook</h1>
      <p className="muted" style={{ maxWidth: '46rem' }}>
        How Bruntsfield builds and sells co-created ventures — the method behind the studio, applying
        Aulet&rsquo;s Disciplined Entrepreneurship and Helmer&rsquo;s 7 Powers in our own voice.
      </p>
      <hr className="hr" />
      <div className="stack" style={{ gap: '0.75rem' }}>
        {sections.map((s) => (
          <Link key={s.slug} href={`/playbook/${s.slug}`} className="card card-link" data-testid={`pb-${s.slug}`}>
            <div className="stack">
              <span className="eyebrow-id mono" style={{ fontSize: '12px' }}>{String(s.order).padStart(2, '0')}</span>
              <h3 style={{ margin: '0.1rem 0 0' }}>{s.title}</h3>
              <span className="muted" style={{ fontSize: '14px' }}>{s.summary}</span>
            </div>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: '2rem' }}>
        <Link className="btn btn-primary" href="/login">Sign in to the studio →</Link>
      </p>
    </section>
  );
}
