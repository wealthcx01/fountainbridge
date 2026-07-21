import Link from 'next/link';
import { PlaybookProse } from './PlaybookProse';
import type { PlaybookSection } from '@/lib/playbook';

// Public landing (FB-013): a warm educational soft-intro (the playbook introduction) with the studio
// sign-in as the primary CTA. The product is the focus; this is the on-ramp. Signed-out visitors see
// this at `/`; no venture data is ever rendered here.
export function Landing({ sections }: { sections: PlaybookSection[] }) {
  const intro = sections.find((s) => s.slug === 'introduction');
  const chapters = sections.filter((s) => s.slug !== 'introduction');

  return (
    <div data-testid="landing">
      <section style={{ padding: '1.5rem 0 1rem' }}>
        <p className="eyebrow"><span className="eyebrow-id">Foundry</span> — Bruntsfield Capital</p>
        <h1 style={{ fontSize: 'var(--fs-h1)', maxWidth: '20ch' }}>Companies, co-created and run in the open.</h1>
        <p className="muted" style={{ fontSize: '18px', maxWidth: '42rem' }}>
          The Foundry Studio is where Bruntsfield builds and runs co-created ventures — agent lanes doing
          the work, humans holding the gates, git remembering everything. Below is the method behind it.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" href="/login" data-testid="cta-signin">Sign in to the studio →</Link>
          <Link className="btn" href="/playbook" data-testid="cta-playbook">Read the playbook</Link>
        </div>
      </section>

      <hr className="hr" />

      {intro ? (
        <section data-testid="landing-intro">
          <PlaybookProse body={intro.body} />
        </section>
      ) : null}

      <div className="grid" data-testid="landing-chapters" style={{ marginTop: '2rem' }}>
        {chapters.map((s) => (
          <Link key={s.slug} href={`/playbook/${s.slug}`} className="card card-link" data-testid={`chapter-${s.slug}`}>
            <div className="stack">
              <span className="eyebrow-id mono" style={{ fontSize: '12px' }}>{String(s.order).padStart(2, '0')}</span>
              <h3 style={{ margin: '0.1rem 0 0' }}>{s.title}</h3>
              <span className="muted" style={{ fontSize: '14px' }}>{s.summary}</span>
            </div>
          </Link>
        ))}
      </div>

      <hr className="hr" />

      <section style={{ textAlign: 'center', padding: '1rem 0 2rem' }}>
        <p className="muted">The playbook is the introduction. The studio is where the work happens.</p>
        <Link className="btn btn-primary" href="/login">Sign in to the studio →</Link>
      </section>
    </div>
  );
}
