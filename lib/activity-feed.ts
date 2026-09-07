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
import { collapseRepeats, describeRun } from './runreports';
import { founderSentence, readableSlugs } from './founder-sentence';
import { classifyActivity } from './activity-kind';
import { approvalTone, type Tone } from './status';

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
  /** Survives the render cap. For entries that must never be orderable out of sight. */
  pinned?: boolean;
  /**
   * How many identical records this row stands for (FB-180).
   *
   * 1 for almost everything. A lane at its daily budget re-parks every five minutes and each wake
   * writes a record, so twenty of them arrived as twenty rows saying the same sentence — one fact,
   * filling the screen, pushing everything a founder had not read off the bottom.
   */
  repeats?: number;
}

export interface FeedInput {
  /**
   * What the venture's repositories did — **already deduplicated and filtered** by the caller.
   *
   * Not done here, and the order matters: `health.activity` carries a merged pull request WITH its
   * paths and a paired commit WITHOUT them. Filtering first drops the pull request as housekeeping
   * and leaves its twin, which classifies as `unknown` and is founder-visible — so a change to
   * `.github/workflows/` that `/activity` correctly hides reappeared here as "changed". Dedupe, then
   * filter, then pass. The summary must be composed from the same list, or the paragraph counts
   * events the rows below it do not show.
   */
  activity: ActivityEvent[];
  /** What the lanes did. Heartbeats are not events and are dropped by the caller. */
  runs: RunReport[];
  /** External actions and their state — including the founder's own decisions. */
  approvals: ActiveGraphApproval[];
  /** Rendered at most this many. Bounded because the page is, not because the truth is. */
  limit?: number;
  /**
   * Repository → the surface and department that owns it, e.g. `arca` → `Build — Product` (FB-180).
   *
   * The meta column named the repository: `arca · your team`. The design names the surface and its
   * department — `Build · Product`, `Sell · Marketing`, `Research` — which is the vocabulary the
   * rest of the studio already uses and the only one a founder chose. A repository name is an
   * engineering address that happens to be visible.
   *
   * A repository with no department falls back to the venture's own name, never to the repo.
   */
  surfaces?: Record<string, string>;
  /** The venture's name, for a repository no department claims. */
  ventureName?: string;
}

/**
 * The entries one approval produces.
 *
 * **Plural, because an approval is not one event.** A send granted on Monday and executed on
 * Thursday is two things that happened, and the first version emitted one row that was replaced by
 * the second — so the founder's own yes, the entire point of this ticket, was visible only in the
 * window between the grant and the execution.
 *
 * Addressed by NAME, never as "you". Under D7 the approver is often not the reader: Bruntsfield
 * approves platform changes on a founder's venture, and a founder read "You approved" on a decision
 * they never made. The name comes from the attested grant or not at all — an unverified one could
 * have been written by anyone.
 *
 * Every state appears, including the ones nobody enjoys. `failed` and `unverified-action` are the
 * entries that make the page trustworthy; a feed showing only successes is one nobody can rely on.
 */
