import { Suspense } from 'react';
import Link from 'next/link';
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

  // FB-136: Bruntsfield looking at a founder's venture sees the founder's exact desk — same
  // components, same data path — with a persistent way back and a line saying whose screen this is.
  // Shown only when the viewer is NOT this venture's founder: John opening his own venture is not
  // "seeing what a founder sees", he is the founder.
  const asFounder =
    access.isAdmin &&
    (!venture.founderEmail || venture.founderEmail.toLowerCase() !== email.toLowerCase());

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh' }}>
      <Suspense fallback={<Rail {...shell} data={null} />}>
        <RailWithNumbers venture={venture} shell={shell} />
      </Suspense>
      <main style={{ flex: 1, minWidth: 0 }}>
        {asFounder ? <AsFounderStrip ventureName={venture.name} /> : null}
        {children}
      </main>
    </div>
  );
}

/**
 * The strip an admin reads over a founder's desk (FB-136).
 *
 * It says what this screen is, because the whole point of "Open as founder" is that it is NOT an
 * admin view of a venture — it is the founder's own screen, from the same components and the same
 * data path. Someone diagnosing a founder's problem has to be looking at the founder's problem.
 *
 * Persistent rather than a one-time banner: an admin three screens deep into someone else's venture
 * needs the way back to still be there, and needs to still know whose desk they are on.
 */
function AsFounderStrip({ ventureName }: { ventureName: string }) {
  return (
    <div
      data-testid="as-founder-strip"
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.5rem 2.25rem',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-paper-sunken)',
        fontSize: 'var(--fs-meta-lg)',
      }}
    >
      <Link href="/" data-testid="as-founder-back">← All ventures</Link>
      {/* copy-lint-ok: admin-only — a founder never sees this strip */}
      <span className="muted">
        You are seeing exactly what {ventureName}&rsquo;s founder sees.
      </span>
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
