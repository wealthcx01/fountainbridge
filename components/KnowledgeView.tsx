'use client';

import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AREA_LABEL, byArea, describeSize, type KnowledgeDoc } from '@/lib/knowledge';
import { ACCEPTED_DESCRIPTION } from '@/lib/documents';
import { showAngleBrackets } from '@/lib/markdown';
import { toneColor } from '@/lib/status';
import { depositDocument } from '@/app/actions/knowledge';

/**
 * What your venture knows (FB-106).
 *
 * The founder's own uploads, visible for the first time. Grouped by area rather than listed flat,
 * because the two mean different things — background the team reads before it works, and artifacts it
 * produced or was handed — and someone scanning for "did my price list land?" is looking inside one
 * of them.
 *
 * Reading happens here, in the studio, rather than by sending the founder to a code host: the whole
 * reason this page exists is that the only way to see the corpus was GitHub.
 */
export function KnowledgeView({
  ventureId,
  ventureName,
  docs,
  errors,
}: {
  ventureId: string;
  ventureName: string;
  docs: KnowledgeDoc[];
  errors: string[];
}) {
  const [open, setOpen] = useState<KnowledgeDoc | null>(null);
  const groups = byArea(docs);

  return (
    <section data-testid="knowledge">
      <p className="eyebrow"><span className="eyebrow-id">Knowledge</span> — {ventureName}</p>
      <h1 style={{ margin: '0 0 0.5rem' }}>What your venture knows</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)' }}>
        Everything you have given this venture. Your team reads this before it works, which is why a
        good document today makes next month&rsquo;s work better.
      </p>

      <Upload ventureId={ventureId} />

      {/* An unreadable corpus must never render as "you have given it nothing". The difference
          between those two, on this page, is a founder's own work. */}
      {errors.length > 0 ? (
        <p className="card" data-testid="knowledge-error"
           style={{ borderColor: toneColor('attention'), color: toneColor('attention'), fontSize: 'var(--fs-body-sm)' }}>
          ⚠ {errors.join(' ')} What you have given it is still there — this page could not read it just now.
        </p>
      ) : null}

      {groups.length === 0 && errors.length === 0 ? (
        <p className="card muted" data-testid="knowledge-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
          Nothing yet. Hand over a document above, or give one to the composer mid-conversation — a
          price list, a pitch deck, the notes behind a decision.
        </p>
      ) : null}

      {groups.map((group) => (
        <div key={group.area} data-testid={`knowledge-${group.area}`} style={{ marginTop: '1.5rem' }}>
          <p className="eyebrow" style={{ marginBottom: '0.15rem' }}>{group.area}</p>
          <p className="muted" style={{ fontSize: 'var(--fs-meta)', margin: '0 0 0.5rem' }}>{AREA_LABEL[group.area]}</p>
          <div className="stack" style={{ gap: '0.5rem' }}>
            {group.docs.map((doc) => (
              <button
                key={doc.path}
                type="button"
                className="card card-link"
                data-testid={`knowledge-doc-${doc.path}`}
                style={{ textAlign: 'left', cursor: 'pointer', padding: '0.7rem 0.85rem', width: '100%' }}
                onClick={() => setOpen(doc)}
              >
                <div style={{ fontSize: 'var(--fs-body-sm)' }}>{doc.title}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-meta)', marginTop: '0.2rem' }}>
                  {doc.department} · {describeSize(doc.bytes)}
                  {doc.text === null ? ' · too large to show here' : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {open ? <Reader doc={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** Handing a document over, with the rules stated where the button is. */
function Upload({ ventureId }: { ventureId: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-testid="knowledge-upload"
      style={{ margin: '1rem 0' }}
      action={(form) => startTransition(async () => setResult(await depositDocument(ventureId, form)))}
    >
      <label htmlFor="knowledge-file" style={{ fontSize: 'var(--fs-body-sm)', display: 'block', marginBottom: '0.3rem' }}>
        Hand over a document
      </label>
      <input id="knowledge-file" name="file" type="file" data-testid="knowledge-file"
             style={{ fontSize: 'var(--fs-body-sm)' }} />
      <button type="submit" className="btn" data-testid="knowledge-submit" disabled={pending} style={{ marginLeft: '0.5rem' }}>
        {pending ? 'Saving…' : 'Save it'}
      </button>
      {/* The rules, at the point of upload, from the constants the code enforces — never a second
          copy that can drift. A founder who meets a refusal they were not warned about learns the
          studio does not know its own limits. */}
      <p className="muted" data-testid="knowledge-limits" style={{ fontSize: 'var(--fs-meta)', margin: '0.35rem 0 0' }}>
        {ACCEPTED_DESCRIPTION} Nothing is used until you approve it.
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

/** Reading a document without leaving the studio — the point of the whole page. */
function Reader({ doc, onClose }: { doc: KnowledgeDoc; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={doc.title} data-testid="knowledge-reader"
         style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(23,25,31,0.25)' }} />
      <aside style={{
        position: 'relative', width: 'min(40rem, 100%)', height: '100%', overflowY: 'auto',
        background: 'var(--color-paper-raised)', borderLeft: '1px solid var(--color-border-strong)',
        boxShadow: 'var(--shadow-lg)', padding: '1.75rem',
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
