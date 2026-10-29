import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadReview } from '@/lib/review-load';
import { ReviewScreen } from '@/components/ReviewScreen';
import { VentureForbidden } from '@/components/VentureForbidden';
import { studiosFonts } from '@/app/fonts/studios';

/**
 * The Review screen (FB-274): one finished piece of work, and the decision on it.
 *
 * It opens from a finished card. A founder sees the change as pictures and a live preview, pins
 * notes on the pictures, and signs it off or sends it back. John sees the same screen with his own
 * parts added (what it cost, what to do next, the run itself) and makes the decision that counts.
 *
 * Isolation is decided here, on the server, before anything is read (CLAUDE.md #6): the venture must
 * be this person's, and the card must be one of this venture's. A card that is not yours gets the
 * same page as one that does not exist. The parts meant for John are removed in `reviewFor`
 * (`lib/review.ts`) before the screen is handed anything, so they never reach a founder's browser.
 *
 * Until the card store lands (FB-275) the cards come from the test rig's files, so outside a test
 * copy every address here answers "That work isn't here".
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string; repo: string; number: string }>;
}) {
  const { id, repo, number } = await params;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const admins = parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS);
  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, admins);
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const view = await loadReview(venture, repo, Number(number), { email, isJohn: access.isAdmin, admins });
  if (!view) return <NotHere ventureId={id} />;

  return (
    <div className={studiosFonts}>
      <ReviewScreen view={view} />
    </div>
  );
}

function NotHere({ ventureId }: { ventureId: string }) {
  return (
    <section data-testid="review-not-here">
      <h1>That work isn’t here</h1>
      <p className="muted" style={{ maxWidth: 'var(--content-narrow)' }}>
        It may have been decided already, or it belongs to a different venture.{' '}
        <Link href={`/venture/${ventureId}/tickets`}>Back to what needs you</Link>.
      </p>
    </section>
  );
}
