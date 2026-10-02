import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadPipeline } from '@/lib/crm-load';
import { studioNow } from '@/lib/when';
import { VentureForbidden } from '@/components/VentureForbidden';
import { SellView } from '@/components/SellView';

/**
 * The Sell surface: who this venture is selling to, and who needs the founder now (FB-235).
 *
 * Scoped twice, like every venture route: here, before anything is read, and again by the database,
 * whose row-level policies return only this venture's pipeline (FB-234, CLAUDE.md #6).
 */
export const dynamic = 'force-dynamic';

export default async function SellPage({ params }: { params: Promise<{ id: string }> }) {
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

  const read = await loadPipeline(venture.id);
  return <SellView ventureId={venture.id} ventureName={venture.name} read={read} nowMs={studioNow()} />;
}
