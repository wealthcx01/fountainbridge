import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadHandbook, minutesToRead } from '@/lib/handbook';
import { HandbookIndex } from '@/components/HandbookIndex';
import { VentureForbidden } from '@/components/VentureForbidden';

/**
 * The handbook, inside a venture (FB-124, FB-134).
 *
 * The content is unchanged and deliberately NOT per-venture: the method is one method across every
 * venture, and a per-venture copy is per-venture drift. FB-134 settles that against the design's
 * phrasing.
 *
 * ## Why this is a page now rather than a re-export
 *
 * It re-exported `app/handbook/page.tsx`, which meant every chapter link pointed at `/handbook` —
 * outside the rail. A founder opening chapter three from their desk lost their desk. The links take
 * a base now, and the venture keeps its own.
 *
 * It also guards its own venture, like every other route under `/venture/[id]`. The layout guards it
 * too; two checks that agree cost nothing and one missing check costs a founder another venture's
 * data (CLAUDE.md #6).
 */
export default async function VentureHandbookPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const { id } = await params;
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const chapters = loadHandbook().map((c) => ({ ...c, minutes: minutesToRead(c.body) }));
  return <HandbookIndex chapters={chapters} base={`/venture/${id}/handbook`} />;
}
