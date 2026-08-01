'use client';

import { useState, useTransition } from 'react';
import type { WorkItem } from '@/lib/work';
import { acceptability, describeChange, isReadable, summariseChanges } from '@/lib/work';
import { toneColor } from '@/lib/status';
import { CHECK_LABEL } from '@/lib/glossary';
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

export function WorkDetail({ ventureId, work }: { ventureId: string; work: WorkItem }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Decided here from what was rendered, and decided AGAIN server-side against what is current —
  // this one gives the founder a reason, the server one makes a stale accept impossible.
  const verdict = acceptability(work, { seenHeadSha: work.headSha, configured: true });
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

      {/* What the team that made this said about it. For lane-built work this is the gate evidence —
          which validation gates held, whether /review cleared it, what /qa saw — and when the change
          itself is code a founder cannot read, this IS the thing they judge. Leaving it out was the
          gap: the view showed the files and hid the reasoning. */}
      {work.description ? (
        <div data-testid="work-description" style={{ marginTop: '1.25rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.5rem' }}>What the team says about it</p>
          <div className="card">
            <p style={{ fontSize: 'var(--fs-body-sm)', whiteSpace: 'pre-wrap', margin: 0, maxWidth: 'var(--content-narrow)' }}>
              {work.description}
            </p>
          </div>
        </div>
      ) : null}

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

      {/* Accept. Same shape as the approve card, on purpose — one pattern for agreeing to something. */}
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
    </section>
  );
}
