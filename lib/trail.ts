/**
 * The per-ticket trail (FB-125, gap G1).
 *
 * ## What this is for
 *
 * A founder asks one question about any piece of work: *what actually happened to it?* Today the
 * answer exists in four places and they can reach none of them — ActiveGraph approvals, lane run
 * reports, the repository's commits and checks, and the preview on the venture box.
 *
 * This joins them into one ordered list, so a ticket can be followed from the founder's own words to
 * something running. FB-130 renders it.
 *
 * ## The claim it has to be able to make
 *
 * *"Every hop is the same event ActiveGraph recorded: nothing shown here can disagree with what ran."*
 *
 * Which is a constraint, not a slogan. It means: no hop is invented, no link is rendered that cannot
 * be resolved, an unverified signature says so rather than passing as verified, and a source that
 * could not be read makes the trail **degraded** rather than quietly shorter. A short trail and an
 * unreadable one look identical, and one of them is a lie.
 *
 * ## Shape
 *
 * The join is pure and takes what has already been read; the loading lives in `trail-load.ts`. Same
 * seam as `groupRepoTickets` and `githubTicketFetcher` — the part with the edge cases is the part
 * that must be testable without a network.
 *
 * Mirrors `schema/Trail.schema.json`, and `lib/__tests__/trail-schema.test.ts` holds the two in
 * lock-step.
 */

import type { ActiveGraphEvent } from './activegraph';
import type { RunReport } from './runreports';

export type TrailSource = 'activegraph' | 'run' | 'repo' | 'preview';

export interface TrailLink {
  /** Absolute URL, or a studio-relative path beginning with `/`. */
  href: string;
  /** What the link says, in the founder's language — never a URL. */
  label: string;
  /** True when following it leaves the studio. The design renders these `↗`; internal ones `→`. */
  external: boolean;
}

export interface TrailHop {
  /** ISO-8601. The trail is ordered by this and nothing else. */
  at: string;
  text: string;
  source: TrailSource;
  link?: TrailLink | null;
  /**
   * Three-valued on purpose. `true`/`false` mean the signature was checked; **null** means signing
   * does not apply to this source — a commit is not signed by the approval secret and never was.
   * Collapsing null into `false` would mark every commit suspicious, which is how a warning stops
   * being read.
   */
  verified?: boolean | null;
}

export interface Trail {
  venture_id: string;
  repo: string;
  ticket_id: string;
  hops: TrailHop[];
  /** A source could not be read, so this history is incomplete and says so. */
  degraded: boolean;
}

/** What the join needs, already read. Every field may be absent; absence is a real answer. */
export interface TrailInputs {
  ventureId: string;
  repo: string;
  ticketId: string;
  /** Signed approval events for this ticket, with whether each one verified. */
  events: Array<{ event: ActiveGraphEvent; verified: boolean }>;
  /** Lane runs that touched this ticket. */
  runs: RunReport[];
  /** The pull request carrying this ticket's work, when there is one. */
  pr: {
    number: number;
    url: string;
    branch: string;
    createdAt: string;
    merged: boolean;
    commits?: { count: number; additions: number; deletions: number; diffUrl?: string | null };
    checks?: { conclusion: 'success' | 'failure' | 'pending' | 'unknown'; at?: string | null };
  } | null;
  /** The running preview on the venture box, when the deploy reported one. */
  preview: { url: string; at: string } | null;
  /** Set by the loader when any source threw. */
  degraded?: boolean;
}

/** A link, or nothing. Never a dead one — an href we cannot form is a link we do not render. */
function link(href: string | null | undefined, label: string, external: boolean): TrailLink | null {
  if (!href || !href.trim()) return null;
  // Absolute, or studio-relative. Anything else is not addressable and is dropped rather than
  // rendered as a link that goes nowhere.
  if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) return null;
  return { href, label, external };
}

