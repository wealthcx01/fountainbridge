'use client';

import { useState, useTransition } from 'react';
import type { WorkItem } from '@/lib/work';
import { acceptability, describeChange, isReadable, summariseChanges } from '@/lib/work';
import { toneColor } from '@/lib/status';
import { CHECK_LABEL } from '@/lib/glossary';
import { readEvidence, waitingFor } from '@/lib/work-evidence';
import { acceptWork } from '@/app/actions/work';

/**
 * A piece of work, as the founder reads and accepts it (FB-064).
 *
 * The rule this component exists to keep: **show what can be judged, describe what cannot.** Prose —
 * a ticket, a piece of copy, something the founder deposited — is rendered so they can read it. Code
 * is described: what it touches, how big it is, and whether the checks passed. Rendering a
 * TypeScript diff and calling it a review would be asking a founder to rubber-stamp something they
 * cannot read.
 */

const KIND_LABEL: Record<string, string> = {
  description: 'The description of the work',
  writing: 'Writing',
  knowledge: 'Something your venture knows',
  code: 'A change to the app',
  settings: 'Settings',
};

// FB-076 moved this to lib/glossary: the attention queue shows the same fact, and while each
// surface owned its own copy they drifted — one said "no automatic checks", the other `CI UNKNOWN`.

/**
 * The team's notes, as a decision (FB-081).
 *
 * Three things in order — what it did, whether it was checked, and what was unusual — with the whole
 * record behind a control. When the body cannot be understood, `summarised` is false and everything
 * is shown: a summary that quietly dropped the paragraph explaining why something is risky would be
 * worse than the wall of text it replaced.
 */
function Evidence({ body }: { body: string }) {
  const [showAll, setShowAll] = useState(false);
  const e = readEvidence(body);

  return (
    <div data-testid="work-description" style={{ marginTop: '1.25rem' }}>
      <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>What the team says about it</p>

      {e.did ? (
        <p data-testid="work-did" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)', margin: '0 0 0.5rem' }}>
          {e.did}
        </p>
      ) : null}

      {e.verdict ? (
        <p data-testid="work-verdict" style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.5rem', color: toneColor('ok') }}>
          {e.verdict}
        </p>
      ) : null}

      {/* The point of the whole ticket. "All eight gates passed" is one line; "it took three
          attempts" is the line worth reading, and it used to be indistinguishable from the routine. */}
      {e.exceptions.length > 0 ? (
        <div data-testid="work-exceptions" style={{ marginBottom: '0.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Worth knowing</p>
          {e.exceptions.map((x, i) => (
            <p key={i} data-testid="work-exception"
               style={{ fontSize: 'var(--fs-meta-lg)', margin: '0.15rem 0 0 0.9rem', textIndent: '-0.9rem',
                        color: toneColor('attention'), maxWidth: 'var(--content-narrow)' }}>
              <span aria-hidden="true">· </span>{x}
            </p>
          ))}
        </div>
      ) : null}

      {/* Never hidden — one press, and complete. When nothing could be summarised this is the only
          thing shown, and it is open by default. */}
      <button
        type="button"
        className="btn"
        data-testid="work-record-toggle"
        aria-expanded={showAll || !e.summarised}
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll || !e.summarised ? 'Hide the full record' : 'Show me everything the team recorded'}
      </button>
      {showAll || !e.summarised ? (
        <pre data-testid="work-record" style={{
          fontSize: 'var(--fs-meta-lg)', whiteSpace: 'pre-wrap', overflowX: 'auto',
          background: 'var(--color-surface)', border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-sm)', padding: '0.7rem', margin: '0.5rem 0 0',
        }}>{body}</pre>
      ) : null}
    </div>
  );
}

