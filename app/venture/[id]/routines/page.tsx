import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { GitHubClient } from '@/lib/github';
import { loadRoutines } from '@/lib/routines';
import { fixtureRoutineSource, githubRoutineSource } from '@/lib/routines-load';
import { VentureForbidden } from '@/components/VentureForbidden';
import { RoutinesView } from '@/components/RoutinesView';

/**
 * Recurring work, and who decides it (FB-047).
 *
 * Every venture has had a scheduler since FB-040 and no founder has ever been able to see it. It
 * wakes, it works, and the only evidence is the result. A founder could not say "do this every
 * Monday", could not stop something that was not earning its keep, and could not tell the difference
 * between a routine that was paused and one that had simply run an hour ago.
 *
 * Scoped server-side before anything is fetched, like every other venture route (CLAUDE.md #6).
 */
export default async function RoutinesPage({ params }: { params: Promise<{ id: string }> }) {
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

  const source =
    process.env.ROUTINES_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
      ? fixtureRoutineSource(process.env.ROUTINES_FIXTURE_DIR)
      : githubRoutineSource(new GitHubClient());

  // A venture with no routines and a venture whose records could not be read are different facts,
  // and showing the second as the first is the failure CLAUDE.md #10 exists to prevent. The loader
  // deliberately does not swallow anything but a missing directory, so this catch is the one place
  // that difference gets turned into words.
  let routines: Awaited<ReturnType<typeof loadRoutines>> = [];
  const errors: string[] = [];
  try {
    routines = await loadRoutines(venture, source);
  } catch {
    errors.push('The studio could not read this venture’s records just now.');
  }

  return (
    <>
      <p className="eyebrow">
        <span className="eyebrow-id">Recurring work</span> — {venture.name}
      </p>
      <h1 style={{ marginTop: 0 }}>What happens without you asking</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Work your team does on a schedule. It suggests these; nothing runs until you say so, and you
        can stop any of them at any time.
      </p>

      <hr className="hr" />

      <RoutinesView ventureId={venture.id} routines={routines} errors={errors} />
    </>
  );
}
