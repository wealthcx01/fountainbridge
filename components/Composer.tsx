'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  documentRefusal, draftTitle, drainSse, emptyStream, fileThisMessage, formatInline, hasDraft,
  parseReply, reduceChunk, withDocument,
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // What, if anything, is on the table right now — the title of the draft in the newest reply. Null
  // when the composer has not drafted anything, which is most turns.
  const last = messages[messages.length - 1];
  const decision = last?.role === 'assistant' ? draftTitle(parseReply(last.content)) : null;

  const send = useCallback(async (override?: string) => {
    const text = override ?? withDocument(draft, doc);
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

      {/* FB-075: the decision the whole surface exists for, as a control rather than a sentence the
          founder has to guess. Shown only when there is a real draft on the table, so it is never a
          button that means nothing. */}
      {decision && !sending ? (
        <div data-testid="composer-decision" style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="composer-file-this"
            onClick={() => void send(fileThisMessage(decision))}
          >
            File this
          </button>
          <button
            type="button"
            className="btn"
            data-testid="composer-change"
            onClick={() => inputRef.current?.focus()}
          >
            Change something
          </button>
          <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>
            Nothing is built until you press it.
          </span>
        </div>
      ) : null}

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: 'var(--content-narrow)' }}>
        <textarea
          ref={inputRef}
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
        </div>

        {/* FB-075: away from Send, and it asks first. A founder deliberately writing at length
            should not be one mis-click from losing all of it. */}
        {messages.length > 0 ? (
          <p style={{ margin: '0.6rem 0 0' }}>
            <button
              type="button"
              className="btn"
              data-testid="composer-clear"
              disabled={sending}
              onClick={() => {
                // Two turns is a greeting; more than that is a conversation worth confirming.
                if (messages.length > 2 && !window.confirm('Start again? This clears the whole conversation.')) return;
                setMessages([]);
                setError(null);
              }}
            >
              Start again
            </button>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The composer's words, as a founder reads them (FB-073).
 *
 * Prose is prose. A heading is a heading rather than literal hashes. A ticket draft is folded away
 * behind a control, because it is a contract with the lane and not something a founder was ever
 * meant to read — the version before this put four thousand characters of `## Scope` and `- [ ]` in
 * front of the button.
 *
 * Everything is a React node. Nothing the model writes can become markup.
 */
function Reply({ text, mine }: { text: string; mine: boolean }) {
  const [showDraft, setShowDraft] = useState(false);
  // The founder's own message is what they typed. Parsing it would turn a line starting with "-"
  // into a bullet and a "#" into a heading, which is editing someone's words back at them.
  const blocks = mine ? [{ kind: 'text' as const, text }] : parseReply(text);

  const inline = (t: string) => formatInline(t).map((s, i) =>
    s.strong ? <strong key={i}>{s.text}</strong>
    : s.code ? <code key={i} className="mono">{s.text}</code>
    : <span key={i}>{s.text}</span>);

  return (
    <div style={{ margin: '0.4rem 0 0' }}>
      {blocks.map((b, i) => {
        if (b.kind === 'draft') {
          return (
            <div key={i} data-testid="composer-draft" style={{ margin: '0.6rem 0' }}>
              <button
                type="button"
                className="btn"
                data-testid="composer-draft-toggle"
                aria-expanded={showDraft}
                onClick={() => setShowDraft((v) => !v)}
              >
                {showDraft ? 'Hide the details' : 'Show me exactly what will be filed'}
              </button>
              {showDraft ? (
                <pre
                  data-testid="composer-draft-body"
                  style={{
                    fontSize: 'var(--fs-meta-lg)', whiteSpace: 'pre-wrap', overflowX: 'auto',
                    background: 'var(--color-surface)', border: '1px solid var(--color-rule)',
                    borderRadius: 'var(--radius-sm)', padding: '0.7rem', margin: '0.5rem 0 0',
                  }}
                >
                  {b.text}
                </pre>
              ) : null}
            </div>
          );
        }
        if (b.kind === 'heading') {
          return (
            <p key={i} className="eyebrow" style={{ margin: '0.7rem 0 0.2rem' }}>{b.text}</p>
          );
        }
        if (b.kind === 'item') {
          return (
            <p key={i} style={{ fontSize: 'var(--fs-body-sm)', margin: '0.15rem 0 0 0.9rem', textIndent: '-0.9rem' }}>
              <span aria-hidden="true">· </span>{inline(b.text)}
            </p>
          );
        }
        return (
          <p key={i} style={{ fontSize: 'var(--fs-body-sm)', whiteSpace: 'pre-wrap', margin: '0.5rem 0 0' }}>
            {inline(b.text)}
          </p>
        );
      })}
    </div>
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
        <Reply text={message.content} mine={mine} />
      ) : streaming && (message.actions ?? []).length === 0 ? (
        <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', margin: '0.4rem 0 0' }}>Thinking…</p>
      ) : null}
    </div>
  );
}
