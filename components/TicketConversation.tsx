'use client';

import { useState, useTransition } from 'react';
import { appendToThread } from '@/app/actions/threads';
import { threadRows, type ThreadMessage } from '@/lib/threads';
import { toneColor } from '@/lib/status';
import { relativeDay } from '@/lib/when';
import { Mark } from './Mark';

/**
 * The conversation on a ticket (FB-209).
 *
 * ## What changed for a founder
 *
 * A note left on a ticket can now be read on that ticket. The composer — or Claude, through the
 * studio's tools — could already leave one, and it was saved, and no screen showed it: the studio
 * kept that promise in one direction only. Now the note sits under the ticket, above the decision,
 * because it is context for the decision. The founder can answer in the same place, and the answer
 * goes into the same thread.
 *
 * ## What it does not do
 *
 * Tell anyone. Nothing leaves the company from here, and a founder reading their own ticket is not
 * an external action. Nor can a message be edited or deleted: the thread is a record, and a record
 * is added to, never rewritten.
 *
 * The server reads the thread, checking that this person may see this venture, before anything is
 * drawn (CLAUDE.md #6). This component only shows what it was given and sends what is typed.
 */
export type ConversationStart =
  | { ok: true; messages: ThreadMessage[] }
  | { ok: false; message: string };

export function TicketConversation({
  ventureId,
  repo,
  ticketId,
  start,
  now,
}: {
  ventureId: string;
  repo: string;
  ticketId: string;
  start: ConversationStart;
  /** The server's clock when the page was drawn, so the first paint says the same day on both sides. */
  now: number;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(start.ok ? start.messages : []);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(now);
  const [pending, startTransition] = useTransition();

  const rows = threadRows(messages);

  const send = () => startTransition(async () => {
    setError(null);
    const r = await appendToThread(ventureId, repo, ticketId, 'founder', draft);
    if (r.ok && r.thread) {
      setMessages(r.thread.messages);
      setDraft('');
      // A message written just now must read as today, not as a date the page's clock has not reached.
      setClock(Date.now());
    } else {
      setError(r.message || 'Could not save that message — please try again.');
    }
  });

  return (
    <section
      data-testid="ticket-conversation"
      aria-labelledby={`conversation-${ticketId}`}
      style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}
    >
      <p className="eyebrow" id={`conversation-${ticketId}`} style={{ marginTop: 0 }}>
        The conversation{rows.length ? ` · ${rows.length}` : ''}
      </p>

      {!start.ok ? (
        // Unreadable is not empty. Saying "nothing has been said" over a read that failed would tell
        // the founder their team's notes are gone (CLAUDE.md #10). No box either: answering a
        // conversation you cannot see would start a second one over the first.
        <p className="muted" data-testid="conversation-unreadable" style={{ fontSize: 'var(--fs-body-sm)', margin: 0 }}>
          <Mark />{start.message} Nothing in it is lost.
        </p>
      ) : (
        <>
          {rows.length === 0 ? (
            // FB-066's rule: an empty space says what it is for.
            <p className="muted" data-testid="conversation-empty" style={{ fontSize: 'var(--fs-body-sm)', margin: '0 0 0.75rem', maxWidth: 'var(--content-narrow)' }}>
              Nothing has been said about this ticket yet. Ask a question, or write down what should
              change, and it is kept here with the ticket, word for word.
            </p>
          ) : (
            <ol data-testid="conversation-rows" style={{ listStyle: 'none', margin: '0 0 0.75rem', padding: 0 }}>
              {rows.map((row, i) => (
                <li
                  key={`${row.at}-${i}`}
                  data-testid="conversation-row"
                  data-mine={row.mine ? 'true' : 'false'}
                  style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}
                >
                  <p
                    className="eyebrow"
                    title={row.at}
                    style={{ margin: '0 0 0.3rem', color: row.mine ? 'var(--color-ink-muted)' : 'var(--color-accent)' }}
                  >
                    {row.who}
                    {relativeDay(row.at, clock) ? <> · {relativeDay(row.at, clock)}</> : null}
                  </p>
                  {/* Verbatim, line breaks and all. Never rendered as markup: these are someone's
                      own words, and a stray asterisk should not turn into bold. */}
                  <p style={{ fontSize: 'var(--fs-body-sm)', margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: 'var(--content-narrow)' }}>
                    {row.text}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <label htmlFor={`conversation-input-${ticketId}`} className="sr-only">
            Add to the conversation on this ticket
          </label>
          <textarea
            id={`conversation-input-${ticketId}`}
            data-testid="conversation-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={rows.length ? 'Answer, or add something…' : 'What would you like to ask or change?'}
            style={{
              width: '100%', maxWidth: 'var(--content-narrow)', padding: '0.6rem', fontFamily: 'inherit',
              fontSize: 'var(--fs-body-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-paper-raised)', color: 'var(--color-ink)', display: 'block',
            }}
          />
          {error ? (
            <p data-testid="conversation-error" style={{ fontSize: 'var(--fs-body-sm)', color: toneColor('attention'), margin: '0.4rem 0 0' }}>
              <Mark />{error}
            </p>
          ) : null}
          <p style={{ margin: '0.5rem 0 0', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              data-testid="conversation-send"
              disabled={pending || !draft.trim()}
              onClick={send}
            >
              {pending ? 'Saving…' : 'Add to the conversation'}
            </button>
            <span className="muted" style={{ fontSize: 'var(--fs-meta-lg)' }}>
              This starts no work and tells nobody.
            </span>
          </p>
        </>
      )}
    </section>
  );
}
