import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { GitHubClient } from './github';
import {
  ACTIVEGRAPH_REF, canonicalEvent, eventPath, project, seqFromPath,
  type ActiveGraphEvent, type Projection,
} from './activegraph';

/**
 * Writing and reading the ActiveGraph record (FB-071).
 *
 * ## Where it lives, and why that is only half the answer
 *
 * On a dedicated `foundry-activegraph` ref in the **studio's own repository**, not the venture's.
 * The venture ref is the one the lane holds a write token for, and putting the record there is
 * exactly what made FB-051's version worthless.
 *
 * That move alone is **not sufficient today**, and this file says so rather than implying a
 * guarantee it cannot keep: the lane's PAT is currently scoped to the whole org with admin, so it
 * can write to the studio's repo too (docs/tickets/FB-072). What actually holds is the signature.
 *
 * ## The signature is the gate
 *
 * `FOUNDRY_APPROVAL_SECRET` is held by the studio and the executor and by nothing else — checked on
 * the ARCA box, where it appears in no file under /opt or /etc. `readEvents` verifies every event
 * before the projection sees it, with a constant-time compare, and an event that does not verify is
 * discarded rather than flagged: the projection's whole job is to describe what really happened, and
 * an unverifiable event is not evidence of anything.
 *
 * ⚠ This is the second HMAC formula in the system. The first — `lib/approval-attestation.ts` — signs
 * a *grant* over `{repo, id, proposal_sha, approver}` and is verified by the executor. This one signs
 * an *event* over its canonical form. They are deliberately separate: the grant attestation is a
 * contract with the executor and must not change shape when the log's does.
 */

const EVENT_REPO = () => process.env.STUDIO_EVENT_REPO ?? `${process.env.GITHUB_ORG ?? 'wealthcx01'}/fountainbridge`;

export function signEvent(event: ActiveGraphEvent, secret: string): string {
  return createHmac('sha256', secret).update(canonicalEvent(event)).digest('hex');
}

/**
 * Does this event's signature hold?
 *
 * Constant-time, and false for a missing or malformed signature — a comparison that leaks timing on
 * the one gate protecting external sends is not a gate.
 */
