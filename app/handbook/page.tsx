import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadHandbook } from '@/lib/handbook';

// Private Founder Handbook index (FB-023). Middleware gates it; this self-guards too, for
// defense-in-depth consistency with the rest of the studio. Renders whatever chapters are present.
export default async function HandbookIndex() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const chapters = loadHandbook();
  return (
    <section data-testid="handbook-index">
      <p className="eyebrow"><span className="eyebrow-id">Handbook</span> — Foundry</p>
      <h1>The Founder Handbook</h1>
      <p className="muted" style={{ maxWidth: '46rem' }}>
        Your plain-English guidebook — how to start, build, sell, and scale your venture, and how
        Bruntsfield works alongside you. Read it in order, or dip into the chapter you need.
      </p>
      {/* FB-067: the Foundry story and the playbook left the header — they are things you read
          once, not places you work. They live here, where a founder already comes to read. */}
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: '46rem' }}>
        Also here: <Link href="/playbook" data-testid="handbook-playbook">the playbook</Link> — the
        methods behind how work gets shaped — and{' '}
        <Link href="/foundry" data-testid="handbook-foundry">how the Foundry works</Link>.
      </p>
      <hr className="hr" />
      <div className="stack" style={{ gap: '0.75rem' }}>
        {chapters.map((c) => (
          <Link key={c.slug} href={`/handbook/${c.slug}`} className="card card-link" data-testid={`hb-${c.slug}`}>
            <div className="stack">
              <span className="eyebrow-id mono" style={{ fontSize: 'var(--fs-meta)' }}>Chapter {c.order}</span>
              <h3 style={{ margin: '0.1rem 0 0' }}>{c.title}</h3>
              <span className="muted" style={{ fontSize: 'var(--fs-body-sm)' }}>{c.summary}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
