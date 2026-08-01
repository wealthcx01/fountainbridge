/**
 * The ActiveGraph record: what happened, in order, attributed (FB-071).
 *
 * ## Why this exists, and why the first attempt was withdrawn
 *
 * FB-051 set out to build this and pulled it back mid-ticket. Not because it was hard — because it
 * could not be true. The event log lived on the `foundry-approvals` ref in the **venture's own
 * repository**, a ref the proposing lane holds a write token for. So a lane could write
 * `approval.granted` with `actor.kind: 'human'` and the projection would report a grant, by a named
 * person, with no fault raised. An audit trail the audited party can write is worse than no audit
 * trail, because it manufactures confidence instead of merely lacking it.
 *
 * ## What makes this one true
 *
 * Two layers, and the ticket's own test for each is one question: *can a lane do this?*
 *
 * 1. **Every event is signed** with `FOUNDRY_APPROVAL_SECRET` — held by the studio and the executor,
 *    never on a lane box (verified on the ARCA box: the secret appears nowhere under /opt or /etc).
 *    An unsigned or wrongly-signed event is not a suspicious event; it is *not an event*, and the
 *    projection never sees it.
 * 2. **The projection refuses a grant that no human issued**, independently of the signature. If the
 *    signing secret ever leaked, forging a grant would still require forging a human actor past a
 *    rule that exists in a second place.
 *
 * The third layer — the log living somewhere the lane holds no credential for at all — is **not yet
 * true, and this file will not pretend otherwise.** The lane's own GitHub token is currently scoped
 * to the whole `wealthcx01` org with admin, so it can write to the studio's repository as easily as
 * its own. See `docs/tickets/FB-072`. Until that is fixed, layer 1 is what makes the record sound,
 * and it is genuinely sound: a lane can append bytes, but it cannot make them count.
 *
 * ## What this record still cannot prove
 *
 * The execution outcome is written by the executor. If the executor is ever compromised, the record
 * follows it. That is a much smaller surface than before — one component we build and deploy, rather
 * than every lane on every venture box — but it is not zero, and pretending otherwise would be the
 * same failure this ticket exists to correct.
 */

/** Everything that can happen to an external action, from asking to done. */
export type EventType =
  | 'approval.proposed'
  | 'approval.granted'
  | 'approval.rejected'
  | 'action.executing'
  | 'action.executed'
  | 'action.failed';

/**
 * Who did it.
 *
 * `human` is the only kind that may grant. An agent proposes; the executor executes; a human is the
 * only thing in this system that can agree to something going out (CLAUDE.md #4).
 */
export type ActorKind = 'human' | 'agent' | 'executor';

export interface ActiveGraphEvent {
  /** Format version, so an old event stays readable when the shape moves. */
  v: 1;
  /** Position in this approval's own sequence, from 1. Ordering never depends on a clock. */
  seq: number;
  venture: string;
  /** The venture repo the approval lives in — the same value the grant attestation covers. */
  repo: string;
  /** The approval id, as it appears under `approvals/<id>/` on the venture ref. */
  id: string;
  type: EventType;
  /** ISO time, for display only. Two writers' clocks are not a source of order. */
  at: string;
  actor: { kind: ActorKind; id: string };
  /** Type-specific detail: the reason for a failure, the action being taken, the proposal sha. */
  data?: Record<string, string>;
  /** HMAC over everything above. Written by the signer; never trusted from the file. */
  attestation?: string;
}

/** The fields that get signed, in a fixed order — the signature must not depend on key order. */
export function canonicalEvent(e: ActiveGraphEvent): string {
  const data = e.data ?? {};
  const orderedData = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  return [e.v, e.seq, e.venture, e.repo, e.id, e.type, e.at, e.actor.kind, e.actor.id, orderedData].join('|');
}

/** The state an approval is in, reconstructed from its events. */
export type ProjectedStatus =
  | 'proposed'
  | 'granted'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'unknown';

/** Which events may follow which. Anything else is a fault, never a silent overwrite. */
const ALLOWED: Record<ProjectedStatus, EventType[]> = {
  unknown: ['approval.proposed'],
  proposed: ['approval.granted', 'approval.rejected'],
  granted: ['action.executing', 'action.executed', 'action.failed'],
  executing: ['action.executed', 'action.failed'],
  executed: [],
  failed: [],
  rejected: [],
};

const RESULT: Record<EventType, ProjectedStatus> = {
  'approval.proposed': 'proposed',
  'approval.granted': 'granted',
  'approval.rejected': 'rejected',
  'action.executing': 'executing',
  'action.executed': 'executed',
  'action.failed': 'failed',
};