export function verifyEvent(event: ActiveGraphEvent, secret: string): boolean {
  if (!secret || !event?.attestation || typeof event.attestation !== 'string') return false;
  const expected = signEvent(event, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(event.attestation, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Entry { path: string; type: string }

/**
 * Every event recorded for one approval, verified, in order.
 *
 * Returns the events that survived verification and how many did not — the count is surfaced to the
 * founder as "something was recorded here that the studio would not accept", because a log that
 * silently drops what it dislikes cannot be audited either (CLAUDE.md #10).
 */
export async function readEvents(
  client: GitHubClient,
  venture: string,
  repo: string,
  id: string,
  secret: string,
): Promise<{ events: ActiveGraphEvent[]; refused: number }> {
  const shortRepo = repo.includes('/') ? repo.split('/')[1] : repo;
  const dir = `activegraph/${venture}/${shortRepo}/${id}`;

  let entries: Entry[];
  try {
    entries = await client.request<Entry[]>(
      `/repos/${EVENT_REPO()}/contents/${dir}?ref=${ACTIVEGRAPH_REF}`,
    );
  } catch {
    // No directory is the normal case for an approval that has no history yet, not an error.
    return { events: [], refused: 0 };
  }
  if (!Array.isArray(entries)) return { events: [], refused: 0 };

  const files = entries
    .filter((e) => e.type === 'file' && seqFromPath(e.path) !== null)
    .sort((a, b) => (seqFromPath(a.path) ?? 0) - (seqFromPath(b.path) ?? 0));

  const events: ActiveGraphEvent[] = [];
  let refused = 0;
  for (const f of files) {
    const raw = await client.getFileContent(EVENT_REPO(), f.path, ACTIVEGRAPH_REF);
    if (!raw) { refused += 1; continue; }
    let parsed: ActiveGraphEvent;
    try { parsed = JSON.parse(raw) as ActiveGraphEvent; } catch { refused += 1; continue; }
    if (!verifyEvent(parsed, secret)) { refused += 1; continue; }
    // The file's own path must agree with the event inside it, or a valid event could be filed under
    // another approval's history and read as part of its story.
    if (parsed.seq !== seqFromPath(f.path) || parsed.id !== id || parsed.venture !== venture) {
      refused += 1;
      continue;
    }
    events.push(parsed);
  }
  return { events, refused };
}

/** The record for one approval, as a founder should read it. */
export async function historyFor(
  client: GitHubClient,
  venture: string,
  repo: string,
  id: string,
  secret: string,
): Promise<Projection & { refused: number }> {
  const { events, refused } = await readEvents(client, venture, repo, id, secret);
  return { ...project(events), refused };
}

/**
 * Append one event.
 *
 * Never overwrites: the path carries the sequence number, and a write to an existing path is
 * refused rather than replacing it, because "append-only" that can be overwritten is just a file.
 *
 * The write is reported, not swallowed. The previous attempt at this (FB-051) told a founder
 * "Approved" while its audit write had silently failed — the same failure as the composer claiming
 * it had filed a ticket it had not filed.
 */
export async function appendEvent(
  writeToken: string,
  event: Omit<ActiveGraphEvent, 'attestation'>,
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!secret) return { ok: false, reason: 'no signing secret is configured' };
  if (!writeToken) return { ok: false, reason: 'no write credential is configured' };

  const signed: ActiveGraphEvent = { ...event, attestation: signEvent(event as ActiveGraphEvent, secret) };
  const path = eventPath(event.venture, event.repo, event.id, event.seq, event.type);
  const client = new GitHubClient({ token: writeToken });

  const ref = await ensureRef(client);
  if (!ref.ok) return ref;

  const existing = await client.getFileContent(EVENT_REPO(), path, ACTIVEGRAPH_REF).catch(() => null);
  if (existing) return { ok: false, reason: `position ${event.seq} is already recorded` };

  try {
    await client.putFile(EVENT_REPO(), path, {
      content: JSON.stringify(signed, null, 2),
      message: `${event.type} ${event.venture}/${event.id} (${event.actor.kind} ${event.actor.id})`,
      branch: ACTIVEGRAPH_REF,
    });
    return { ok: true };
  } catch (err) {
    console.error('[activegraph] append failed', { path, err });
    return { ok: false, reason: 'the record could not be written to GitHub' };
  }
}

/**
 * Make sure the record's ref exists before writing to it.
 *
 * The contents API does not create a branch — it 404s against one that is missing — so without this
 * the very FIRST approval on a fresh studio would fail to record, and every one after it would
 * succeed. A bug that only appears once, on the first real use, is the kind that reaches a founder.
 *
 * Branched from the default branch, matching how the lane creates the approvals ref
 * (`ensure_approvals_ref` in deploy/lane/foundry-lib.sh).
 */
async function ensureRef(client: GitHubClient): Promise<{ ok: true } | { ok: false; reason: string }> {
  const repo = EVENT_REPO();
  try {
    await client.request(`/repos/${repo}/git/ref/heads/${ACTIVEGRAPH_REF}`);
    return { ok: true };
  } catch {
    // Missing, or unreadable. Try to create it; a genuine permissions problem surfaces here.
  }
  try {
    const info = await client.request<{ default_branch: string }>(`/repos/${repo}`);
    const base = await client.request<{ object: { sha: string } }>(
      `/repos/${repo}/git/ref/heads/${info.default_branch}`,
    );
    await client.request(`/repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${ACTIVEGRAPH_REF}`, sha: base.object.sha }),
    });
    return { ok: true };
  } catch (err) {
    console.error('[activegraph] could not create the record ref', { repo, err });
    return { ok: false, reason: `the record's branch (${ACTIVEGRAPH_REF}) does not exist and could not be created` };
  }
}

/**
 * The next free position for this approval.
 *
 * Read-then-write, so two writers racing can both pick the same number — the append refuses the
 * second one rather than overwriting, which turns a race into a visible failure instead of a lost
 * event. The studio and the executor write at different stages of one approval's life, so the race
 * is narrow; making it impossible needs a store with compare-and-set, which is the Supabase option
 * the ticket left open.
 */
export async function nextSeq(
  client: GitHubClient,
  venture: string,
  repo: string,
  id: string,
  secret: string,
): Promise<number> {
  const { events } = await readEvents(client, venture, repo, id, secret);
  return events.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
}
