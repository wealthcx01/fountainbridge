import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadHandbook, minutesToRead } from '@/lib/handbook';
import { HandbookIndex } from '@/components/HandbookIndex';

/**
 * The Founder Handbook, outside a venture (FB-023, restyled FB-134).
 *
 * Middleware gates it; this self-guards too, for defence-in-depth consistency with the rest of the
 * studio. The chapters themselves are untouched — the method is ratified elsewhere and this ticket
 * changes the frame around it, not a word inside it.
 */
export default async function HandbookIndexPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const chapters = loadHandbook().map((c) => ({ ...c, minutes: minutesToRead(c.body) }));
  return <HandbookIndex chapters={chapters} base="/handbook" />;
}
