'use server';

/**
 * Reading and writing a ticket's conversation (FB-126, gap G4).
 *
 * ## What this changes for a founder
 *
 * Their conversation about a ticket survives the tab. Before this it did not: FB-065 kept transcripts
 * in `localStorage`, deliberately, and the consequence was that the reasoning behind a revision was
 * gone the moment a browser closed. The trail could show that a ticket changed and never why.
 *
 * ## What it does not change
 *
 * **The gate.** Adding to a thread is a conversation; filing a revision is a filing, and only the
 * second needs the founder's word. FB-119 settled the two shapes and they hold here: a reply that
 * asks does not file, and a founder who has already said go is obeyed without being asked again.
 *
 * Appending a message writes venture state and nothing else. It opens no pull request, changes no
 * ticket, and tells no lane to do anything.
 */

import { requireVentureRepo, type Actor } from '@/lib/venture-access';
import { defaultThreadStore } from '@/lib/thread-store';
import {
  appendMessage,
  emptyThread,
  isSafeTicketId,
  parseThread,
  type Thread,
  type ThreadRole,
} from '@/lib/threads';

export interface ThreadResult {
  ok: boolean;
  message: string;
  thread?: Thread;
}

/** Everything both entry points must check before touching a venture's state. */
async function guard(ventureId: string, repo: string, ticketId: string, actor?: Actor) {
  if (!isSafeTicketId(ticketId)) return { error: 'That is not a ticket.' as const };
  // Sign-in, venture scope, and the repo actually belonging to this venture — shared with the plan
  // filer (FB-127) rather than written twice, because the second copy is the one that drifts.
  const access = await requireVentureRepo(ventureId, repo, actor);
  return access.ok ? { venture: access.venture, email: access.email } : { error: access.error };
}

type Loaded = { ok: true; thread: Thread; sha?: string } | { ok: false; message: string };

/**
 * The stored thread and the version it was read at, AFTER the guard has passed.
 *
 * Shared by both actions so that appending does not go back through `readThread`. It used to, and
 * dropped the caller's actor on the way: a note from the studio's tools passed the first check as
 * the tool, then hit the second as nobody signed in, and was refused. No note left through
 * `comment_on_ticket` had ever saved (FB-209).
 */
async function load(ventureId: string, repo: string, ticketId: string): Promise<Loaded> {
  let stored: { text: string; sha?: string } | null;
  try {
    stored = await defaultThreadStore().read(repo, ticketId);
  } catch {
    // A read that failed is not an empty conversation, and must not be shown as one.
    return { ok: false, message: 'Could not read this conversation — please try again.' };
  }

  const parsed = parseThread(stored?.text);
  if (stored && !parsed) {
    // Stored but unreadable. Said out loud rather than silently starting a new thread over the top of
    // a founder's own words.
    console.error('[threads] stored thread did not parse', { ventureId, repo, ticketId });
    return { ok: false, message: 'This conversation is stored but could not be read. Nothing was changed.' };
  }

  return {
    ok: true,
    thread: parsed ?? emptyThread(ventureId, repo, ticketId, new Date().toISOString()),
    sha: stored?.sha,
  };
}

/** The thread for a ticket, or an empty one. Never null: a conversation nobody has started is a real state. */
export async function readThread(
  ventureId: string, repo: string, ticketId: string, actor?: Actor,
): Promise<ThreadResult> {
  const g = await guard(ventureId, repo, ticketId, actor);
  if ("error" in g && g.error) return { ok: false, message: g.error };

  const loaded = await load(ventureId, repo, ticketId);
  return loaded.ok ? { ok: true, message: '', thread: loaded.thread } : { ok: false, message: loaded.message };
}

/**
 * Add one turn.
 *
 * Read-modify-write against the ref. Two people in one venture typing about one ticket at the same
 * moment is not a thing yet. If it happens, the second save names a version that is no longer the
 * latest, is refused, and that person is told their message did not save — so a message can be
 * refused, but one already saved is never written over.
 */
export async function appendToThread(
  ventureId: string,
  repo: string,
  ticketId: string,
  role: ThreadRole,
  text: string,
  /** Set when the caller is a tool rather than a browser (FB-200). Narrower than a session. */
  actor?: Actor,
): Promise<ThreadResult> {
  const g = await guard(ventureId, repo, ticketId, actor);
  if ("error" in g && g.error) return { ok: false, message: g.error };
  if (typeof text !== 'string' || !text.trim()) return { ok: false, message: 'Nothing to add.' };
  // A browser can call this directly with any role it likes (a server action is a public endpoint).
  // Only the two roles the record knows are written.
  if (role !== 'founder' && role !== 'composer') return { ok: false, message: 'That is not someone who can speak here.' };

  const store = defaultThreadStore();
  if (!store.canWrite()) return { ok: false, message: 'Saving conversations is not set up on the studio yet.' };

  const existing = await load(ventureId, repo, ticketId);
  if (!existing.ok) return { ok: false, message: existing.message };

  const at = new Date().toISOString();
  const next = appendMessage(existing.thread, { at, role, text });
  if (next === existing.thread) return { ok: true, message: '', thread: next }; // empty or duplicate turn

  try {
    await store.write(repo, ticketId, JSON.stringify(next, null, 2), `thread: ${ticketId} (${role})`, existing.sha);
  } catch (err) {
    // Surfaced, not swallowed: a founder whose message did not save must not be shown a thread that
    // says it did. CLAUDE.md #10.
    console.error('[threads] write failed', { ventureId, repo, ticketId, err });
    return { ok: false, message: 'Could not save that message — please try again.' };
  }

  return { ok: true, message: '', thread: next };
}
