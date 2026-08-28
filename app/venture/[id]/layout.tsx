import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
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

  const data = await loadRailData(venture, Date.now());

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh' }}>
      <Rail
        ventureId={venture.id}
        ventureName={venture.name}
        ventureStatus={venture.status}
        data={data}
        departmentIds={venture.departments.map((d) => d.id)}
      />
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
