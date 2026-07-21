'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
// Type-only imports: lib/tickets pulls in node:fs / the GitHub client, which must never reach the
// client bundle. `import type` is erased at build, so only the shapes cross the boundary.
import type { LaneTickets, TicketStatusGroup, TicketWithMeta } from '@/lib/tickets';
import { TicketDrawer } from './TicketDrawer';

const GROUPS: { key: TicketStatusGroup; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'pr-open', label: 'PR open' },
  { key: 'done', label: 'Done' },
];

interface Selected {
  repo: string;
  ref: string;
  item: TicketWithMeta;
}

export function VentureBoard({
  venture,
  lanes,
  staleRepos = [],
  totalWarnings,
  fetchedAt,
  org,
}: {
  venture: { id: string; name: string; status: string; founderName: string | null };
  lanes: LaneTickets[];
  staleRepos?: string[];
  totalWarnings: number;
  fetchedAt: number;
  org: string;
}) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const stale = new Set(staleRepos);

  // Index every ticket by id so dependency chips in the drawer can jump to another ticket.
  const index = useMemo(() => {
    const m = new Map<string, Selected>();
    for (const lane of lanes) {
      for (const g of GROUPS) {
        for (const item of lane.groups[g.key]) m.set(item.ticket.id, { repo: lane.repo, ref: lane.ref, item });
      }
    }
    return m;
  }, [lanes]);

  const selectById = (id: string) => {
    const hit = index.get(id);
    if (hit) setSelected(hit);
  };

  return (
    <section>
      <p className="eyebrow">
        <span className="eyebrow-id">{venture.id}</span> — Venture
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>{venture.name}</h1>
        <span className={`tag ${venture.status === 'active' ? 'tag-accent' : ''}`}>{venture.status}</span>
        {totalWarnings > 0 ? (
          <span className="tag" data-testid="warnings-badge" title="Tickets parsed with warnings">
            ⚠ {totalWarnings} warning{totalWarnings === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <p className="muted" style={{ fontSize: '14px' }}>
        {venture.founderName ? <>Founder: {venture.founderName} · </> : null}
        <span className="mono">updated {new Date(fetchedAt).toLocaleTimeString()}</span> ·{' '}
        <Link href={`/venture/${venture.id}?refresh=1`} className="mono" data-testid="refresh">
          refresh
        </Link>
      </p>
      <hr className="hr" />

      {lanes.map((lane) => (
        <div key={lane.repo} style={{ marginBottom: '2.5rem' }} data-testid={`lane-${lane.repo}`}>
          <h3 className="mono" style={{ fontSize: '15px' }}>
            {lane.repo} <span className="muted">· {lane.total} ticket{lane.total === 1 ? '' : 's'}</span>
            {stale.has(lane.repo) ? (
              <span className="tag" data-testid={`lane-stale-${lane.repo}`} title="No repo activity in the staleness window" style={{ marginLeft: '0.4rem', color: 'var(--color-warn)' }}>
                ⚠ stale
              </span>
            ) : null}
            {lane.skipped > 0 ? (
              <span className="muted" data-testid={`lane-skipped-${lane.repo}`} title="Non-ticket .md files in docs/tickets">
                {' '}· {lane.skipped} non-ticket file{lane.skipped === 1 ? '' : 's'} skipped
              </span>
            ) : null}
          </h3>

          {lane.error ? (
            <p className="card" data-testid="lane-error" style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
              {lane.error}
            </p>
          ) : lane.total === 0 ? (
            <p className="card muted" data-testid="lane-empty">
              No tickets in <span className="mono">docs/tickets/</span> yet.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))' }}>
              {GROUPS.map((g) => (
                <div key={g.key} data-testid={`col-${g.key}`}>
                  <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>
                    {g.label} <span className="mono">{lane.groups[g.key].length}</span>
                  </p>
                  <div className="stack" style={{ gap: '0.5rem' }}>
                    {lane.groups[g.key].map((item) => (
                      <button
                        key={item.ticket.id}
                        className="card card-link"
                        style={{ textAlign: 'left', cursor: 'pointer', padding: '0.7rem 0.85rem' }}
                        data-testid={`ticket-${item.ticket.id}`}
                        onClick={() => setSelected({ repo: lane.repo, ref: lane.ref, item })}
                      >
                        <span className="mono eyebrow-id" style={{ fontSize: '11px' }}>{item.ticket.id}</span>
                        <div style={{ fontSize: '14px', marginTop: '0.15rem' }}>{item.ticket.title}</div>
                        {item.warnings.length > 0 ? (
                          <span className="tag" style={{ marginTop: '0.35rem', color: 'var(--color-warn)' }}>
                            ⚠ {item.warnings.length}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {selected ? (
        <TicketDrawer
          item={selected.item}
          repo={selected.repo}
          gitRef={selected.ref}
          org={org}
          knownIds={index}
          onSelectId={selectById}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
