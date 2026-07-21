import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';

// The Ventures home. Server-rendered: authenticate, then scope the venture list server-side
// (CLAUDE.md #6 — isolation is never UI-only) before anything is shown.
export default async function VenturesHome() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const ventures = loadVentures();
  const access = authorizeVentures(
    session.user.email,
    ventures,
    parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS),
  );
  if (access.ventureIds.length === 0) redirect('/not-authorized');

  const visible = ventures.filter((v) => access.isAdmin || access.ventureIds.includes(v.id));

  return (
    <section>
      <p className="eyebrow">
        <span className="eyebrow-id">Ventures</span> — {access.isAdmin ? 'All ventures (Bruntsfield)' : 'Your venture'}
      </p>
      <h1>Foundry Studio</h1>
      <p className="muted" style={{ maxWidth: '46rem' }}>
        Signed in as <span className="mono">{session.user.email}</span>. Configure and run co-created
        ventures. Each venture is a manifest; the studio renders lanes, tickets and approvals from git.
      </p>
      <hr className="hr" />
      <div className="grid" data-testid="venture-grid">
        {visible.map((v) => (
          <Link key={v.id} href={`/venture/${v.id}`} className="card card-link" data-testid={`venture-${v.id}`}>
            <div className="stack">
              <span className="eyebrow-id mono" style={{ fontSize: '12px' }}>{v.id}</span>
              <h3 style={{ margin: '0.1rem 0 0' }}>{v.name}</h3>
              <span className={`tag ${v.status === 'active' ? 'tag-accent' : ''}`}>{v.status}</span>
              {v.founderName ? <span className="muted" style={{ fontSize: '14px' }}>Founder: {v.founderName}</span> : null}
              <span className="muted mono" style={{ fontSize: '12px' }}>
                {v.repos.length} repo{v.repos.length === 1 ? '' : 's'}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
