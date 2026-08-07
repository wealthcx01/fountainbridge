import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { approvalRepos } from '@/lib/venture-repos';
import { defaultKnowledgeSource } from '@/lib/knowledge-load';
import type { KnowledgeDoc } from '@/lib/knowledge';
import { VentureForbidden } from '@/components/VentureForbidden';
import { KnowledgeView } from '@/components/KnowledgeView';

/**
 * What your venture knows (FB-106).
 *
 * Documents went in through the composer and then vanished from the founder's view — the only way to
 * see the corpus was GitHub, which is the product this studio exists to replace. Uploading into
 * something you cannot then look at is posting into a void, and a founder who feels that stops
 * uploading, which quietly starves the thing that makes next month's work better.
 *
 * Scoped server-side before anything is fetched, like every other venture route (CLAUDE.md #6).
 */
export default async function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const source = defaultKnowledgeSource();
  const perRepo = await Promise.all(approvalRepos(venture).map((repo) => source(repo)));
  const docs: KnowledgeDoc[] = perRepo.flatMap((r) => r.docs);
  // An unreadable corpus must never render as "you have given it nothing" — the difference between
  // those two is a founder's own work (FB-021, on the surface where it matters most).
  const errors = perRepo.map((r) => r.error).filter((e): e is string => !!e);

  return (
    <>
      <p style={{ fontSize: 'var(--fs-body-sm)' }}>
        <Link href={`/venture/${id}`} data-testid="knowledge-back">← Back to {venture.name}</Link>
      </p>
      <KnowledgeView ventureId={id} ventureName={venture.name} docs={docs} errors={errors} />
    </>
  );
}
