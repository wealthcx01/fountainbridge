'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AREA_LABEL,
  describeOrigin,
  describeSize,
  docKey,
  memorySummary,
  orderRows,
  type KnowledgeDoc,
  type KnowledgeRow,
} from '@/lib/knowledge';
import { ACCEPTED_DESCRIPTION } from '@/lib/documents';
import { showAngleBrackets } from '@/lib/markdown';
import { onDate } from '@/lib/when';
import { CADENCE_LABEL, STATE_LABEL, STATE_TONE, whyNotRunning, type Routine } from '@/lib/routines';
import { toneColor } from '@/lib/status';
import { panelState } from '@/lib/read-failures';
import { depositDocument } from '@/app/actions/knowledge';

/**
 * Memory — what this venture knows (FB-133, over FB-106).
 *
 * FB-106 made the corpus visible for the first time: until then a document went in through the
 * composer, landed in the venture's records, and vanished from the founder's view. This is the
 * screen the design asks for on top of that — one table of what the venture holds, **where each
 * document came from**, and, beneath it, the recurring work that happens without anyone asking.
 *
 * ## Why provenance is the point rather than decoration
 *
 * The founder's question on this screen is never "what files exist". It is *"is the thing I handed
 * over actually being used?"* — and the first half of that is knowing the studio has it and knows
 * who gave it. So every row states its source in the founder's terms (you, your composer, your
 * team), read off the record that wrote it rather than assumed.
 *
 * ## Why a column can be empty
 *
 * "Last used" has no honest source yet: nothing records which documents your team reads when it
 * works. The column is in the design and it stays, empty, with the reason said in words underneath —
 * because the alternative is a plausible number on the one screen whose entire job is to say what
 * the machine actually read. That is the failure this studio has shipped before and it is worse
 * here than anywhere. Filling it is FB-156.
 */
