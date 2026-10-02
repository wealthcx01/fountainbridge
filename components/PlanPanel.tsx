'use client';

import { useState } from 'react';
import { filePlan } from '@/app/actions/file-plan';
import {
  effectiveDependsOn, keptTickets, planFilingOrder, planOrder, planProblem, strikeTicket,
  type PlanDraft,
} from '@/lib/plan-draft';
import { mapProblem, mapSections, traceProblem, type FoundingMap } from '@/lib/founding-map';
import { formatInline } from '@/lib/composer';
import { toneColor } from '@/lib/status';
import { Mark } from './Mark';
import { noteDecision } from '@/lib/decided';

/**
 * A plan, before it is work (FB-127, gap G5).
 *
 * The founder handed over a document and the composer proposed a set. This is where they read it,
 * strike what they do not want, and turn the rest into tickets with one press.
 *
 * Three things it is careful about:
 *
 * **Nothing is filed until the press.** The plan is inert markup until this component calls the one
 * server action that writes, and it tells the founder so in the same breath as offering the button.
 *
 * **Every line says where it came from.** A founder must be able to check that the machine did not
 * invent a requirement, and that check is impossible if a ticket cannot cite the section it came
 * from. It is shown by default, not behind a control.
 *
 * **A strike is reversible and its consequences are visible.** Striking a line re-points everything
 * that depended on it, and the dependency chips redraw — so a founder can see the chain shorten
 * rather than take it on trust.
 *
 * **A founding set brings its map (FB-236).** When the tickets came out of a founding walk, the map
 * they came from is shown above them and saved beside them, and the press is refused while the map
 * stops short of the unknown unknowns or a ticket cannot say which part of the map it came from.
 *
 * The layout here is deliberately plain. The desk design's `planOn` rail is FB-131; this is the
 * control, not its final shape.
 */