function decisionsFor(a: ActiveGraphApproval): Array<{ at: string | null; text: string; tone: Tone; pinned?: boolean }> {
  const who = a.approver ?? 'Someone';
  const verb = (t: string) => `${who} ${t}`;

  switch (a.status) {
    // `proposed` has not happened yet. It belongs in the queue, where a founder acts on it — putting
    // it in a history would say something was done when the whole point is that it was not.
    case 'proposed':
      return [];
    case 'granted':
      return [{ at: a.grantedAt ?? a.committedAt, text: verb(`approved: ${a.summary}`), tone: approvalTone('granted') }];
    case 'rejected':
      return [{ at: a.committedAt, text: verb(`sent back: ${a.summary}`), tone: approvalTone('rejected') }];
    case 'executing':
      return [
        ...(a.grantedAt ? [{ at: a.grantedAt, text: verb(`approved: ${a.summary}`), tone: approvalTone('granted') }] : []),
        { at: a.committedAt, text: `Going out now: ${a.summary}`, tone: approvalTone('executing') },
      ];
    case 'executed':
      return [
        // The approval keeps its own entry AND its own time. Stamping it with the execution's clock
        // filed a Monday decision under Thursday in a feed sold as newest-first.
        ...(a.grantedAt ? [{ at: a.grantedAt, text: verb(`approved: ${a.summary}`), tone: approvalTone('granted') }] : []),
        { at: a.committedAt, text: `Went out: ${a.summary}`, tone: approvalTone('executed') },
      ];
    case 'failed':
      return [
        ...(a.grantedAt ? [{ at: a.grantedAt, text: verb(`approved: ${a.summary}`), tone: approvalTone('granted') }] : []),
        { at: a.committedAt, text: `Tried and failed to send: ${a.summary}`, tone: approvalTone('failed'), pinned: true },
      ];
    case 'unverified-action':
      return [{
        at: a.committedAt,
        text: `Recorded as approved, but the studio did not issue that approval: ${a.summary}`,
        tone: approvalTone('unverified-action'),
        // Pinned past the render cap. Its timestamp comes out of the very grant nobody can verify,
        // so whoever wrote the forgery also chose where it sorts — `granted_at: "2020-01-01"` put it
        // at the bottom and the cap then cut it from the page entirely. The one entry that must
        // never be orderable out of sight.
        pinned: true,
      }];
    default: {
      // Exhaustiveness, deliberately. `failed` and `unverified-action` were both added to this union
      // after the fact; a silent `return null` meant the next one added would vanish from the record
      // with a green typecheck — the exact thing "nothing is filtered for tidiness" forbids.
      const unhandled: never = a.status;
      return [{ at: a.committedAt, text: `Something happened that this studio does not recognise: ${a.summary}`, tone: 'blocked', pinned: true }];
      void unhandled;
    }
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
export function buildFeed(input: FeedInput): { items: FeedItem[]; truncated: boolean } {
  const items: FeedItem[] = [];

  // Where a repository sits in the venture, in the founder's words rather than in git's.
  const surfaceOf = (repo: string): string =>
    input.surfaces?.[repo] ?? input.ventureName ?? 'Your venture';

  for (const event of input.activity) {
    const at = iso(event.at);
    if (!at) continue;
    const meaning = classifyActivity(event);
    items.push({
      at,
      // Built from what the event MEANS, not from what was typed into the commit. `event.title` is
      // an engineering artefact — `build: ARCA-062-arca-brand-redesign (Foundry lane)` — and every
      // row in the design is a sentence about the venture.
      text: founderSentence(meaning, event.title),
      // The surface and its department, and nothing else. The meaning is in the sentence — saying
      // it twice cost this column enough width to wrap most rows onto a second line.
      meta: surfaceOf(event.repo),
      tone: repoTone(event),
      source: 'repo',
      href: event.url || undefined,
    });
  }

  // Collapsed BEFORE anything else looks at them (FB-178's `collapseRepeats`, reused rather than
  // written a second time). Twenty identical parkings are one fact; the count says how many.
  for (const r of collapseRepeats(input.runs)) {
    const at = iso(r.startedAt);
    if (!at) continue;
    items.push({
      at,
      text: readableSlugs(describeRun(r)),
      meta: surfaceOf(r.repo),
      tone: runTone(r),
      source: 'run',
      href: r.prUrl ?? undefined,
      repeats: r.repeats,
    });
  }

  for (const a of input.approvals) {
    for (const d of decisionsFor(a)) {
      // Undated entries are dropped rather than stamped with now. A history whose times are invented
      // is not a history — the same rule the trail follows.
      const at = iso(d.at);
      if (!at) continue;
      items.push({ at, text: d.text, meta: surfaceOf(a.repo), tone: d.tone, source: 'decision', pinned: d.pinned });
    }
  }

  items.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  if (typeof input.limit !== 'number') return { items, truncated: false };

  // Pinned entries survive the cap. Everything else takes what is left, newest first — so a forged
  // grant cannot choose a timestamp that sorts itself off the page.
  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned).slice(0, Math.max(0, input.limit - pinned.length));
  const kept = [...pinned, ...rest].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  return { items: kept, truncated: kept.length < items.length };
}

function iso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
