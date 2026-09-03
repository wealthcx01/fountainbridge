'use client';

import { useMemo, useState, useTransition } from 'react';
import { panelState } from '@/lib/read-failures';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { STATUS_LABEL } from '@/lib/glossary';
import { showAngleBrackets, splitTicketBody, withoutStatusClaim, withoutTitleHeading } from '@/lib/markdown';
import { toneColor } from '@/lib/status';
import { howLongMs } from '@/lib/when';
import { acceptWork, sendBackWork } from '@/app/actions/work';
import { isUnnumbered } from '@/lib/ticket-ids';
import type { ReactNode } from 'react';
import {
  DEFAULT_FILTER, FILTER_LABEL, TICKET_FILTERS, countTickets, decisionOrder, decisionPosition,
  filterTickets, nextDecision, resolveSelected, rowKey, ticketsSummary, type TicketFilter,
  type TicketRow,
} from '@/lib/tickets-view';

/**
 * Tickets: master-detail, and deciding without leaving (FB-129).
 *
 * ## What changed for a founder
 *
 * The list, the ticket and the decision are one screen. Before this the drawer showed a ticket
 * sitting in "Needs your OK" and the lever to give it was on another page, with nothing on either
 * saying the other existed.
 *
 * And when they have decided, **Next decision →** offers the oldest remaining one. Three decisions
 * become one sitting rather than three navigations — which is the whole point of the screen and the
 * only part of it a founder will notice.
 *
 * ## The gate is not touched
 *
 * Approving calls `acceptWork` and refusing calls `sendBackWork`, the same server actions the work
 * page has used since FB-064. This ticket changes where the founder stands, not what is enforced.
 * A refusal still requires a note, because a send-back with no reason is a lane guessing.
 */
