'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TicketStatusGroup, TicketWithMeta } from '@/lib/tickets';
import { STATUS_LABEL } from '@/lib/glossary';
import { showAngleBrackets, withoutStatusClaim, withoutTitleHeading } from '@/lib/markdown';
import { toneColor } from '@/lib/status';
import { acceptWork, sendBackWork } from '@/app/actions/work';

/**
 * Ticket detail drawer (FB-006): the whole ticket, rendered, with the decision on it (FB-105).
 *
 * The studio's promise is a view and a write-path over git so a founder never has to BE a git user,
 * and this drawer used to break it at the moment of interest: a ticket sitting in "Needs your OK"
 * rendered here with **no way to give the OK**. The decision lived on another page with no visible
 * thread between the two — the founder was shown a decision and denied the lever.
 *
 * So the lever is here, and it is the SAME lever: the FB-064 server action, reused rather than
 * copied. One decision, two doors. The work page stays the place to read what was built; this is
 * the place to act on the thing you asked for.
 */
export interface WaitingWorkRef {
  repo: string;
  number: number;
}

export function TicketDrawer({
  item,
  repo,
  gitRef,
  org,
  ventureId,
  statusGroup,
  waiting = null,
  knownIds,
  onSelectId,
  onClose,
}: {
  item: TicketWithMeta;
  repo: string;
  gitRef: string;
  org: string;
  ventureId: string;
  /**
   * The column this ticket is actually rendered in.
   *
   * NOT `ticket.status`. The board groups by inferred status (an open piece of work moves a ticket to
   * "Needs your OK"); the drawer read the markdown's own line, so SELL-001 showed "Needs your OK" in
   * the queue and `Status: Todo` in the drawer — two contradicting answers about one ticket, in one
   * view. One computation, both places.
   */
  statusGroup: TicketStatusGroup;
  /** The work waiting on this ticket, when there is any. Null means there is nothing to decide yet. */
  waiting?: WaitingWorkRef | null;
  knownIds: ReadonlyMap<string, unknown>;
  onSelectId: (id: string) => void;
  onClose: () => void;
}) {
  const { ticket, warnings } = item;
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

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
          // FB-124: the left rule already carried this edge; the shadow was doing nothing a
          // hairline was not already doing better.
          borderLeft: '1px solid var(--color-border-strong)',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <span className="mono eyebrow-id" style={{ fontSize: 'var(--fs-meta)' }}>{ticket.id}</span>
            <h2 style={{ margin: '0.25rem 0 0' }} data-testid="drawer-title">{ticket.title}</h2>
          </div>
          <button className="btn" onClick={onClose} data-testid="drawer-close" aria-label="Close">✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
          <span className="tag tag-accent" data-testid="drawer-status">{STATUS_LABEL[statusGroup]}</span>
          {ticket.phase ? <span className="tag">phase {ticket.phase}</span> : null}
          {ticket.branch ? <span className="tag mono">{ticket.branch}</span> : null}
        </div>

        {ticket.depends_on.length > 0 ? (
          <p style={{ fontSize: 'var(--fs-body-sm)' }} data-testid="drawer-deps">
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
                style={{ borderColor: toneColor('attention'), color: toneColor('attention'), padding: '0.5rem 0.75rem', fontSize: 'var(--fs-meta-lg)' }}
              >
                ⚠ {w.message}
              </p>
            ))}
          </div>
        ) : null}

        <hr className="hr" style={{ margin: '1rem 0' }} />

        <div className="ticket-body" style={{ fontSize: 'var(--fs-subhead)' }}>
          {/* Escaped rather than stripped: without this, `(<slug>, <path>)` reached the founder as
              "(, )" — the studio deleting part of the sentence that says what was asked for. */}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {showAngleBrackets(withoutStatusClaim(withoutTitleHeading(ticket.body_md)))}
          </ReactMarkdown>
        </div>

        <hr className="hr" style={{ margin: '1.25rem 0 1rem' }} />

        {/* The decision, where the ticket is. */}
        {waiting ? (
          <div data-testid="drawer-decision" style={{ marginBottom: '1rem' }}>
            <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>This one needs your OK</p>
            <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.6rem' }}>
              <Link href={`/venture/${ventureId}/work/${waiting.repo}/${waiting.number}`} data-testid="drawer-read-work">
                Read what your team built →
              </Link>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="drawer-accept"
                disabled={pending || result?.ok}
                onClick={() =>
                  startTransition(async () => {
                    // No `seenHeadSha`: the founder read the ASK here, not the work, so there is no
                    // rendered commit to bind to. The server still re-reads and re-decides against
                    // what is currently true, which is the check that matters.
                    setResult(await acceptWork(ventureId, waiting.repo, waiting.number));
                  })
                }
              >
                {pending ? 'Working…' : 'Accept this work'}
              </button>
              <button type="button" className="btn" data-testid="drawer-sendback-open" onClick={() => setNoteOpen((v) => !v)}>
                Send it back with a note
              </button>
            </div>
            {noteOpen ? (
              <div style={{ marginTop: '0.5rem' }}>
                <label htmlFor="drawer-note" style={{ fontSize: 'var(--fs-body-sm)', display: 'block', marginBottom: '0.3rem' }}>
                  What needs changing? Your team reads this on its next wake.
                </label>
                <textarea
                  id="drawer-note"
                  data-testid="drawer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 'var(--fs-body-sm)', padding: '0.5rem',
                           border: '1px solid var(--color-border)' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="drawer-sendback"
                  disabled={pending || !note.trim()}
                  style={{ marginTop: '0.4rem' }}
                  onClick={() =>
                    startTransition(async () => {
                      setResult(await sendBackWork(ventureId, waiting.repo, waiting.number, note));
                    })
                  }
                >
                  {pending ? 'Sending…' : 'Send this back'}
                </button>
              </div>
            ) : null}
            {result ? (
              <p data-testid="drawer-msg"
                 style={{ fontSize: 'var(--fs-body-sm)', marginTop: '0.5rem',
                          color: result.ok ? undefined : toneColor('attention') }}>
                {result.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Changing the ask is a sentence, not a git edit — and it goes through the ONE write path
            that already exists and is already gated. A second way to edit a ticket file from the
            studio is how two versions of the truth start. */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link
            className="btn"
            href={`/venture/${ventureId}/composer?about=${encodeURIComponent(ticket.id)}`}
            data-testid="drawer-ask-changes"
          >
            Ask for changes to this
          </Link>
          <a className="muted" style={{ fontSize: 'var(--fs-meta)' }} href={fileUrl} target="_blank" rel="noreferrer" data-testid="drawer-github-link">
            See where this is written down ↗
          </a>
        </div>
      </aside>
    </div>
  );
}