export function PlanPanel({
  plan: proposed,
  map = null,
  mapMissing = null,
}: {
  plan: PlanDraft;
  map?: FoundingMap | null;
  /** A founding set whose map is missing or unreadable: said, and the press is refused. */
  mapMissing?: string | null;
}) {
  const [plan, setPlan] = useState(proposed);
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState<{ url?: string; message: string } | null>(null);

  // One order for reading and for filing, computed as though nothing were struck — so striking a
  // line never reshuffles the list under the founder's eyes, and what they read is what lands.
  const lines = planOrder(plan);
  const ordered = planFilingOrder(plan);
  const founding = Boolean(map || mapMissing);
  const problem = planProblem(plan) ?? mapMissing ?? (map ? mapProblem(map) ?? traceProblem(plan) : null);
  const titleOf = (slug: string) => plan.tickets.find((t) => t.slug === slug)?.title ?? slug;

  // A filed set is history. Re-rendering the strike controls over it would invite a founder to edit
  // something that is already a pull request.
  if (filed) {
    return (
      <div className="card" data-testid="plan-filed" style={{ marginTop: '1rem' }}>
        <p style={{ margin: 0 }}>{filed.message}</p>
        {filed.url ? (
          <p style={{ margin: '0.5rem 0 0', fontSize: 'var(--fs-body-sm)' }}>
            <a href={filed.url} target="_blank" rel="noreferrer">Read exactly what was filed</a> — nothing
            is built until you accept it.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card" data-testid="plan-panel" style={{ marginTop: '1rem' }}>
      <p className="eyebrow" style={{ marginTop: 0 }}>
        <span className="eyebrow-id">{founding ? 'Your first tickets, from the map' : 'The plan, taking shape'}</span>
      </p>
      {map ? <FoundingMapView map={map} summary="Read the map these came from" after="It is saved with them." /> : null}
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.75rem' }}>
        {/* A founding set's source is the map just above, so it is not named again mid-sentence. */}
        {founding ? null : <>From <strong>{plan.source_title}</strong> — </>}
        {ordered.length} {ordered.length === 1 ? 'ticket' : 'tickets'},
        smallest first. Strike anything you do not want.
      </p>

      <ol data-testid="plan-lines" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lines.map((ticket) => {
          const struck = ticket.struck === true;
          const deps = struck ? [] : (ordered.find((t) => t.slug === ticket.slug) ? dependencyTitles(plan, ticket.slug, titleOf) : []);
          return (
            <li
              key={ticket.slug}
              data-testid={`plan-line-${ticket.slug}`}
              data-struck={struck ? 'true' : 'false'}
              style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '0.6rem 0', borderTop: '1px solid var(--color-border)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, textDecoration: struck ? 'line-through' : 'none', opacity: struck ? 0.55 : 1 }}>
                  {ticket.title}
                </p>
                <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: 'var(--fs-meta-lg)' }}>
                  {ticket.source}
                  {deps.length ? <> · after {deps.join(', ')}</> : null}
                </p>
              </div>
              <button
                type="button"
                className="btn"
                data-testid={`plan-strike-${ticket.slug}`}
                style={{ flexShrink: 0 }}
                onClick={() => setPlan((p) => strikeTicket(p, ticket.slug, !struck))}
              >
                {struck ? 'Keep' : 'Strike'}
              </button>
            </li>
          );
        })}
      </ol>

      {problem ? (
        <p data-testid="plan-problem" style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention') }}>
          <Mark />{problem}
        </p>
      ) : null}

      {error ? (
        <p data-testid="plan-error" style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention') }}>
          <Mark />
          <span className="sr-only">Problem: </span>
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="plan-file-all"
          disabled={filing || Boolean(problem)}
          onClick={async () => {
            setFiling(true);
            setError(null);
            try {
              const r = noteDecision(await filePlan(plan.venture_id, plan.repo, plan, keptTickets(plan).length, undefined, map ?? undefined));
              if (r.ok) setFiled({ url: r.url, message: r.message });
              else setError(r.message);
            } catch {
              // The action returns its refusals; anything that THROWS happened outside it — a
              // dropped connection, a 500, a manifest that would not load. Without this the button
              // stayed on "Filing…" for ever, disabled, with no message, and a founder had no way
              // to tell whether their work existed. CLAUDE.md #10.
              setError('That did not reach the studio. Nothing was filed — try pressing again.');
            } finally {
              setFiling(false);
            }
          }}
        >
          {filing ? 'Filing…' : `File all ${ordered.length}`}
        </button>
        <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>
          {map
            ? 'They file together with the map, as one piece of work. Nothing is built until you press it.'
            : 'They file together, as one piece of work. Nothing is built until you press it.'}
        </span>
      </div>
    </div>
  );
}

/**
 * The titles a line waits on, after strikes — so a founder watches the chain shorten.
 *
 * Resolved through the same pure function the filer uses, so what the panel shows and what the
 * `Depends on` line ends up saying cannot disagree.
 */
function dependencyTitles(plan: PlanDraft, slug: string, titleOf: (s: string) => string): string[] {
  const kept = new Set(keptTickets(plan).map((t) => t.slug));
  return effectiveDependsOn(plan, slug).filter((d) => kept.has(d)).map(titleOf);
}

/**
 * A founding map, as the founder reads it: their idea, then the map folded under one line (FB-236).
 *
 * Shared by the plan panel and by the rail's "map, but no tickets" state, so the map looks the same
 * wherever it appears. Folded by default because opened it is about 800px on a desktop; `open`
 * unfolds it where the map is the only thing on the table.
 */
export function FoundingMapView({ map, summary, after, open = false }: { map: FoundingMap; summary: string; after?: string; open?: boolean }) {
  const sections = mapSections(map);
  const points = sections.reduce((n, sec) => n + sec.points.length, 0);
  return (
    <div data-testid="plan-map" style={{ margin: '0 0 0.75rem' }}>
      <p style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.4rem' }}>
        <strong>Your idea:</strong> {map.idea}
      </p>
      <details data-testid="plan-map-details" open={open}>
        <summary style={{ fontSize: 'var(--fs-body-sm)', cursor: 'pointer' }}>
          {summary} — {points} {points === 1 ? 'point' : 'points'}.{after ? ` ${after}` : null}
        </summary>
        {sections.map((sec) => (
          <div key={sec.quadrant} data-testid="plan-map-section" style={{ margin: '0.6rem 0 0' }}>
            <p className="eyebrow" style={{ margin: '0 0 0.2rem' }}>{sec.quadrant}</p>
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: 'var(--fs-body-sm)' }}>
              {sec.points.map((pt, i) => (
                <li key={i}>
                  {formatInline(pt).map((span, j) => (span.strong ? <strong key={j}>{span.text}</strong> : <span key={j}>{span.text}</span>))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </div>
  );
}
