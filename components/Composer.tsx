'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  documentRefusal, drainSse, emptyStream, formatInline, reduceChunk, withDocument,
  type ComposerAction, type ComposerMessage,
} from '@/lib/composer';
import { toneColor } from '@/lib/status';

/**
 * The conversation, inside the studio (FB-065).
 *
 * What changed is where it lives, not how it behaves: it still asks a short question or two, reads
 * the work back in plain English, and waits for an explicit yes. What it no longer does is take the
 * founder to a different application at a different address to do the most important thing they do.
 *
 * Two decisions worth knowing about:
 *
 * **Actions are shown, never hidden.** When it searches the venture's knowledge or files a ticket,
 * the founder watches that happen. FB-062 is why: the composer once told a founder it had filed a
 * ticket it had not filed. A visible action is the difference between "filed" as a claim and
 * "filed" as evidence.
 *
 * **The transcript lives in this browser.** The engine rejects a conversation id it did not issue
 * and never tells you the one it made, so there is no id to thread by. Keeping the transcript here
 * means a founder who comes back finds their thread, and no venture content is stored on the
 * studio's own host (D1). The honest limit: a different browser is a different thread.
 */

const STORAGE = (ventureId: string) => `foundry:composer:${ventureId}`;
const MAX_KEPT = 40;

