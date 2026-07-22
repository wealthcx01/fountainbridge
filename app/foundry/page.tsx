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
      <p><Link className="btn btn-primary" href="/">Open your ventures →</Link></p>
    </section>
  );
}
