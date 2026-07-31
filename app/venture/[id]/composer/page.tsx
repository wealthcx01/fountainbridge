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
export default async function ComposerPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <>
      <p style={{ fontSize: 'var(--fs-body-sm)' }}>
        <Link href={`/venture/${id}`} data-testid="composer-back">← Back to {venture.name}</Link>
      </p>
      {composerEndpoint(venture.vpsHost) ? (
        <Composer ventureId={id} ventureName={venture.name} />
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
