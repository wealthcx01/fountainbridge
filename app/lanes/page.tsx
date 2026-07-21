import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';

// Lanes index (FB-006): the accessible ventures and their repos, each a link into the board.
export default async function LanesPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const ventures = loadVentures();
  const access = authorizeVentures(
    session.user.email,
    ventures,
    parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS),
  );
  const visible = ventures.filter((v) => canAccessVenture(access, v.id));

  return (
    <section>
      <p className="eyebrow"><span className="eyebrow-id">Lanes</span> — Foundry Studio</p>
      <h1>Lanes</h1>
      <p className="muted" style={{ maxWidth: '46rem' }}>
        Ticket queues render live from each venture’s <span className="mono">docs/tickets/</span> via
        the GitHub API. Open a venture to see its lanes.
      </p>
      <hr className="hr" />
      <div className="grid" data-testid="lanes-ventures">
        {visible.map((v) => (
          <Link key={v.id} href={`/venture/${v.id}`} className="card card-link" data-testid={`lanes-venture-${v.id}`}>
            <div className="stack">
              <span className="eyebrow-id mono" style={{ fontSize: '12px' }}>{v.id}</span>
              <h3 style={{ margin: '0.1rem 0 0' }}>{v.name}</h3>
              <span className="muted mono" style={{ fontSize: '12px' }}>
                {v.repos.length} repo{v.repos.length === 1 ? '' : 's'}: {v.repos.join(', ') || '—'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
