/**
 * What happened, as one record (FB-132).
 *
 * ## Why this exists
 *
 * A venture's history lives in three places and a founder can reach none of them together: what the
 * repositories did, what the lanes did, and what the founder themselves decided. The third is the
 * one that has never appeared — a founder could not see their own yes in the record, which is a
 * strange thing to be missing from a page called *what happened*.
 *
 * ## The standard it has to meet
 *
 * *"Sent, failed, refused: it stays here with its state."*
 *
 * A log that quietly drops failures is worse than no log, because it teaches a founder that silence
 * means nothing happened. So nothing here filters for tidiness: a refusal is an entry, a failure is
 * an entry, and both keep their tone.
 *
 * Pure, and takes what has already been read. The merge is where the ordering bugs live; the reads
 * are bounded by their own loaders (FB-123) and this adds none.
 */

import type { ActivityEvent } from './health';
import type { RunReport } from './runreports';
import type { ActiveGraphApproval } from './approvals';
import { describeRun } from './runreports';
import { classifyActivity, dedupeActivity, MEANING_LABEL } from './activity-kind';
import type { Tone } from './status';

export interface FeedItem {
  /** ISO-8601. The feed is ordered by this and nothing else. */
  at: string;
  /** One sentence, in the founder's language. */
  text: string;
  /** Where it came from, and anything worth knowing about it. Never a URL. */
  meta: string;
  tone: Tone;
  /** Which record it came out of, so a reader can tell what they are looking at. */
  source: 'repo' | 'run' | 'decision';
  /** Absolute or studio-relative. Never rendered when absent, never rendered dead. */
  href?: string;
}

export interface FeedInput {
  /** What the venture's repositories did. */
  activity: ActivityEvent[];
  /** What the lanes did. Heartbeats are not events and are dropped by the caller. */
  runs: RunReport[];
  /** External actions and their state — including the founder's own decisions. */
  approvals: ActiveGraphApproval[];
  /** Rendered at most this many. Bounded because the page is, not because the truth is. */
  limit?: number;
}

/**
 * What a founder's own decision reads as.
 *
 * Addressed to the person who made it — "You approved it", not "approval.granted" — because this is
 * the one page where they come looking for their own actions. A status word is what the record says;
 * a sentence is what happened.
 *
 * Every state appears, including the ones nobody enjoys. `failed` and `rejected` are the entries
 * that make the page trustworthy; a feed showing only successes is a feed nobody can rely on.
 */
function decisionOf(a: ActiveGraphApproval): { text: string; tone: Tone } | null {
  switch (a.status) {
    case 'granted': return { text: `You approved: ${a.summary}`, tone: 'ok' };
    case 'rejected': return { text: `You sent back: ${a.summary}`, tone: 'attention' };
    case 'executed': return { text: `Went out: ${a.summary}`, tone: 'ok' };
    case 'executing': return { text: `Going out now: ${a.summary}`, tone: 'working' };
    case 'failed': return { text: `Tried and failed to send: ${a.summary}`, tone: 'blocked' };
    case 'unverified-action':
      return { text: `Recorded as approved, but the studio did not issue that approval: ${a.summary}`, tone: 'blocked' };
    // `proposed` has not happened yet. It belongs in the queue, which is where a founder acts on it —
    // putting it in the history would say something was done when the whole point is that it was not.
    case 'proposed': return null;
    default: return null;
  }
}

/** The dot beside a repository event, from what the studio can say the change actually was. */
function repoTone(event: ActivityEvent): Tone {
  switch (classifyActivity(event)) {
    case 'work-shipped': return 'ok';
    case 'ticket-filed': return 'working';
    case 'knowledge-added': return 'working';
    // `plumbing` and `unknown` are quiet on purpose: a founder scanning for what changed in their
    // product should not have their eye caught by the studio's own housekeeping.
    default: return 'idle';
  }
}

function runTone(r: RunReport): Tone {
  switch (r.outcome) {
    case 'blocked': return 'blocked';
    case 'error': return 'blocked';
    case 'awaiting-approval': return 'attention';
    case 'opened-pr': return 'ok';
    case null: return 'working';
    default: return 'idle';
  }
}

/**
 * One ordered record, newest first.
 *
 * Ordering is by time alone. Ties keep the order the sources were merged in, so two things recorded
 * in the same second do not shuffle between renders — a feed that reorders itself on refresh is one
 * a founder stops believing.
 */
export function buildFeed(input: FeedInput): FeedItem[] {
  const items: FeedItem[] = [];

  for (const event of dedupeActivity(input.activity)) {
    const at = iso(event.at);
    if (!at) continue;
    items.push({
      at,
      text: event.title,
      meta: `${event.repo} · ${MEANING_LABEL[classifyActivity(event)]}`,
      tone: repoTone(event),
      source: 'repo',
      href: event.url || undefined,
    });
  }

  for (const r of input.runs) {
    const at = iso(r.startedAt);
    if (!at) continue;
    items.push({
      at,
      text: describeRun(r),
      meta: `${r.repo} · your team`,
      tone: runTone(r),
      source: 'run',
      href: r.prUrl ?? undefined,
    });
  }

  for (const a of input.approvals) {
    const decision = decisionOf(a);
    // Undated decisions are dropped rather than stamped with now. A history whose times are invented
    // is not a history — the same rule the trail follows.
    const at = iso(a.committedAt);
    if (!decision || !at) continue;
    items.push({ at, text: decision.text, meta: `${a.repo} · your decision`, tone: decision.tone, source: 'decision' });
  }

  items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  return typeof input.limit === 'number' ? items.slice(0, input.limit) : items;
}

function iso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
