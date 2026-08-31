import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadHandbook, minutesToRead } from '@/lib/handbook';
import { HandbookReader } from '@/components/HandbookReader';
import { VentureForbidden } from '@/components/VentureForbidden';

/** A handbook chapter inside the venture shell (FB-124, FB-134). Same content, same copy. */
export default async function VentureHandbookChapterPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const { id, slug } = await params;
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const all = loadHandbook();
  const idx = all.findIndex((c) => c.slug === slug);
  if (idx < 0) notFound();

  return (
    <HandbookReader
      chapter={all[idx]}
      minutes={minutesToRead(all[idx].body)}
      prev={idx > 0 ? all[idx - 1] : null}
      next={idx < all.length - 1 ? all[idx + 1] : null}
      base={`/venture/${id}/handbook`}
    />
  );
}