/** ISO or nothing. A hop with no time cannot be placed in an ordered history, so it is not a hop. */
function at(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * The founder-facing sentence for an approval event.
 *
 * Deliberately not a status word. "approval.granted" is what the record says; "You approved it" is
 * what happened, and the trail is read by the person who did it.
 */
function approvalText(e: ActiveGraphEvent): string {
  const who = e.actor.kind === 'human' ? e.actor.id : 'your team';
  switch (e.type) {
    case 'approval.proposed':
      return 'Your team finished it and put it up for your decision';
    case 'approval.granted':
      return `Approved by ${who}`;
    case 'approval.rejected':
      return `Sent back by ${who}, with a note`;
    case 'action.executing':
      return 'Going out now';
    case 'action.executed':
      return 'Sent';
    case 'action.failed':
      return 'Failed to send, and stayed here with its reason';
    default:
      return 'Something was recorded that this studio does not recognise';
  }
}

/** What a lane run did, in the founder's language. `describeRun` is the desk's voice; this is terser. */
function runText(r: RunReport): string {
  switch (r.outcome) {
    case 'opened-pr':
      return 'Your team finished it and opened the work for your review';
    case 'blocked':
      return `Your team tried and stopped: ${r.errorDetail ?? 'it needs a person'}`;
    case 'error':
      return `Your team hit a fault: ${r.errorDetail ?? 'no reason was recorded'}`;
    case 'awaiting-approval':
      return 'Your team planned it and paused for your go';
    case 'progress':
      return 'Your team worked on it';
    case 'no-useful-work':
      return 'Your team looked at it and found nothing to do';
    default:
      return 'Your team picked it up';
  }
}

/**
 * Join what has been read into one ordered history.
 *
 * Pure. Every branch here is a case someone met: a ticket with no runs, a run with no end, an event
 * whose signature did not verify, a pull request with no commit summary yet.
 */
export function buildTrail(input: TrailInputs): Trail {
  const hops: TrailHop[] = [];

  for (const { event, verified } of input.events) {
    const when = at(event.at);
    if (!when) continue; // undateable: cannot be placed in an ordered history, so it is not a hop
    hops.push({
      at: when,
      text: approvalText(event),
      source: 'activegraph',
      // The one place the trail is allowed to be uncomfortable. An unverified event is shown, and
      // shown as unverified — dropping it would hide something that happened, and passing it off as
      // verified would be the forgery the signature exists to prevent.
      verified,
      link: null,
    });
  }

  for (const r of input.runs) {
    const when = at(r.startedAt);
    if (!when) continue;
    hops.push({
      at: when,
      text: runText(r),
      source: 'run',
      verified: null,
      link: link(r.prUrl, 'the work itself', true),
    });
  }

  if (input.pr) {
    const when = at(input.pr.createdAt);
    const c = input.pr.commits;
    if (when) {
      hops.push({
        at: when,
        text: c
          ? `${c.count} commit${c.count === 1 ? '' : 's'} on ${input.pr.branch}, +${c.additions} −${c.deletions}`
          : `Work started on ${input.pr.branch}`,
        source: 'repo',
        verified: null,
        link: link(c?.diffUrl ?? input.pr.url, 'the changes', true),
      });
    }
    const checkAt = at(input.pr.checks?.at);
    if (input.pr.checks && checkAt) {
      const conclusion = input.pr.checks.conclusion;
      hops.push({
        at: checkAt,
        // `unknown` is a settled fact — this work has no automatic checks — and is said as one. It is
        // not the same as "we could not find out", which is what `degraded` on the trail is for.
        text:
          conclusion === 'success'
            ? 'Its automatic checks passed'
            : conclusion === 'failure'
              ? 'Its automatic checks failed'
              : conclusion === 'pending'
                ? 'Its automatic checks are still running'
                : 'This work has no automatic checks',
        source: 'repo',
        verified: null,
        link: null,
      });
    }
  }

  if (input.preview) {
    const when = at(input.preview.at);
    if (when) {
      hops.push({
        at: when,
        text: 'A preview built and is running from this venture’s machine',
        source: 'preview',
        verified: null,
        link: link(input.preview.url, 'see it running', true),
      });
    }
  }

  // Oldest first, and stable: two things recorded in the same second keep the order their sources
  // were joined in rather than shuffling between renders.
  hops.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  return {
    venture_id: input.ventureId,
    repo: input.repo,
    ticket_id: input.ticketId,
    hops,
    degraded: input.degraded ?? false,
  };
}
