import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { adsConnection, readAdsReport, type MetaAdsRaw } from '@/lib/meta-ads';
import example from '@/lib/meta-ads-example.json';
import { AdsReportView } from '@/components/AdsReportView';
import { VentureForbidden } from '@/components/VentureForbidden';
import { Mark } from '@/components/Mark';
import { toneColor } from '@/lib/status';

/**
 * Scale: the venture's ads on Meta, read-only (FB-248).
 *
 * ## Why it shows an example, and how it stops that being a lie
 *
 * No venture has a Meta ad account yet, so there is nothing real to read. A page that said only
 * "not connected" would leave a founder unable to judge whether connecting it is worth the setup;
 * a page that showed sample numbers without saying so would be the worst thing this studio could
 * print — a spend figure that is not theirs. So it does both, in that order: **not connected** first,
 * in the attention colour, naming the venture; then the example, inside its own frame, headed as made
 * up. The example's "now" is pinned to the end of its own period so it reads the same every day.
 *
 * The example is shown to every venture that chooses Meta, so it must not be about any one of them
 * (CLAUDE.md #5): its campaigns are named for what any product does — a waitlist, a guide, a demo —
 * never for what one venture sells.
 *
 * Scoped server-side before anything is read, like every other venture route (CLAUDE.md #6).
 */
export default async function VentureAdsPage({ params }: { params: Promise<{ id: string }> }) {
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

  const connection = adsConnection(venture.departments);

  return (
    <>
      <p className="eyebrow">
        <span className="eyebrow-id">Scale</span> — {venture.name}
      </p>
      <h1 style={{ marginTop: 0 }}>Your ads on Meta</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        What is running on Facebook and Instagram, what it has cost, and what it brought back.
      </p>

      {connection.state === 'not-chosen' ? (
        <p className="card" data-testid="ads-not-chosen" style={{ marginTop: '1.25rem' }}>
          {venture.name} has not chosen where to run ads yet. When it does, this page shows what they
          cost and what they brought back.
        </p>
      ) : (
        <>
          <div className="card" data-testid="ads-not-connected" style={{ marginTop: '1.25rem' }}>
            <p style={{ margin: 0, color: toneColor('attention'), fontWeight: 600 }}>
              <Mark tone="attention" />
              Not connected. {venture.name} has no Meta ad account yet, so nothing on this page is{' '}
              {venture.name}&rsquo;s.
            </p>
            <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--fs-body-sm)' }}>
              Bruntsfield sets up the ad account and links it here. Until then, below is a made-up
              example of what you will see.
            </p>
          </div>

          <section className="ads-example" data-testid="ads-example" aria-label="Example with made-up figures">
            <p className="ads-example-label">Example · made-up figures, not {venture.name}&rsquo;s</p>
            <AdsReportView report={readAdsReport(example as MetaAdsRaw, new Date('2026-09-30T23:59:59Z'))} />
          </section>
        </>
      )}

      <h2 style={{ marginTop: '2rem' }}>What this page can and cannot do</h2>
      <p style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }} data-testid="ads-read-only">
        It only reads. It cannot start, change or pay for an ad. Starting ads is not built yet. When it
        is, your team will suggest a campaign with the money written out in pounds, and nothing is
        spent until that has been approved and the approval recorded.
      </p>
      <p style={{ fontSize: 'var(--fs-body-sm)' }}>
        <Link href={`/venture/${venture.id}`}>Back to your desk</Link>
      </p>
    </>
  );
}