export function TicketsView({
  ventureId,
  ventureName,
  rows,
  filter,
  selectedId,
  opened = false,
  trail = null,
  refs,
  filedBranches = {},
  org,
  errors = [],
}: {
  ventureId: string;
  ventureName: string;
  rows: TicketRow[];
  filter: TicketFilter;
  selectedId: string | null;
  /**
   * True when the founder actually opened a ticket (`?t=` is in the URL), as opposed to the screen
   * resolving a default selection (FB-185).
   *
   * Only the phone layout uses it. On a wide screen the list and the ticket sit side by side and
   * both are always shown; below 60rem they stack, and stacking put the whole list ABOVE the ticket
   * a founder had just opened — 8,242px of it on ARCA's backlog. The design shows one column at a
   * time on a phone, so this says which one.
   */
  opened?: boolean;
  /**
   * The selected ticket's history (FB-130), as a **node** rather than as data.
   *
   * The page passes an async server component wrapped in Suspense, so the list and the ticket paint
   * immediately and the history streams in behind them. Blocking on it cost 23 seconds on ARCA's
   * real backlog. A client component cannot await anything, so the shape of this prop is what makes
   * that possible: this file never learns what a trail is.
   *
   * Null when there is nothing to show a history for — no selection, or a row with no ticket file.
   */
  trail?: ReactNode;
  /** Each repo's default ref, so the "written down" link points at the branch the file is on. */
  refs: Record<string, string>;
  /**
   * Where a FILED ticket actually lives, keyed `repo id` (FB-120).
   *
   * A ticket filed minutes ago is on its own `foundry/<slug>` branch and provably not on the default
   * one — which is exactly where the link would otherwise point, and 404.
   */
  filedBranches?: Record<string, string>;
  org: string;
  errors?: string[];
}) {
  const router = useRouter();
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  const [outcome, setOutcome] = useState<{ id: string; kind: 'approved' | 'refused'; message: string } | null>(null);

  const counts = useMemo(() => countTickets(rows), [rows]);
  // FB-137: empty and unreadable are different sentences, and this screen said both.
  const panel = panelState({ hasContent: rows.length > 0, couldNotRead: errors.length > 0 });
  const shown = useMemo(() => filterTickets(rows, filter), [rows, filter]);
  const order = useMemo(() => decisionOrder(rows), [rows]);

  // Resolved by the server and passed down already keyed. Both sides used to resolve it, with
  // different fallbacks, so the history loaded for one ticket could render under another's heading.
  const selected = resolveSelected(rows, shown, selectedId);
  const position = selected ? decisionPosition(order, rowKey(selected)) : null;
  const next = nextDecision(order, decided);

  // The URL is the state. Replace rather than push for the filter, so a founder browsing filters
  // does not have to press Back five times to leave the screen; the ticket is a push, because
  // stepping between tickets is navigation a founder expects Back to undo.
  const go = (nextFilter: TicketFilter, id: string | null, mode: 'push' | 'replace' = 'push') => {
    const q = new URLSearchParams();
    // Omit the filter that a bare URL already means, and no other. This tracked `'all'` when `'all'`
    // was the default (FB-185 changed it to `needs`); left alone, pressing **All** would have
    // dropped the query and navigated to a URL that now means the opposite.
    if (nextFilter !== DEFAULT_FILTER) q.set('filter', nextFilter);
    if (id) q.set('t', id);
    // `.toString()`, not `.size`: the latter is recent enough that on an older browser it is
    // `undefined`, the query is dropped silently, and every filter tab and row click navigates to
    // the bare route with no error and no selection.
    const query = q.toString();
    const href = `/venture/${ventureId}/tickets${query ? `?${query}` : ''}`;
    if (mode === 'replace') router.replace(href); else router.push(href);
  };

  return (
    <section data-testid="tickets-view">
      <p className="eyebrow"><span className="eyebrow-id">{ventureName}</span> — Tickets</p>
      <h1 style={{ margin: '0 0 0.5rem' }}>Tickets</h1>

      <div role="tablist" aria-label="Filter tickets" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
        {TICKET_FILTERS.map((f) => {
          const n = f === 'needs' ? counts.needs : f === 'underway' ? counts.underway : f === 'settled' ? counts.settled : counts.total;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === filter}
              data-testid={`tickets-filter-${f}`}
              className={f === filter ? 'btn btn-primary' : 'btn'}
              onClick={() => go(f, null, 'replace')}
            >
              {/* FB-137: `0` on every filter is four claims about a backlog nobody could read —
                  and "Needs you 0" is the reassuring one. A dash, with a word for the reader who
                  cannot see it. */}
              {FILTER_LABEL[f]}{' '}
              {panel === 'unreadable' ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">not known</span>
                </>
              ) : (
                n
              )}
            </button>
          );
        })}
      </div>

      {/* FB-137: "No tickets yet. The first one your team files lands here." is an invitation, and
          over a read that failed it tells a founder their backlog is empty when the studio simply
          could not look. The apology replaces it; when there ARE tickets it sits beside them, because
          a partial list plus a note of what is missing beats an apology instead of the half we have. */}
      {panel === 'unreadable' ? null : (
        <p data-testid="tickets-summary" className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
          {ticketsSummary(counts)}
        </p>
      )}

      {errors.length ? (
        <p className="card muted" data-testid="tickets-degraded" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
          <span aria-hidden="true">⚠ </span>
          {panel === 'unreadable'
            ? 'The studio could not read this venture’s tickets just now, so it cannot show you the list. Nothing is lost from your venture’s records, and this clears on its own.'
            : 'Part of this venture could not be read, so the list may be short. Nothing is lost from your venture’s records.'}
        </p>
      ) : null}

      <div className={opened ? 'tickets-split is-reading' : 'tickets-split'}>
        <ol className="tickets-list" data-testid="tickets-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {/* "The queue is clear" is the most reassuring sentence on this screen. It must never be
              said about a list the studio could not read. */}
          {shown.length === 0 && panel !== 'unreadable' ? (
            <li className="card muted" data-testid="tickets-list-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
              Nothing here. The queue is clear.
            </li>
          ) : null}
          {shown.map((r) => (
            <li key={`${r.repo}/${r.id}`} style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                data-testid={`tickets-row-${r.id}`}
                aria-current={selected && rowKey(selected) === rowKey(r) ? 'true' : undefined}
                onClick={() => go(filter, rowKey(r))}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.5rem',
                  background: selected && rowKey(selected) === rowKey(r) ? 'var(--color-paper-sunken)' : 'none',
                  border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block' }}>{r.title}</span>
                <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>
                  {/* FB-097's rule, on the screen that is now the only list of tickets (FB-178).
                      It had only ever been applied on the desk's board, so removing that board would
                      have quietly reintroduced the defect it was written to fix: four distinct
                      pieces of work all displayed as "ARCA-NEW", as though it were a name. */}
                  <span className="mono" data-testid={`tickets-id-${r.id}`}>
                    {isUnnumbered(r.id) ? 'unnumbered' : r.id}
                  </span> · {STATUS_LABEL[r.group]}
                  {/* FB-098's "is anything happening to the thing I asked for", moved off the desk's
                      board when FB-178 removed it. Rendered as text on the row rather than as a link:
                      the row itself already opens the ticket, and a link inside a link is not a
                      control a keyboard user can reach. Its destination is on the ticket. */}
                  {r.progress ? (
                    <>
                      {' · '}
                      <span
                        data-testid={`ticket-progress-${r.id}`}
                        data-state={r.progress.state}
                        style={{ color: toneColor(r.progress.tone) }}
                      >
                        {r.progress.text}
                      </span>
                    </>
                  ) : null}
                  {r.waiting ? (
                    <>
                      {' '}· waiting {howLongMs(r.waiting.ageMs)}
                      {r.waiting.also ? <> · {r.waiting.also + 1} pieces of work on this one</> : null}
                    </>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="tickets-detail" data-testid="tickets-detail">
          {/* FB-185: the way back, on a phone only — where the list is now hidden while a ticket is
              open. On a wide screen the list is still sitting right there and this would be a
              control pointing at something already visible, so the stylesheet hides it. */}
          {opened ? (
            <button
              type="button"
              className="btn back-to-list"
              data-testid="tickets-back-to-list"
              onClick={() => go(filter, null)}
            >
              ← All tickets
            </button>
          ) : null}
          {selected ? (
            <Detail
              // Keyed, or the panel keeps its own state across tickets. Concretely: refuse ticket A,
              // type a note, send it back, press "Next decision →" — and B renders already in
              // refusal mode with A's note prefilled and the button enabled. One click would send
              // A's words to B's pull request. Keyed by repo AND id because two repositories in one
              // venture may share an id namespace.
              key={`${selected.repo}/${selected.id}`}
              row={selected}
              ventureId={ventureId}
              org={org}
              gitRef={filedBranches[`${selected.repo} ${selected.id}`] ?? refs[selected.repo] ?? 'main'}
              position={position}
              // Dependency chips resolve within this repository: `FB-001` in one repo is not the
              // `FB-001` in another, and linking across would open the wrong ticket.
              knownIds={new Set(rows.filter((r) => r.repo === selected.repo).map((r) => r.id))}
              onSelectId={(id) => go(filter, `${selected.repo}/${id}`)}
              trail={trail}
              outcome={outcome?.id === rowKey(selected) ? outcome : null}
              next={next && rowKey(next) !== rowKey(selected) ? next : null}
              onDecided={(kind, message) => {
                setDecided((d) => new Set([...d, rowKey(selected)]));
                setOutcome({ id: rowKey(selected), kind, message });
              }}
              onNext={(r) => go(filter, rowKey(r))}
            />
          ) : (
            <p className="card muted" data-testid="tickets-detail-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
              Pick a ticket to read it.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Detail({
  row, ventureId, org, gitRef, position, knownIds, onSelectId, trail, outcome, next, onDecided, onNext,
}: {
  row: TicketRow;
  trail: ReactNode;
  ventureId: string;
  org: string;
  gitRef: string;
  position: { n: number; of: number } | null;
  knownIds: ReadonlySet<string>;
  onSelectId: (id: string) => void;
  outcome: { kind: 'approved' | 'refused'; message: string } | null;
  next: TicketRow | null;
  onDecided: (kind: 'approved' | 'refused', message: string) => void;
  onNext: (row: TicketRow) => void;
}) {
  const ticket = row.item?.ticket ?? null;
  const warnings = row.item?.warnings ?? [];
  const [note, setNote] = useState('');
  const [refusing, setRefusing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const repoPath = row.repo.includes('/') ? row.repo : `${org}/${row.repo}`;
  const fileUrl = ticket ? `https://github.com/${repoPath}/blob/${gitRef}/${ticket.path}` : null;

  return (
    <article className="card" style={{ padding: '1.25rem' }}>
      <p className="eyebrow" style={{ marginTop: 0 }}>
        <span className="mono eyebrow-id" data-testid="detail-id">
          {isUnnumbered(row.id) ? 'unnumbered' : row.id}
        </span>
        {row.surface ? <> · {row.surface}</> : null} · {STATUS_LABEL[row.group]}
      </p>
      <h2 data-testid="detail-title" style={{ margin: '0.25rem 0 0.75rem' }}>{row.title}</h2>

      {/* Work that is tied to no ticket at all. Said out loud rather than left as an empty page: a
          founder looking at something their team built which matches nothing they asked for needs
          to know that is what they are looking at. */}
      {!ticket ? (
        <p className="muted" data-testid="detail-no-ticket" style={{ fontSize: 'var(--fs-body-sm)' }}>
          There is no ticket for this. Your team finished work that is not tied to anything you asked
          for — read it, then decide.
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <p className="card" data-testid="detail-warnings" style={{ borderColor: toneColor('attention'), color: toneColor('attention'), fontSize: 'var(--fs-meta-lg)', padding: '0.5rem 0.75rem' }}>
          ⚠ {warnings.map((w) => w.message).join(' · ')}
        </p>
      ) : null}

      {ticket ? (
        <TicketBody md={showAngleBrackets(withoutStatusClaim(withoutTitleHeading(ticket.body_md)))} />
      ) : null}

      <p style={{ fontSize: 'var(--fs-body-sm)', margin: '1rem 0 0' }}>
        <Link
          href={`/venture/${ventureId}/composer${ticket ? `?about=${encodeURIComponent(ticket.id)}` : ''}`}
          data-testid="detail-discuss"
        >
          Discuss in the composer →
        </Link>
      </p>

      {ticket && fileUrl ? (
        <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.4rem 0 0' }}>
          <span className="mono">{ticket.path}</span> ·{' '}
          <a href={fileUrl} target="_blank" rel="noreferrer" data-testid="detail-record">see where this is written down ↗</a>
        </p>
      ) : null}

      {ticket && ticket.depends_on.length > 0 ? (
        <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0.6rem 0 0' }} data-testid="detail-deps">
          <span className="muted">Depends on: </span>
          {ticket.depends_on.map((dep) =>
            knownIds.has(dep) ? (
              <button
                key={dep}
                type="button"
                className="tag mono"
                data-testid={`detail-dep-${dep}`}
                style={{ cursor: 'pointer', marginRight: '0.3rem' }}
                onClick={() => onSelectId(dep)}
              >
                {dep}
              </button>
            ) : (
              // Named but not on this board — the ticket file has not been filed, or lives in
              // another repo. Shown rather than hidden: a dependency nobody can find is a fact.
              <span key={dep} className="tag mono" style={{ marginRight: '0.3rem', opacity: 0.6 }}>{dep}</span>
            ),
          )}
        </p>
      ) : null}

      {outcome ? (
        <div data-testid="detail-outcome" style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          <p className="eyebrow" style={{ marginTop: 0 }}>
            {outcome.kind === 'approved' ? 'Approved and verified' : 'Sent back with your note'}
          </p>
          <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
            {outcome.kind === 'approved'
              ? outcome.message
              : 'Nothing went out. Your team re-opens it, reads your note, and comes back with a revision.'}
          </p>
          <p style={{ margin: '0.75rem 0 0', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {next ? (
              <button type="button" className="btn btn-primary" data-testid="detail-next" onClick={() => onNext(next)}>
                Next decision →
              </button>
            ) : null}
            <Link className="btn" href={`/venture/${ventureId}`} data-testid="detail-back">Back to the desk</Link>
          </p>
        </div>
      ) : row.waiting ? (
        <div data-testid="detail-decision" style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
          <p className="eyebrow" style={{ marginTop: 0 }}>
            Your decision{position ? ` · decision ${position.n} of ${position.of}` : ''}
          </p>

          {/* What it reaches, what it costs, what proves it — the three things a founder needs before
              saying yes, in front of them rather than on a page they have to go and find. */}
          <dl style={{ margin: '0 0 0.9rem', fontSize: 'var(--fs-body-sm)' }}>
            <Fact label="Reaches" value={`${row.repo}, in your venture’s own code. Nothing outside the company.`} />
            <Fact label="Costs" value="Nothing. This is work your team already did; approving it makes it part of your product." />
            <Fact
              label="Proven"
              value={`Your team's own checks ran before this reached you. Read it in full before deciding.`}
            />
          </dl>

          <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.6rem' }}>
            <Link href={`/venture/${ventureId}/work/${row.waiting.repo}/${row.waiting.number}`} data-testid="detail-read-work">
              Read exactly what was built →
            </Link>
          </p>

          {error ? (
            <p data-testid="detail-error" style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention') }}>
              <span aria-hidden="true">⚠ </span>{error}
            </p>
          ) : null}

          {refusing ? (
            <div>
              <label htmlFor="detail-note" style={{ fontSize: 'var(--fs-body-sm)', display: 'block', marginBottom: '0.3rem' }}>
                What should change? Your team reads this.
              </label>
              <textarea
                id="detail-note"
                data-testid="detail-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                style={{
                  width: '100%', maxWidth: 'var(--content-narrow)', padding: '0.6rem', fontFamily: 'inherit',
                  fontSize: 'var(--fs-body-sm)', border: '1px solid var(--color-border)',
                  background: 'var(--color-paper-raised)', color: 'var(--color-ink)',
                }}
              />
              <p style={{ margin: '0.6rem 0 0', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="detail-send-back"
                  disabled={pending || !note.trim()}
                  onClick={() => startTransition(async () => {
                    setError(null);
                    const r = await sendBackWork(ventureId, row.waiting!.repo, row.waiting!.number, note);
                    if (r.ok) onDecided('refused', r.message);
                    else setError(r.message);
                  })}
                >
                  Send it back
                </button>
                <button type="button" className="btn" data-testid="detail-never-mind" onClick={() => { setRefusing(false); setNote(''); }}>
                  Never mind
                </button>
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="detail-approve"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  setError(null);
                  // The commit they were shown. `acceptWork` refuses if something has been pushed
                  // since this page rendered — a founder deciding from a list, without opening the
                  // work, must not merge a change that landed after they looked.
                  const r = await acceptWork(ventureId, row.waiting!.repo, row.waiting!.number, row.waiting!.headSha ?? undefined);
                  if (r.ok) onDecided('approved', r.message);
                  else setError(r.message);
                })}
              >
                {pending ? 'Working…' : 'Make it part of my product'}
              </button>
              <button type="button" className="btn" data-testid="detail-refuse" onClick={() => setRefusing(true)}>
                Refuse, and say why
              </button>
            </p>
          )}

          <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.6rem 0 0' }}>
            You never leave the studio. Nothing goes outside your company from here.
          </p>
        </div>
      ) : null}

      {/* Last, per the design: a founder decides on the work, and then follows where it went.
          Streamed by the page — this component only decides where it goes. */}
      {trail}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', margin: '0 0 0.3rem' }}>
      <dt className="muted" style={{ flex: '0 0 4.5rem' }}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0 }}>{value}</dd>
    </div>
  );
}

/**
 * A ticket, read beside the list: the opening first, the rest one press away (FB-185).
 *
 * A ticket file is written for whoever builds the thing — scope, out of scope, acceptance criteria,
 * quoted research. On ARCA's backlog that is 1,730px under a heading a founder has already read the
 * point of, and it sits directly above the box where they approve the work. The design's ticket
 * detail is a couple of paragraphs and then the decision.
 *
 * So the opening is shown and the remainder goes in a `<details>`: one press, in place, no
 * navigation, and nothing removed. `<details>` rather than state, because it works before the
 * JavaScript arrives and browsers already give it the right keyboard and screen-reader behaviour —
 * and because a founder who expands it, decides, and comes back should not find it collapsed by a
 * re-render they did not cause.
 */
function TicketBody({ md }: { md: string }) {
  const { summary, rest } = splitTicketBody(md);
  return (
    <div className="ticket-body" style={{ fontSize: 'var(--fs-body-sm)' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
      {rest ? (
        <details data-testid="ticket-body-rest">
          <summary className="ticket-body-more">Read the whole ticket</summary>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{rest}</ReactMarkdown>
        </details>
      ) : null}
    </div>
  );
}
