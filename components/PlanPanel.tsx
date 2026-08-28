'use client';

import { useState } from 'react';
import { filePlan } from '@/app/actions/file-plan';
import {
  effectiveDependsOn, keptTickets, planFilingOrder, planOrder, planProblem, strikeTicket,
  type PlanDraft,
} from '@/lib/plan-draft';
import { toneColor } from '@/lib/status';

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
 * The layout here is deliberately plain. The desk design's `planOn` rail is FB-131; this is the
 * control, not its final shape.
 */
export function PlanPanel({ plan: proposed }: { plan: PlanDraft }) {
  const [plan, setPlan] = useState(proposed);
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState<{ url?: string; message: string } | null>(null);

  // One order for reading and for filing, computed as though nothing were struck — so striking a
  // line never reshuffles the list under the founder's eyes, and what they read is what lands.
  const lines = planOrder(plan);
  const ordered = planFilingOrder(plan);
  const problem = planProblem(plan);
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
        <span className="eyebrow-id">The plan, taking shape</span>
      </p>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.75rem' }}>
        From <strong>{plan.source_title}</strong> — {ordered.length} {ordered.length === 1 ? 'ticket' : 'tickets'},
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
                padding: '0.6rem 0', borderTop: '1px solid var(--color-rule)',
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
          <span aria-hidden="true">⚠ </span>{problem}
        </p>
      ) : null}

      {error ? (
        <p data-testid="plan-error" style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention') }}>
          <span aria-hidden="true">⚠ </span>
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
              const r = await filePlan(plan.venture_id, plan.repo, plan, keptTickets(plan).length);
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
          They file together, as one piece of work. Nothing is built until you press it.
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