export function Composer({ ventureId, ventureName }: { ventureId: string; ventureName: string }) {
  const [messages, setMessages] = useState<ComposerMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [doc, setDoc] = useState<{ name: string; text: string } | null>(null);
  const [live, setLive] = useState<{ content: string; actions: ComposerAction[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [restored, setRestored] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Restore before first paint of the list, so a returning founder never sees their thread flash empty.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE(ventureId));
      if (raw) setMessages(JSON.parse(raw) as ComposerMessage[]);
    } catch {
      // A corrupt or unavailable store is not worth an error at a founder — they just start fresh.
    }
    setRestored(true);
  }, [ventureId]);

  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(STORAGE(ventureId), JSON.stringify(messages));
    } catch {
      // Storage full or blocked: the conversation still works for this session.
    }
  }, [messages, ventureId, restored]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, live]);

  const send = useCallback(async () => {
    const text = withDocument(draft, doc);
    if (!text.trim() || sending) return;

    // Trimmed here, not only on the way to storage: otherwise a long session sends an ever-growing
    // history while a reload of that same session sends the last MAX_KEPT — the same thread behaving
    // two different ways depending on whether the founder refreshed.
    const next: ComposerMessage[] = [...messages, { role: 'user' as const, content: text }].slice(-MAX_KEPT);
    setMessages(next);
    setDraft('');
    setDoc(null);
    setError(null);
    setSending(true);
    setLive({ content: '', actions: [] });

    try {
      const res = await fetch(`/api/composer/${ventureId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        setError(body?.detail ? `${body.error} ${body.detail}` : body?.error ?? 'The composer could not be reached.');
        setLive(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let state = emptyStream();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = drainSse(buffer);
        buffer = rest;
        for (const event of events) {
          if (event === '[DONE]') continue;
          try {
            state = reduceChunk(state, JSON.parse(event));
          } catch {
            // One unparseable chunk must not kill a reply that is otherwise arriving.
          }
        }
        setLive({ content: state.content, actions: state.actions });
      }

      if (!state.content.trim() && state.actions.length === 0) {
        setError('The composer answered with nothing. Try asking again.');
      } else {
        setMessages((m) => [...m, { role: 'assistant' as const, content: state.content, actions: state.actions }].slice(-MAX_KEPT));
      }
    } catch {
      setError('The connection to the composer dropped. Nothing was lost — try sending it again.');
    } finally {
      setLive(null);
      setSending(false);
    }
  }, [draft, doc, messages, sending, ventureId]);

  const attach = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const refusal = documentRefusal(file.name);
    if (refusal) { setError(refusal); return; }
    setError(null);
    setDoc({ name: file.name, text: await file.text() });
  }, []);

  return (
    <section data-testid="composer">
      <p className="eyebrow">
        <span className="eyebrow-id">Composer</span> — {ventureName}
      </p>
      <h1 style={{ margin: '0 0 0.5rem' }}>Tell the studio what you want</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', marginTop: 0, maxWidth: 'var(--content-narrow)' }}>
        Plain English is enough. It will ask a question or two, read the work back to you, and file
        nothing until you say yes.
      </p>

      <div data-testid="composer-thread" style={{ marginTop: '1.25rem' }}>
        {messages.length === 0 && !live ? (
          <p className="card muted" data-testid="composer-empty" style={{ fontSize: 'var(--fs-body-sm)' }}>
            Nothing yet. Describe what you want for {ventureName} — a change, a piece of research, a
            thing that is bothering you.
          </p>
        ) : null}

        {messages.map((m, i) => (
          <Turn key={i} message={m} index={i} />
        ))}

        {live ? <Turn message={{ role: 'assistant', content: live.content, actions: live.actions }} index={-1} streaming /> : null}
        <div ref={bottom} />
      </div>

      {error ? (
        <p
          data-testid="composer-error"
          style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention'), maxWidth: 'var(--content-narrow)' }}
        >
          <span aria-hidden="true">⚠ </span>
          <span className="sr-only">Problem: </span>
          {error}
        </p>
      ) : null}

      {doc ? (
        <p data-testid="composer-doc" style={{ fontSize: 'var(--fs-body-sm)' }}>
          Attached: <strong>{doc.name}</strong>{' '}
          <button type="button" className="btn" onClick={() => setDoc(null)}>Remove</button>
        </p>
      ) : null}

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 'var(--content-narrow)' }}>
        <textarea
          data-testid="composer-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line. A founder writing three sentences should not
            // have to hunt for a button.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
          }}
          rows={3}
          placeholder={`What do you want for ${ventureName}?`}
          aria-label="What do you want?"
          disabled={sending}
          style={{
            width: '100%', padding: '0.7rem', fontSize: 'var(--fs-body)', fontFamily: 'inherit',
            border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface)', color: 'var(--color-ink)', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" data-testid="composer-send" disabled={sending || (!draft.trim() && !doc)} onClick={() => void send()}>
            {sending ? 'Thinking…' : 'Send'}
          </button>
          <input
            ref={fileInput}
            type="file"
            data-testid="composer-file"
            accept=".md,.markdown,.txt,.csv,.tsv,.json,.yaml,.yml,.log"
            style={{ display: 'none' }}
            onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button type="button" className="btn" data-testid="composer-attach" disabled={sending} onClick={() => fileInput.current?.click()}>
            Add a document
          </button>
          {messages.length > 0 ? (
            <button
              type="button"
              className="btn"
              data-testid="composer-clear"
              disabled={sending}
              onClick={() => { setMessages([]); setError(null); }}
            >
              Start again
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Turn({ message, index, streaming }: { message: ComposerMessage; index: number; streaming?: boolean }) {
  const mine = message.role === 'user';
  return (
    <div
      className="card"
      data-testid={streaming ? 'composer-live' : `composer-turn-${index}`}
      data-role={message.role}
      style={{ marginBottom: '0.6rem', maxWidth: 'var(--content-narrow)', marginLeft: mine ? 'auto' : undefined }}
    >
      <p className="eyebrow" style={{ margin: 0 }}>{mine ? 'You' : 'The composer'}</p>

      {(message.actions ?? []).map((a) => (
        <p
          key={a.id}
          data-testid="composer-action"
          data-tool={a.tool}
          style={{ fontSize: 'var(--fs-meta-lg)', color: toneColor('working'), margin: '0.4rem 0 0' }}
        >
          {a.label}
        </p>
      ))}

      {message.content ? (
        <p style={{ fontSize: 'var(--fs-body-sm)', whiteSpace: 'pre-wrap', margin: '0.4rem 0 0' }}>
          {/* Rendered as nodes, never as markup — see formatInline. */}
          {formatInline(message.content).map((s, i) =>
            s.strong ? <strong key={i}>{s.text}</strong>
            : s.code ? <code key={i} className="mono">{s.text}</code>
            : <span key={i}>{s.text}</span>)}
        </p>
      ) : streaming && (message.actions ?? []).length === 0 ? (
        <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>Thinking…</p>
      ) : null}
    </div>
  );
}