export function KnowledgeView({
  ventureId,
  ventureName,
  rows,
  errors,
  routines,
  routineErrors = [],
  provenanceMissing = false,
}: {
  ventureId: string;
  ventureName: string;
  rows: KnowledgeRow[];
  errors: string[];
  routines: Routine[];
  routineErrors?: string[];
  provenanceMissing?: boolean;
}) {
  const [open, setOpen] = useState<KnowledgeDoc | null>(null);
  const ordered = orderRows(rows);
  // FB-137: with nothing read, "Nothing handed over yet" and the invitation beneath it both tell a
  // founder their own documents are not there. The apology replaces them.
  const state = panelState({ hasContent: ordered.length > 0, couldNotRead: errors.length > 0 });

  return (
    <section data-testid="knowledge">
      {/* `MemoryHeading`, not a second copy of it. This screen kept its own inline heading beside the
          shared one for a ticket and a half — which is the drift the shared component was extracted
          to prevent. */}
      <MemoryHeading
        ventureId={ventureId}
        ventureName={ventureName}
        summary={state === 'unreadable' ? null : memorySummary(ordered)}
      />

      {/* An unreadable corpus must never render as "you have given it nothing". The difference
          between those two, on this page, is a founder's own work. */}
      {errors.length > 0 ? (
        <p className="card" data-testid="knowledge-error"
           style={{ borderColor: toneColor('attention'), color: toneColor('attention'), fontSize: 'var(--fs-body-sm)' }}>
          ⚠ {errors.join(' ')} What you have given it is still there — this page could not read it just now.
        </p>
      ) : null}

      {state === 'empty' ? (
        <p className="card muted" data-testid="knowledge-empty"
           style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
          Nothing yet. Hand over what you already have: research, notes, a deck. It becomes part of
          what {ventureName} knows, and your team reads it before it works.
        </p>
      ) : null}

      {ordered.length > 0 ? (
        <>
          <div className="table-scroll">
            <table className="records" data-testid="memory-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">From</th>
                  <th scope="col">Added</th>
                  <th scope="col">Last used</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => {
                  const { doc, origin } = row;
                  // Keyed on the surface AND the path. Two of a venture's surfaces can both hold
                  // `context/general/price-list.md`, and a path-keyed row renders duplicate React
                  // keys and two elements answering to one test id.
                  const key = docKey(row);
                  return (
                    <tr key={key} data-testid={`memory-row-${key}`}>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          data-testid={`knowledge-doc-${key}`}
                          onClick={() => setOpen(doc)}
                        >
                          {doc.title}
                        </button>
                        <span className="muted" style={{ display: 'block', fontSize: 'var(--fs-meta)' }}>
                          {AREA_LABEL[doc.area]} · {doc.department} · {describeSize(doc.bytes)}
                          {doc.text === null ? ' · too large to show here' : null}
                        </span>
                      </td>
                      <td data-testid={`memory-from-${key}`}>
                        {origin.kind === 'unknown' ? <Absent /> : origin.who}
                      </td>
                      <td data-testid={`memory-added-${key}`}>
                        {describeOrigin(origin, onDate) ?? <Absent />}
                      </td>
                      {/* Deliberately empty. See the note under the table, and the header comment. */}
                      <td data-testid={`memory-used-${key}`}><Absent /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="muted" data-testid="memory-used-note"
             style={{ fontSize: 'var(--fs-meta-lg)', maxWidth: 'var(--content-narrow)', marginTop: '0.5rem' }}>
            <strong>Last used</strong> is empty because nothing yet records which documents your team
            read while it worked. It stays empty rather than showing you a number nobody measured.
          </p>

          {provenanceMissing ? (
            <p className="muted" data-testid="memory-provenance-missing" style={{ fontSize: 'var(--fs-meta-lg)' }}>
              Where some of these came from could not be read just now, so those rows show a dash.
            </p>
          ) : null}
        </>
      ) : null}

      <hr className="hr" />

      <Routines ventureId={ventureId} routines={routines} errors={routineErrors} />

      {open ? <Reader doc={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/**
 * The top of the screen: what it is, and the one control that needs nothing read.
 *
 * Shared with `MemoryWaiting` below rather than copied, so the screen a founder sees for the first
 * 200 ms and the screen they see after are the same screen with more in it.
 */
function MemoryHeading({
  ventureId,
  ventureName,
  summary,
}: {
  /** Null on the waiting shell: the Add control is omitted there, so there is nothing to file to. */
  ventureId: string | null;
  ventureName: string;
  summary: string | null;
}) {
  return (
    <>
      <p className="eyebrow"><span className="eyebrow-id">Memory</span> — {ventureName}</p>
      <h1 style={{ margin: '0 0 0.35rem' }}>What {ventureName} knows</h1>
      {summary ? (
        <p data-testid="memory-summary" style={{ margin: '0 0 0.3rem', fontSize: 'var(--fs-subhead)' }}>
          {summary}
        </p>
      ) : null}
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)', marginTop: 0 }}>
        Everything you have handed over or your team has learned. The composer reads all of it before
        it drafts anything.
      </p>
      {/* Omitted while waiting. Content in a Suspense fallback is not hydrated, so a form here would
          be present, duplicated in the document beside the real one, and dead to the touch — the
          exact dead control the design contract forbids. */}
      {ventureId === null ? null : <Add ventureId={ventureId} />}
    </>
  );
}

/**
 * Memory, drawn before its documents are in (FB-157).
 *
 * The corpus and its provenance cost ~2.6s against production data, and the whole screen waited on
 * them. The heading and the explanation are true before a single document has been read, so they
 * render immediately.
 *
 * No summary sentence and no skeleton rows: both would be claims about a corpus nobody has counted.
 * And no Add control — see `MemoryHeading`; a form in a fallback is inert and duplicated.
 */
export function MemoryWaiting({ ventureName }: { ventureName: string }) {
  return (
    <section data-testid="knowledge-waiting">
      <MemoryHeading ventureId={null} ventureName={ventureName} summary={null} />
      <p className="muted" data-testid="knowledge-waiting-line" style={{ fontSize: 'var(--fs-body-sm)' }}>
        Reading what your venture holds&hellip;
      </p>
    </section>
  );
}

/**
 * A fact the studio does not hold. One shape for it, so an absence never reads as a value.
 *
 * The dash has a text twin rather than an `aria-label`: a label on a plain `<span>` is not reliably
 * announced, and the design contract's own rule is that state carried by a glyph alone is state a
 * screen-reader user does not get.
 */
function Absent() {
  return (
    <>
      <span aria-hidden="true" className="muted">—</span>
      <span className="sr-only">not recorded</span>
    </>
  );
}

/**
 * Handing a document over, with the rules stated where the button is.
 *
 * The ticket expected this to be a control that says why it does not work yet. It does work: FB-106
 * built the path, and it goes the same way every other change goes — proposed for a human to accept,
 * never written straight into the venture's records (CLAUDE.md #4). So it is the real thing, and the
 * copy says what actually happens rather than promising it is already in use.
 */
function Add({ ventureId }: { ventureId: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-testid="knowledge-upload"
      style={{ margin: '1rem 0 1.5rem' }}
      action={(form) => startTransition(async () => setResult(await depositDocument(ventureId, form)))}
    >
      <label htmlFor="knowledge-file" style={{ fontSize: 'var(--fs-body-sm)', display: 'block', marginBottom: '0.3rem' }}>
        Add a document
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input id="knowledge-file" name="file" type="file" data-testid="knowledge-file"
               style={{ fontSize: 'var(--fs-body-sm)', maxWidth: '100%' }} />
        <button type="submit" className="btn" data-testid="knowledge-submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      {/* The rules, at the point of upload, from the constants the code enforces — never a second
          copy that can drift. A founder who meets a refusal they were not warned about learns the
          studio does not know its own limits. */}
      <p className="muted" data-testid="knowledge-limits" style={{ fontSize: 'var(--fs-meta)', margin: '0.35rem 0 0' }}>
        {ACCEPTED_DESCRIPTION} It is proposed for your OK before your team uses it.
      </p>
      {result ? (
        <p data-testid="knowledge-result"
           style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0', color: result.ok ? undefined : toneColor('attention') }}>
          {result.message}
        </p>
      ) : null}
    </form>
  );
}

/**
 * What happens without you asking — the routines, compactly.
 *
 * The same records as `/venture/[id]/routines`, in the same words and the same tones (the vocabulary
 * is exported from `lib/routines.ts` so the two cannot drift). Read-only here on purpose: this
 * screen answers "what does my venture do on its own", and the screen behind the link is where it is
 * changed. It is also the only route to that screen — the rail has no row for it.
 */
function Routines({ ventureId, routines, errors }: { ventureId: string; routines: Routine[]; errors: string[] }) {
  const now = new Date();
  return (
    <div data-testid="memory-routines">
      <h2 style={{ fontSize: 'var(--fs-h3)', margin: '0 0 0.35rem' }}>What happens without you asking</h2>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)', marginTop: 0 }}>
        Work your team does on a schedule. Nothing runs until you say so.{' '}
        <Link href={`/venture/${ventureId}/routines`} data-testid="memory-routines-link">Change these →</Link>
      </p>

      {errors.length > 0 ? (
        <p className="card" data-testid="memory-routines-error"
           style={{ borderColor: toneColor('attention'), color: toneColor('attention'), fontSize: 'var(--fs-body-sm)' }}>
          ⚠ {errors.join(' ')}
        </p>
      ) : null}

      {routines.length === 0 && errors.length === 0 ? (
        <p className="card muted" data-testid="memory-routines-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
          Nothing runs on a schedule yet. When your team spots something worth doing regularly, it
          will suggest it and wait for your OK.
        </p>
      ) : (
        <ul className="stack" data-testid="memory-routines-list" style={{ listStyle: 'none', margin: 0, padding: 0, gap: '0.5rem' }}>
          {routines.map((routine) => {
            const reason = whyNotRunning(routine, now);
            return (
              <li key={routine.id} className="card" data-testid={`memory-routine-${routine.id}`}
                  style={{ padding: '0.7rem 0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span aria-hidden="true" style={{
                    width: '0.5rem', height: '0.5rem', borderRadius: '50%', flex: 'none',
                    background: toneColor(STATE_TONE[routine.state]),
                  }} />
                  <strong style={{ fontSize: 'var(--fs-body-sm)' }}>{routine.title}</strong>
                  <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>{CADENCE_LABEL[routine.cadence]}</span>
                  <span style={{ color: toneColor(STATE_TONE[routine.state]), fontSize: 'var(--fs-meta-lg)' }}>
                    {STATE_LABEL[routine.state]}
                  </span>
                </div>
                {reason ? (
                  <p className="muted" style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.25rem 0 0' }}>{reason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Reading a document without leaving the studio — the point of the whole page. */
function Reader({ doc, onClose }: { doc: KnowledgeDoc; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={doc.title} data-testid="knowledge-reader"
         style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(23,25,31,0.25)' }} />
      <aside style={{
        position: 'relative', width: 'min(40rem, 100%)', height: '100%', overflowY: 'auto',
        background: 'var(--color-paper-raised)', borderLeft: '1px solid var(--color-border-strong)',
        border: '1px solid var(--color-border-strong)', padding: '1.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <h2 style={{ margin: 0, flex: 1 }} data-testid="knowledge-reader-title">{doc.title}</h2>
          <button className="btn" onClick={onClose} data-testid="knowledge-reader-close" aria-label="Close">✕</button>
        </div>
        <p className="muted" style={{ fontSize: 'var(--fs-meta)' }}>{doc.department} · {describeSize(doc.bytes)}</p>
        <hr className="hr" style={{ margin: '1rem 0' }} />
        {doc.text === null ? (
          <p className="muted" style={{ fontSize: 'var(--fs-body-sm)' }}>
            This one is too large to show here. It is safely in your venture&rsquo;s records and your
            team can still read it.
          </p>
        ) : (
          <div className="ticket-body" style={{ fontSize: 'var(--fs-body-sm)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{showAngleBrackets(doc.text)}</ReactMarkdown>
          </div>
        )}
      </aside>
    </div>
  );
}