export interface Projection {
  status: ProjectedStatus;
  /** The human who agreed, when one did. */
  approver: string | null;
  /** Every event that counted, in the order it counted. */
  applied: ActiveGraphEvent[];
  /**
   * Events that were rejected, and why. Surfaced rather than dropped: a log that quietly discards
   * what it does not like cannot be audited either (CLAUDE.md #10).
   */
  faults: Array<{ event: ActiveGraphEvent; reason: string }>;
}

/**
 * Replay an approval's events into its state.
 *
 * Deterministic by construction: it sorts by `seq`, never by time, so two writers with disagreeing
 * clocks replay identically. Same events in, same projection out, every time.
 *
 * The caller passes only events whose signature verified. This function then applies the rule that
 * has to hold even if the signature check were somehow passed: **only a human can grant.**
 */
export function project(events: ActiveGraphEvent[]): Projection {
  const faults: Projection['faults'] = [];
  const applied: ActiveGraphEvent[] = [];
  let status: ProjectedStatus = 'unknown';
  let approver: string | null = null;

  const ordered = [...events].sort((a, b) => a.seq - b.seq || a.type.localeCompare(b.type));
  const seen = new Set<number>();

  for (const e of ordered) {
    if (seen.has(e.seq)) {
      // A repeated position means someone wrote over history rather than appending to it.
      faults.push({ event: e, reason: `two events claim position ${e.seq}` });
      continue;
    }
    if (e.type === 'approval.granted' && e.actor.kind !== 'human') {
      // The rule the whole ticket exists for, stated where a signature cannot reach it.
      // "an executor", "an agent" — the article has to follow the word, or the one sentence a
      // founder reads when something does not add up reads as broken English.
      const article = /^[aeiou]/i.test(e.actor.kind) ? 'an' : 'a';
      faults.push({ event: e, reason: `${article} ${e.actor.kind} cannot grant — only a person can agree to this` });
      continue;
    }
    if (!ALLOWED[status].includes(e.type)) {
      faults.push({ event: e, reason: `${e.type} cannot follow ${status}` });
      continue;
    }
    seen.add(e.seq);
    status = RESULT[e.type];
    if (e.type === 'approval.granted') approver = e.actor.id;
    applied.push(e);
  }

  return { status, approver, applied, faults };
}

/**
 * One line of the story, in the founder's language.
 *
 * The ticket asks for a readable history, not an event dump. A founder reading this should be able
 * to answer "who agreed to this and what happened next" without knowing the word "projection".
 */
export function narrate(e: ActiveGraphEvent): string {
  const who = e.actor.kind === 'human' ? e.actor.id : e.actor.kind === 'executor' ? 'The studio' : 'Your team';
  switch (e.type) {
    case 'approval.proposed':
      return `${who} asked for your OK${e.data?.summary ? `: ${e.data.summary}` : ''}.`;
    case 'approval.granted':
      return `${who} approved it.`;
    case 'approval.rejected':
      return `${who} turned it down${e.data?.reason ? `: ${e.data.reason}` : ''}.`;
    case 'action.executing':
      return 'The studio started doing it.';
    case 'action.executed':
      return 'It was done.';
    case 'action.failed':
      return `It failed${e.data?.reason ? `: ${e.data.reason}` : ''}, so nothing went out.`;
    default: {
      const _exhaustive: never = e.type;
      return _exhaustive;
    }
  }
}

/** What a fault means to a founder — the studio saying plainly that something does not add up. */
export function narrateFault(fault: { event: ActiveGraphEvent; reason: string }): string {
  return `Something was recorded here that the studio would not accept (${fault.reason}). ` +
    'It has been ignored, and it did not change anything.';
}

/** Where an approval's events live. One file per event, so appending never rewrites an earlier one. */
export const ACTIVEGRAPH_REF = 'foundry-activegraph';

export function eventPath(venture: string, repo: string, id: string, seq: number, type: EventType): string {
  // The repo is part of the path, not just the event: two ventures can use the same approval id, and
  // a path collision would let one venture's history overwrite another's.
  const shortRepo = repo.includes('/') ? repo.split('/')[1] : repo;
  return `activegraph/${venture}/${shortRepo}/${id}/${String(seq).padStart(4, '0')}-${type}.json`;
}

/** Read a seq back out of a path, so a directory listing can be ordered without opening every file. */
export function seqFromPath(path: string): number | null {
  const m = path.match(/\/(\d{4})-[a-z.]+\.json$/);
  return m ? Number(m[1]) : null;
}
