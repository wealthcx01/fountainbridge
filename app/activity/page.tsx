import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadAccessibleHealth, type RepoHealth, type ActivityEvent } from '@/lib/health';

// CI/lane health + activity feed (FB-008). Scoped server-side. Filterable by repo via ?repo=.
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ refresh?: string; repo?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');
  const { refresh, repo: repoFilter } = await searchParams;
  const { ventures, activity } = await loadAccessibleHealth(session.user.email, { refresh: refresh === '1' });

  const allRepos = ventures.flatMap((v) => v.health.repos.map((r) => r.repo));
  const events = repoFilter ? activity.filter((e) => e.repo === repoFilter) : activity;

  return (
    <section>
      <p className="eyebrow"><span className="eyebrow-id">Activity</span> — Foundry Studio</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>CI &amp; activity</h1>
        <Link href="/activity?refresh=1" className="mono muted" data-testid="activity-refresh" style={{ fontSize: '13px' }}>refresh</Link>
      </div>

      <hr className="hr" />

      {/* Per-repo health strips */}
      {ventures.map((v) => (
        <div key={v.id} style={{ marginBottom: '2rem' }} data-testid={`health-venture-${v.id}`}>
          <h3 className="mono" style={{ fontSize: '15px' }}>{v.name} <span className="muted">· {v.id}</span></h3>
          <div className="stack" style={{ gap: '0.5rem' }}>
            {v.health.repos.map((r) => (
              <HealthStrip key={r.repo} health={r} />
            ))}
          </div>
        </div>
      ))}

      <hr className="hr" />

      {/* Activity feed */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Last 14 days</h2>
        <span className="muted" style={{ fontSize: '13px' }}>filter:</span>
        <Link href="/activity" className={`pill`} data-active={!repoFilter} data-testid="filter-all">all</Link>
        {[...new Set(allRepos)].map((r) => (
          <Link key={r} href={`/activity?repo=${encodeURIComponent(r)}`} className="pill" data-active={repoFilter === r} data-testid={`filter-${r}`}>
            {r}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="card muted" data-testid="activity-empty">No activity in the last 14 days.</p>
      ) : (
        <div className="stack" data-testid="activity-feed" style={{ gap: '0.4rem' }}>
          {events.map((e, i) => <ActivityRow key={`${e.url}-${i}`} event={e} />)}
        </div>
      )}
    </section>
  );
}

function HealthStrip({ health }: { health: RepoHealth }) {
  const runColor =
    health.latestRun?.conclusion === 'success' ? 'var(--color-ok)'
      : health.latestRun?.conclusion === 'failure' ? 'var(--color-error)'
      : 'var(--color-ink-muted)';
  return (
    <article className="card" data-testid={`health-${health.repo}`} style={{ padding: '0.7rem 0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="mono" style={{ fontWeight: 500 }}>{health.repo}</span>
      {health.error ? (
        <span className="tag" style={{ color: 'var(--color-error)' }}>{health.error}</span>
      ) : (
        <>
          {health.latestRun ? (
            <a className="tag mono" href={health.latestRun.url} target="_blank" rel="noreferrer" style={{ color: runColor }} data-testid={`health-run-${health.repo}`}>
              CI {health.latestRun.conclusion}
            </a>
          ) : (
            <span className="tag mono muted">no CI runs</span>
          )}
          <span className={`tag ${health.protected ? 'tag-accent' : ''}`} data-testid={`health-protection-${health.repo}`} style={health.protected ? undefined : { color: 'var(--color-warn)' }}>
            {health.protected ? 'protected' : 'unprotected'}
          </span>
          {health.stale ? (
            <span className="tag" data-testid={`health-stale-${health.repo}`} style={{ color: 'var(--color-warn)' }}>⚠ stale</span>
          ) : (
            <span className="tag muted" data-testid={`health-active-${health.repo}`}>active</span>
          )}
        </>
      )}
    </article>
  );
}

const KIND_LABEL: Record<ActivityEvent['kind'], string> = {
  'pr-merged': 'merged',
  'ci-failed': 'CI failed',
  commit: 'commit',
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  return (
    <a className="card card-link" href={event.url} target="_blank" rel="noreferrer" data-testid={`activity-${event.kind}`} style={{ padding: '0.5rem 0.8rem', display: 'flex', gap: '0.6rem', alignItems: 'baseline' }}>
      <span className="tag mono" style={{ minWidth: '5.5rem', textAlign: 'center' }}>{KIND_LABEL[event.kind]}</span>
      <span style={{ flex: 1, fontSize: '14px' }}>{event.title}</span>
      <span className="muted mono" style={{ fontSize: '12px' }}>{event.repo} · {relTime(event.at)}</span>
    </a>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `${d}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h ago`;
  return `${Math.max(0, Math.floor(ms / 60_000))}m ago`;
}
