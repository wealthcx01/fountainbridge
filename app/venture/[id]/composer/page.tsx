import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { composerEndpoint } from '@/lib/composer';
import { Composer } from '@/components/Composer';
import { VentureForbidden } from '@/components/VentureForbidden';

/**
 * The composer, inside the studio shell (FB-065).
 *
 * The route that ends the second product. Scoping is enforced here before the page renders and again
 * in the API route the surface calls — a founder scoped to one venture can neither see nor address
 * another's composer (CLAUDE.md #6).
 */
export default async function ComposerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // FB-105: arriving from a ticket. The drawer's "Ask for changes to this" opens the composer with
  // the first words already written, so changing the ask is a sentence rather than a git edit — and
  // it still goes through the one write path that is already gated.
  const query = await searchParams;
  const about = query?.about;
  const ticketId = typeof about === 'string' && /^[A-Za-z][\w-]{0,40}$/.test(about) ? about : null;
  // FB-128: arriving from the desk's prompt bar, with the founder's own words already typed. Capped
  // and stripped of control characters — it is a URL, so it is somebody's input until it is checked,
  // and it lands in a textarea a founder is about to send.
  const askRaw = query?.ask;
  const ask = typeof askRaw === 'string' ? askRaw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500) : '';

  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  return (
    <>
      <p style={{ fontSize: 'var(--fs-body-sm)' }}>
        <Link href={`/venture/${id}`} data-testid="composer-back">← Back to {venture.name}</Link>
      </p>
      {composerEndpoint(venture.vpsHost) ? (
        <Composer
          ventureId={id}
          ventureName={venture.name}
          seed={ticketId ? `About ${ticketId}: ` : ask || null}
          aboutTicketId={ticketId}
        />
      ) : (
        <section data-testid="composer-pending">
          <p className="eyebrow"><span className="eyebrow-id">Composer</span> — {venture.name}</p>
          <h1 style={{ margin: '0 0 0.5rem' }}>Not ready yet</h1>
          <p className="muted" style={{ maxWidth: 'var(--content-narrow)' }}>
            Describing what you want in plain English — and having it become real work — needs this
            venture’s own box. It will appear here as soon as that is set up.
          </p>
        </section>
      )}
    </>
  );
}
