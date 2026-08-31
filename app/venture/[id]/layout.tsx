import { Suspense } from 'react';
import { auth } from '@/auth';
import { loadVentures, type VentureSummary } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { loadRailData } from '@/lib/rail';
import { Rail } from '@/components/Rail';
import { VentureForbidden } from '@/components/VentureForbidden';

/**
 * The venture shell (FB-124).
 *
 * Every screen under a venture renders inside this, which is what turns the studio from a set of
 * pages into a desk a founder keeps open.
 *
 * ## Why the guard is here as well as on every page
 *
 * It is not redundant. A layout renders for **every** child route, including ones added later by
 * someone who forgets — and venture isolation is server-side and absolute (CLAUDE.md #6). Guarding
 * here means a new route under `/venture/[id]` is scoped before its author writes a line. The pages
 * keep their own guards; two checks that agree cost nothing, and one missing check costs a founder
 * another venture's data.
 *
 * ## Why the rail loads its own data
 *
 * A layout cannot receive data from its page. `loadRailData` is wrapped in React `cache()`, so the
 * layout and the page share one fetch per request rather than making two — the FB-123 failure was
 * exactly this shape, many reads nobody had counted.
 *
 * ## Why the rail's numbers stream (FB-151)
 *
 * Measured on production, three loads each, median time to first byte: `/admin/timing` — signed in,
 * the whole root layout, no rail — answers in **224 ms**. `/venture/arca/handbook`, which is static
 * markdown under this layout, takes **5,333 ms**. The difference between those two numbers is this
 * layout awaiting `loadRailData`, and it was doing it on every screen under a venture.
 *
 * So the shell renders immediately and the numbers arrive after. The reads are unchanged — same
 * calls, same per-request `cache()`, same FB-083 budget. What changed is that a founder opening
 * their handbook is not waiting on their approval history to be read first.
 *
 * The fallback is the SAME `<Rail>` with `data={null}`, not a second implementation of it. A rail
 * that renders before it knows says so — "checking", no badge — rather than showing a zero, which
 * on the most-seen surface in the product would be believed everywhere (FB-124).
 */
export default async function VentureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return <>{children}</>; // middleware redirects; never render a rail for nobody.

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    // Refused without a rail: the rail carries this venture's numbers, and drawing it around a
    // refusal would leak the shape of what was refused.
    return <VentureForbidden ventureId={id} exists={Boolean(venture)} />;
  }

  const shell = {
    ventureId: venture.id,
    ventureName: venture.name,
    ventureStatus: venture.status,
    departmentIds: venture.departments.map((d) => d.id),
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh' }}>
      <Suspense fallback={<Rail {...shell} data={null} />}>
        <RailWithNumbers venture={venture} shell={shell} />
      </Suspense>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}

/**
 * The rail once its numbers are in.
 *
 * A separate async component purely so the `<Suspense>` above has something to wait on: a layout
 * that awaits inline has nothing to stream around, which is how this cost ended up on every screen.
 */
async function RailWithNumbers({
  venture,
  shell,
}: {
  venture: VentureSummary;
  shell: { ventureId: string; ventureName: string; ventureStatus: string; departmentIds: string[] };
}) {
  const data = await loadRailData(venture, Date.now());
  return <Rail {...shell} data={data} />;
}
