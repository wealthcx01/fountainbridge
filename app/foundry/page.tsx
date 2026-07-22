import { join } from 'node:path';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadContentSections } from '@/lib/content';
import { PlaybookProse } from '@/components/PlaybookProse';

// The Foundry story (FB-016) — founder-facing narrative, private (FB-015). Rendered from
// content/foundry/*.md so the copy lives in git. DRAFT placeholder copy; replaced in the UI/UX review.
export default async function FoundryPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const sections = loadContentSections(join(process.cwd(), 'content', 'foundry'));

  return (
    <section data-testid="foundry-story">
      <p className="eyebrow"><span className="eyebrow-id">Foundry</span> — Bruntsfield Capital</p>
      {sections.map((s) => (
        <div key={s.slug} data-testid={`foundry-${s.slug}`} style={{ marginBottom: '1rem' }}>
          <PlaybookProse body={s.body} />
        </div>
      ))}
      <hr className="hr" />
      <div className="stack" style={{ gap: '0.75rem', marginBottom: '1.5rem' }} data-testid="foundry-learn-more">
        <Link href="/how-it-works" className="card card-link" data-testid="foundry-to-how-it-works">
          <h3 style={{ margin: 0 }}>How the Foundry works →</h3>
          <span className="muted" style={{ fontSize: '14px' }}>The real machinery — lanes, tickets, gstack, gbrain, ActiveGraph, the approval matrix.</span>
        </Link>
        <Link href="/playbook" className="card card-link" data-testid="foundry-to-playbook">
          <h3 style={{ margin: 0 }}>The Foundry Playbook →</h3>
          <span className="muted" style={{ fontSize: '14px' }}>How we build and sell — Disciplined Entrepreneurship and 7 Powers, applied.</span>
        </Link>
      </div>
      <p><Link className="btn btn-primary" href="/">Open your ventures →</Link></p>
    </section>
  );
}
