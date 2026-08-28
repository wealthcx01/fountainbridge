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

import { GitHubClient } from '@/lib/github';
import { requireVentureRepo } from '@/lib/venture-access';
import { fullRepoName } from '@/lib/venture-repos';
import {
  THREADS_REF,
  appendMessage,
  emptyThread,
  isSafeTicketId,
  parseThread,
  threadPath,
  type Thread,
  type ThreadRole,
} from '@/lib/threads';

export interface ThreadResult {
  ok: boolean;
  message: string;
  thread?: Thread;
}

/** Everything both entry points must check before touching a venture's state. */
async function guard(ventureId: string, repo: string, ticketId: string) {
  if (!isSafeTicketId(ticketId)) return { error: 'That is not a ticket.' as const };
  // Sign-in, venture scope, and the repo actually belonging to this venture — shared with the plan
  // filer (FB-127) rather than written twice, because the second copy is the one that drifts.
  const access = await requireVentureRepo(ventureId, repo);
  return access.ok ? { venture: access.venture, email: access.email } : { error: access.error };
}

/** The thread for a ticket, or an empty one. Never null: a conversation nobody has started is a real state. */
export async function readThread(ventureId: string, repo: string, ticketId: string): Promise<ThreadResult> {
  const g = await guard(ventureId, repo, ticketId);
  if ("error" in g && g.error) return { ok: false, message: g.error };

  const client = new GitHubClient();
  let raw: string | null = null;
  try {
    raw = await client.getFileContent(fullRepoName(repo), threadPath(repo, ticketId), THREADS_REF);
  } catch {
    // A read that failed is not an empty conversation, and must not be shown as one.
    return { ok: false, message: 'Could not read this conversation — please try again.' };
  }

  const parsed = parseThread(raw);
  if (raw && !parsed) {
    // Stored but unreadable. Said out loud rather than silently starting a new thread over the top of
    // a founder's own words.
    console.error('[threads] stored thread did not parse', { ventureId, repo, ticketId });
    return { ok: false, message: 'This conversation is stored but could not be read. Nothing was changed.' };
  }

  return {
    ok: true,
    message: '',
    thread: parsed ?? emptyThread(ventureId, repo, ticketId, new Date().toISOString()),
  };
}

/**
 * Add one turn.
 *
 * Read-modify-write against the ref. Two founders in one venture typing about one ticket at the same
 * moment is not a thing yet, and if it becomes one the last write wins — which loses a message rather
 * than corrupting a thread. Said here rather than discovered later.
 */
export async function appendToThread(
  ventureId: string,
  repo: string,
  ticketId: string,
  role: ThreadRole,
  text: string,
): Promise<ThreadResult> {
  const g = await guard(ventureId, repo, ticketId);
  if ("error" in g && g.error) return { ok: false, message: g.error };
  if (!text.trim()) return { ok: false, message: 'Nothing to add.' };

  const writeToken = process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  if (!writeToken) return { ok: false, message: 'Saving conversations is not set up on the studio yet.' };

  const existing = await readThread(ventureId, repo, ticketId);
  if (!existing.ok || !existing.thread) return existing;

  const at = new Date().toISOString();
  const next = appendMessage(existing.thread, { at, role, text });
  if (next === existing.thread) return { ok: true, message: '', thread: next }; // empty or duplicate turn

  const writer = new GitHubClient({ token: writeToken });
  try {
    await writer.putFile(fullRepoName(repo), threadPath(repo, ticketId), {
      content: JSON.stringify(next, null, 2),
      message: `thread: ${ticketId} (${role})`,
      branch: THREADS_REF,
    });
  } catch (err) {
    // Surfaced, not swallowed: a founder whose message did not save must not be shown a thread that
    // says it did. CLAUDE.md #10.
    console.error('[threads] write failed', { ventureId, repo, ticketId, err });
    return { ok: false, message: 'Could not save that message — please try again.' };
  }

  return { ok: true, message: '', thread: next };
}
