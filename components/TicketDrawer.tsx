'use client';

import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TicketWithMeta } from '@/lib/tickets';

// Ticket detail drawer (FB-006): rendered markdown body, a link to the file on GitHub, and
// dependency links that jump to another ticket when it's in view.
export function TicketDrawer({
  item,
  repo,
  gitRef,
  org,
  knownIds,
  onSelectId,
  onClose,
}: {
  item: TicketWithMeta;
  repo: string;
  gitRef: string;
  org: string;
  knownIds: ReadonlyMap<string, unknown>;
  onSelectId: (id: string) => void;
  onClose: () => void;
}) {
  const { ticket, warnings } = item;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Normalize: a manifest repo may already be `owner/name`; don't double-prefix the org.
  const repoPath = repo.includes('/') ? repo : `${org}/${repo}`;
  const fileUrl = `https://github.com/${repoPath}/blob/${gitRef}/${ticket.path}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${ticket.id} detail`}
      data-testid="ticket-drawer"
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(23,25,31,0.25)' }} />
      <aside
        style={{
          position: 'relative',
          width: 'min(40rem, 100%)',
          height: '100%',
          overflowY: 'auto',
          background: 'var(--color-paper-raised)',
          borderLeft: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <span className="mono eyebrow-id" style={{ fontSize: '12px' }}>{ticket.id}</span>
            <h2 style={{ margin: '0.25rem 0 0' }} data-testid="drawer-title">{ticket.title}</h2>
          </div>
          <button className="btn" onClick={onClose} data-testid="drawer-close" aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
          <span className="tag tag-accent">{ticket.status}</span>
          {ticket.phase ? <span className="tag">phase {ticket.phase}</span> : null}
          {ticket.branch ? <span className="tag mono">{ticket.branch}</span> : null}
        </div>

        {ticket.depends_on.length > 0 ? (
          <p style={{ fontSize: '14px' }} data-testid="drawer-deps">
            <span className="muted">Depends on: </span>
            {ticket.depends_on.map((dep) =>
              knownIds.has(dep) ? (
                <button
                  key={dep}
                  className="tag mono"
                  style={{ cursor: 'pointer', marginRight: '0.3rem' }}
                  onClick={() => onSelectId(dep)}
                  data-testid={`dep-${dep}`}
                >
                  {dep}
                </button>
              ) : (
                <span key={dep} className="tag mono" style={{ marginRight: '0.3rem', opacity: 0.7 }}>
                  {dep}
                </span>
              ),
            )}
          </p>
        ) : null}

        {warnings.length > 0 ? (
          <div style={{ margin: '0.75rem 0' }} data-testid="drawer-warnings">
            {warnings.map((w, i) => (
              <p
                key={i}
                className="card"
                style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)', padding: '0.5rem 0.75rem', fontSize: '13px' }}
              >
                ⚠ {w.message}
              </p>
            ))}
          </div>
        ) : null}

        <hr className="hr" style={{ margin: '1rem 0' }} />

        <div className="ticket-body" style={{ fontSize: '15px' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ticket.body_md}</ReactMarkdown>
        </div>

        <hr className="hr" style={{ margin: '1.25rem 0 1rem' }} />
        <a className="btn" href={fileUrl} target="_blank" rel="noreferrer" data-testid="drawer-github-link">
          View on GitHub ↗
        </a>
      </aside>
    </div>
  );
}
