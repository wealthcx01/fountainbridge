/**
 * A founder's conversation about one ticket (FB-126, gap G4).
 *
 * ## Why this exists
 *
 * Every ticket in the desk design carries **"Discuss in the composer →"**. A founder reads what their
 * team proposes, disagrees with one line, says so in their own words, and the change files as a
 * revision the lane picks up.
 *
 * That only works if the conversation outlives the tab. Transcripts lived in `localStorage` until
 * this — deliberately, per FB-065 — so the reasoning behind a revision vanished when the browser
 * closed, and the trail could never answer the one question a founder asks about a change: *why?*
 *
 * The design's own line is only true with this built: *"Agreed changes file as a revision the lane
 * picks up; the trail records this conversation as its source."*
 *
 * ## Where a thread lives, and why not where the ticket first said
 *
 * On the venture repo's `foundry-state` ref, under `threads/`, beside `approvals/`, `prps/` and
 * `runreports/` — machine-written venture state that the studio and the lanes both read, pushed
 * directly, no review.
 *
 * **Not `context/`.** That is reviewed content: the deposit tool writes it on a branch and opens a
 * pull request a human merges. Right for a durable fact; absurd for a live transcript, which would
 * mean a pull request per message. D8 governs `context/` and `library/` — durable background and
 * artifacts — and a transcript is neither until a founder decides it is. That decision is a deposit,
 * and it already has a path.
 *
 * Mirrors `schema/Thread.schema.json`; `lib/__tests__/threads.test.ts` holds the two in lock-step.
 */

export type ThreadRole = 'founder' | 'composer';

export interface ThreadMessage {
  at: string;
  role: ThreadRole;
  /** Verbatim. Never summarised — a thread is cited as the source of a revision, and a summary cannot be a source. */
  text: string;
}

export interface Thread {
  venture_id: string;
  repo: string;
  ticket_id: string;
  messages: ThreadMessage[];
  updated_at: string;
}

/** Where a thread lives on the state ref. One file per ticket, per repo. */
export function threadPath(repo: string, ticketId: string): string {
  return `threads/${repo}/${ticketId}.json`;
}

/** The ref threads share with run reports, approvals and PRPs. */
export const THREADS_REF = 'foundry-state';

const TICKET_ID = /^[A-Za-z][A-Za-z0-9_-]{0,60}$/;

/** A ticket id that can safely become a path. Anything else is refused rather than escaped. */
export function isSafeTicketId(id: unknown): id is string {
  return typeof id === 'string' && TICKET_ID.test(id);
}

export function emptyThread(ventureId: string, repo: string, ticketId: string, at: string): Thread {
  return { venture_id: ventureId, repo, ticket_id: ticketId, messages: [], updated_at: at };
}

/**
 * Add a turn.
 *
 * Pure, and returns a new thread rather than mutating: the caller writes the result, and a write that
 * fails must not leave the in-memory copy claiming a message landed.
 *
 * An empty or whitespace-only message is not a turn and is refused. So is a duplicate of the last
 * turn with the same role and text — the composer streams, and a retried write must not double a
 * founder's own words back at them.
 */
export function appendMessage(thread: Thread, message: ThreadMessage): Thread {
  if (!message.text.trim()) return thread;
  const last = thread.messages[thread.messages.length - 1];
  if (last && last.role === message.role && last.text === message.text) return thread;
  return { ...thread, messages: [...thread.messages, message], updated_at: message.at };
}

/**
 * Read a thread from what was stored, or nothing.
 *
 * Tolerant on purpose. A thread that cannot be parsed is a conversation the studio has lost, and
 * throwing here would take the ticket page with it — so it reads as "no thread yet", which is
 * survivable, rather than as a crash, which is not. The caller reports it.
 */
export function parseThread(raw: string | null | undefined): Thread | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const t = value as Partial<Thread>;
  if (!t.venture_id || !t.repo || !t.ticket_id || !Array.isArray(t.messages)) return null;
  const messages = t.messages.filter(
    (m): m is ThreadMessage =>
      Boolean(m) &&
      typeof m === 'object' &&
      typeof (m as ThreadMessage).text === 'string' &&
      typeof (m as ThreadMessage).at === 'string' &&
      ((m as ThreadMessage).role === 'founder' || (m as ThreadMessage).role === 'composer'),
  );
  return {
    venture_id: t.venture_id,
    repo: t.repo,
    ticket_id: t.ticket_id,
    messages,
    updated_at: t.updated_at ?? messages[messages.length - 1]?.at ?? new Date(0).toISOString(),
  };
}