export function WorkDetail({ ventureId, work }: { ventureId: string; work: WorkItem }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Decided here from what was rendered, and decided AGAIN server-side against what is current —
  // this one gives the founder a reason, the server one makes a stale accept impossible.
  const verdict = acceptability(work, { seenHeadSha: work.headSha, configured: true });
  const waiting = waitingFor(work.createdAt, Date.now());
  const done = result?.ok || work.merged;
  const checkTone = work.checks === 'failure' || work.checks === 'unavailable' ? 'blocked'
    : work.checks === 'success' ? 'ok' : 'working';

  return (
    <section data-testid={`work-${work.repo}/${work.number}`}>
      <p className="eyebrow">
        <span className="eyebrow-id">Work</span> — waiting for you
      </p>
      <h1 style={{ margin: '0 0 0.5rem' }}>{work.title}</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', marginTop: 0 }}>
        {summariseChanges(work.files, work.moreFiles)}
        {/* FB-081: the queue said "17h old" and this page said nothing about time at all, so a
            founder deciding whether to read it now or later had nothing to decide with. */}
        {waiting ? <> · Waiting {waiting} for you.</> : null}
      </p>

      <p
        data-testid="work-checks"
        data-checks={work.checks}
        style={{
          fontSize: 'var(--fs-body-sm)',
          color: checkTone === 'blocked' ? toneColor('blocked') : undefined,
          fontWeight: checkTone === 'blocked' ? 600 : undefined,
        }}
      >
        {work.checks === 'failure' || work.checks === 'unavailable' ? (
          <>
            <span aria-hidden="true">⚠ </span>
            <span className="sr-only">Warning: </span>
          </>
        ) : null}
        {CHECK_LABEL[work.checks] ?? CHECK_LABEL.unknown}
        {work.previewUrl ? (
          <>
            {' · '}
            <a href={work.previewUrl} target="_blank" rel="noreferrer" data-testid="work-preview">
              See it running
            </a>
          </>
        ) : null}
      </p>

      {/* FB-081: the evidence, as a decision rather than a transcript.
          FB-064 put the whole pull-request body here and was right to — when the change is code a
          founder cannot read, the proof it was checked is what they judge. But the body runs to
          4,000+ characters of gate transcript, and a founder scrolling four thousand words to find
          the button learns to stop reading and press it, which is the rubber-stamping this page
          exists to prevent. So: what it did, whether it was checked, what was UNUSUAL — and the
          whole record one press away, never hidden. */}
      {work.description ? <Evidence body={work.description} /> : null}

      {/* FB-081: the decision comes BEFORE the detail. It used to sit under 13,856 characters, which
          is how a page teaches someone to press the button without reading.
          Same shape as the approve card, on purpose — one pattern for agreeing to something. */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {done ? (
          <span className="tag tag-accent" data-testid="work-state">accepted</span>
        ) : verdict.ok ? (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="work-accept"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(await acceptWork(ventureId, work.repo, work.number, work.headSha));
              })
            }
          >
            {pending ? 'Accepting…' : 'Accept this work'}
          </button>
        ) : (
          <p
            data-testid="work-blocked"
            data-reason={verdict.reason}
            style={{ fontSize: 'var(--fs-body-sm)', margin: 0, maxWidth: 'var(--content-narrow)', color: toneColor('attention') }}
          >
            {verdict.text}
            {verdict.nextStep ? <> <strong>What to do:</strong> {verdict.nextStep}</> : null}
          </p>
        )}
        {result ? (
          <span
            data-testid="work-msg"
            style={{ fontSize: 'var(--fs-body-sm)', color: result.ok ? undefined : toneColor('attention') }}
          >
            {result.message}
          </span>
        ) : null}
      </div>
      {/* What changed. Readable kinds are shown; the rest are described honestly. */}
      <div data-testid="work-changes" style={{ marginTop: '1.25rem' }}>
        <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>What changed</p>
        {work.files.length === 0 ? (
          <p className="card muted" style={{ fontSize: 'var(--fs-body-sm)' }}>
            No changes were recorded for this work.
          </p>
        ) : (
          work.files.map((f, i) => (
            <div key={f.path} className="card" data-testid={`work-file-${i}`} data-kind={f.kind} style={{ marginBottom: '0.6rem' }}>
              <p className="eyebrow" style={{ margin: 0 }}>{KIND_LABEL[f.kind] ?? f.kind}</p>
              {isReadable(f.kind) && f.preview ? (
                <p style={{ fontSize: 'var(--fs-body-sm)', whiteSpace: 'pre-wrap', margin: '0.4rem 0 0', maxWidth: 'var(--content-narrow)' }}>
                  {f.preview}
                </p>
              ) : (
                <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>
                  {describeChange(f)}
                </p>
              )}
            </div>
          ))
        )}
        {work.moreFiles > 0 ? (
          <p className="muted" data-testid="work-more" style={{ fontSize: 'var(--fs-meta)' }}>
            Showing the first {work.files.length} of {work.files.length + work.moreFiles} files.
          </p>
        ) : null}
      </div>

    </section>
  );
}
