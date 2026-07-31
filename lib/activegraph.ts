/**
 * The ActiveGraph runtime for external actions (FB-051).
 *
 * FB-044 shipped the right *shape* — proposed / granted / executed as git files, with an HMAC
 * attestation — but the state was inferred from which files happened to exist. That is a log you can
 * read, not a record you can prove. "The grant file is present" cannot answer *who* granted it, *when*,
 * *on what basis*, or *what the machine had already done before a human ever saw it*.
 *
 * This makes the append-only event log the source of truth and the approval's status a deterministic
 * projection of it — the model of Yohei Nakajima's ActiveGraph (github.com/yoheinakajima/activegraph),
 * applied to our substrate rather than adopting its Python runtime: events are immutable files on the
 * venture's `foundry-approvals` ref, so git stays the store (D2) and nothing new has to be provisioned
 * per venture. What we take from it is the part that matters here — append-only log as truth, state as
 * projection, actor attribution, causal lineage, deterministic replay.
 *
 * The property this exists to give a founder (and a regulator, and a bank's diligence team): every
 * outside action is a permanent record of who proposed it, what it was, who approved it, when, and on
 * what lawful basis — and you can replay the log to any point and see exactly what was true then.
 *
 * Faults are REPORTED, never thrown and never silently corrected (non-negotiable 10). A log that
 * cannot be trusted must say so loudly; quietly "fixing" it in the projection would destroy the one
 * property the log exists to provide.
 */

/** Who caused an event. `founder`/`bruntsfield` are humans; everything else is a machine. */
export type ActorKind = 'founder' | 'bruntsfield' | 'lane' | 'executor' | 'system';

export interface Actor {
  kind: ActorKind;
  /** A stable identity — an email for a human, a component name for a machine. */
  id: string;
}

/** Only a human can grant. This is non-negotiable 4, expressed as data. */
export const HUMAN_ACTORS: readonly ActorKind[] = ['founder', 'bruntsfield'];

export function isHuman(actor: Actor | undefined): boolean {
  return Boolean(actor && HUMAN_ACTORS.includes(actor.kind));
}

export type ApprovalEventType =
  | 'approval.proposed'
  | 'approval.granted'
  | 'approval.rejected'
  | 'approval.executing'
  | 'approval.executed'
  | 'approval.failed';

/**
 * The §5 compliance record (docs/research-gtm.md), carried on the `approval.proposed` event and
 * frozen there. It is what makes a send defensible: the classification that decides which rules
 * apply, the basis relied on, the suppression check, and the exact draft that was approved.
 */
export interface ComplianceRecord {
  recipient: string;
  /** PECR subscriber classification. A sole trader counts as an individual — the trap in §3. */
  pecrClass: 'corporate' | 'individual' | 'sole-trader';
  lawfulBasis: {
    kind: 'consent' | 'soft-opt-in' | 'legitimate-interests';
    /** Consent record id, or the venture's LIA reference. One LIA per venture, referenced per send. */
    ref: string;
  };
  suppressionCheck: { checked: boolean; suppressed: boolean; listRef?: string };
  /** Hash of the draft as approved — the frozen draft. Changing the copy invalidates the grant. */
  draftSha: string;
  channel: string;
  sendingIdentity: { address: string; scope: string };
}

export interface ApprovalEvent {
  /** Monotonic within one approval. The file name carries it, so ordering survives a clone. */
  seq: number;
  type: ApprovalEventType;
  /** ISO-8601 UTC. */
  at: string;
  actor: Actor;
  /** The `seq` this event descends from — the causal lineage. Null only for the first event. */
  causedBy: number | null;
  summary?: string;
  department?: string;
  ticket?: string;
  amountMinor?: number;
  currency?: string;
  compliance?: ComplianceRecord;
  /** Free-form per-type payload (execution result, rejection reason, …). */
  data?: Record<string, unknown>;
}

export type ProjectedStatus = 'proposed' | 'granted' | 'executing' | 'executed' | 'rejected' | 'failed';

export type FaultCode =
  | 'no-proposal'
  | 'out-of-order'
  | 'duplicate-seq'
  | 'broken-lineage'
  | 'non-human-grant'
  | 'illegal-transition'
  | 'post-terminal';

export interface Fault {
  seq: number | null;
  code: FaultCode;
  message: string;
}

/**
 * Faults that say something about STORAGE, not about whether the record is true.
 *
 * `out-of-order` is derived from the order the events arrived in — a directory listing — not from
 * anything in the events themselves. Every one of them can still be perfectly valid. Because an
 * unverifiable record withholds the Approve button, treating this as damning would let a listing
 * quirk BLOCK a founder from approving a sound record: a false accusation with a real cost.
 *
 * It is still reported (it means something wrote history rather than appending to it, which is worth
 * knowing) — it just does not make the record indefensible on its own.
 */
export const ADVISORY_FAULTS: readonly FaultCode[] = ['out-of-order'];

export function isAdvisory(fault: Fault): boolean {
  return ADVISORY_FAULTS.includes(fault.code);
}

/** The faults that mean the record itself cannot be trusted. */
export function blockingFaults(faults: Fault[]): Fault[] {
  return faults.filter((f) => !isAdvisory(f));
}

export interface ProjectedApproval {
  status: ProjectedStatus;
  /** Every actor that touched this approval, in order — the lineage a regulator asks for. */
  lineage: { seq: number; type: ApprovalEventType; at: string; actor: Actor }[];
  proposedBy: Actor | null;
  /** Who granted, and when. Null unless a human actually granted it. */
  grantedBy: Actor | null;
  grantedAt: string | null;
  compliance: ComplianceRecord | null;
  summary: string;
  department: string | null;
  ticket: string | null;
  amountMinor: number;
  currency: string | null;
  outcome: string | null;
  /**
   * Anything about this log that cannot be trusted. Non-empty means the record is NOT defensible —
   * the studio must show it rather than render a confident status over a broken chain.
   */
  faults: Fault[];
}

/** Which statuses may follow which. Absent ⇒ terminal. */
const ALLOWED_NEXT: Partial<Record<ProjectedStatus, ApprovalEventType[]>> = {
  proposed: ['approval.granted', 'approval.rejected'],
  granted: ['approval.executing', 'approval.executed', 'approval.failed', 'approval.rejected'],
  executing: ['approval.executed', 'approval.failed'],
};

const STATUS_OF: Record<ApprovalEventType, ProjectedStatus> = {
  'approval.proposed': 'proposed',
  'approval.granted': 'granted',
  'approval.rejected': 'rejected',
  'approval.executing': 'executing',
  'approval.executed': 'executed',
  'approval.failed': 'failed',
};

/** Sort a log into causal order without mutating the caller's array. */
export function ordered(events: ApprovalEvent[]): ApprovalEvent[] {
  return [...events].sort((a, b) => a.seq - b.seq);
}

/**
 * Fold an event log into the current state of one approval.
 *
 * Deterministic and side-effect free: the same log always projects to the same result, which is what
 * makes replay meaningful. Never throws — a malformed log yields a projection carrying `faults`.
 */
export function project(events: ApprovalEvent[]): ProjectedApproval {
  const log = ordered(events);
  const out: ProjectedApproval = {
    status: 'proposed',
    lineage: [],
    proposedBy: null,
    grantedBy: null,
    grantedAt: null,
    compliance: null,
    summary: '(no summary)',
    department: null,
    ticket: null,
    amountMinor: 0,
    currency: null,
    outcome: null,
    faults: [],
  };

  if (!log.length) {
    out.faults.push({ seq: null, code: 'no-proposal', message: 'the approval has no events at all' });
    return out;
  }
  if (log[0].type !== 'approval.proposed') {
    out.faults.push({
      seq: log[0].seq,
      code: 'no-proposal',
      message: `the log opens with ${log[0].type}; an approval must begin with approval.proposed`,
    });
  }

  const seen = new Set<number>();
  let started = false;

  for (const event of log) {
    if (seen.has(event.seq)) {
      out.faults.push({
        seq: event.seq,
        code: 'duplicate-seq',
        message: `two events share seq ${event.seq} — the order they happened in is unrecoverable`,
      });
      continue;
    }
    seen.add(event.seq);

    // Lineage: every event but the first must point at an event that already happened.
    if (event.causedBy === null) {
      if (started) {
        out.faults.push({
          seq: event.seq,
          code: 'broken-lineage',
          message: `${event.type} claims no cause, but it is not the first event`,
        });
      }
    } else if (!seen.has(event.causedBy) || event.causedBy >= event.seq) {
      out.faults.push({
        seq: event.seq,
        code: 'broken-lineage',
        message: `${event.type} claims to be caused by seq ${event.causedBy}, which does not precede it`,
      });
    }

    if (event.type === 'approval.proposed') {
      if (started) {
        out.faults.push({
          seq: event.seq,
          code: 'illegal-transition',
          message: 'a second approval.proposed — an approval is proposed exactly once',
        });
        continue;
      }
      started = true;
      out.proposedBy = event.actor;
      out.compliance = event.compliance ?? null;
      out.summary = event.summary ?? out.summary;
      out.department = event.department ?? null;
      out.ticket = event.ticket ?? null;
      out.amountMinor =
        typeof event.amountMinor === 'number' && Number.isInteger(event.amountMinor) && event.amountMinor >= 0
          ? event.amountMinor
          : 0;
      out.currency = event.currency ?? null;
      out.status = 'proposed';
      out.lineage.push({ seq: event.seq, type: event.type, at: event.at, actor: event.actor });
      continue;
    }

    const allowed = ALLOWED_NEXT[out.status];
    if (!allowed) {
      out.faults.push({
        seq: event.seq,
        code: 'post-terminal',
        message: `${event.type} arrived after the approval was already ${out.status}`,
      });
      continue;
    }
    if (!allowed.includes(event.type)) {
      out.faults.push({
        seq: event.seq,
        code: 'illegal-transition',
        message: `${event.type} cannot follow ${out.status}`,
      });
      continue;
    }

    // THE gate. A machine-granted approval is not a grant — it is the thing the whole architecture
    // exists to make impossible, and the log is where it becomes visible. The transition is refused,
    // so a forged grant cannot even project to `granted`.
    if (event.type === 'approval.granted' && !isHuman(event.actor)) {
      out.faults.push({
        seq: event.seq,
        code: 'non-human-grant',
        message: `approval.granted by ${event.actor.kind} "${event.actor.id}" — only a human can grant an external action`,
      });
      continue;
    }

    out.status = STATUS_OF[event.type];
    out.lineage.push({ seq: event.seq, type: event.type, at: event.at, actor: event.actor });

    if (event.type === 'approval.granted') {
      out.grantedBy = event.actor;
      out.grantedAt = event.at;
    }
    if (event.type === 'approval.executed' || event.type === 'approval.failed' || event.type === 'approval.rejected') {
      const data = event.data ?? {};
      out.outcome =
        (typeof data.reason === 'string' && data.reason) ||
        (typeof data.note === 'string' && data.note) ||
        null;
    }
  }

  // A log whose seqs arrive out of order is still projectable (we sort), but it is worth saying: it
  // means something wrote history rather than appending to it.
  const raw = events.map((e) => e.seq);
  if (raw.some((s, i) => i > 0 && s < raw[i - 1])) {
    out.faults.push({ seq: null, code: 'out-of-order', message: 'events were stored out of sequence order' });
  }

  return out;
}

/**
 * The state as it stood immediately after `seq` — the ticket's "replays with correct actor lineage".
 * Because `project` is a pure fold, replaying a prefix IS the historical state, with no separate
 * snapshot to drift from the log.
 */
export function replayTo(events: ApprovalEvent[], seq: number): ProjectedApproval {
  return project(ordered(events).filter((e) => e.seq <= seq));
}

/**
 * Is this approval's record defensible — a clean chain, granted by a human?
 *
 * Advisory faults (storage-order noise) do not make a record indefensible; only faults that impugn
 * what the log SAYS do. See ADVISORY_FAULTS.
 */
export function isDefensible(projected: ProjectedApproval): boolean {
  return (
    blockingFaults(projected.faults).length === 0 &&
    (projected.status !== 'granted' || projected.grantedBy !== null)
  );
}

/**
 * Build the next event in a chain: correct `seq`, and `causedBy` pointing at the current head. Using
 * this rather than hand-rolling an event is what keeps lineage intact at every write site.
 */
export function nextEvent(
  events: ApprovalEvent[],
  event: Omit<ApprovalEvent, 'seq' | 'causedBy'>,
): ApprovalEvent {
  const log = ordered(events);
  const head = log[log.length - 1];
  return { ...event, seq: head ? head.seq + 1 : 1, causedBy: head ? head.seq : null };
}

// --- suppression -------------------------------------------------------------------------------

export type SuppressionEventType = 'suppression.added' | 'suppression.removed';

export interface SuppressionEvent {
  seq: number;
  type: SuppressionEventType;
  at: string;
  actor: Actor;
  /** Lower-cased address. The right to object is absolute (§3), so this list is checked before every send. */
  address: string;
  reason?: string;
}

/**
 * The current suppression list, projected from its own append-only log.
 *
 * Removal exists because a person who re-consents must be able to hear from the venture again — but
 * the *record* of their objection is never deleted, only superseded. That is the difference between
 * an audit log and a mutable list.
 */
export function suppressionList(events: SuppressionEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    const address = String(e.address ?? '').trim().toLowerCase();
    if (!address) continue;
    if (e.type === 'suppression.added') out.add(address);
    else out.delete(address);
  }
  return out;
}

export function isSuppressed(list: Set<string>, address: string): boolean {
  return list.has(String(address ?? '').trim().toLowerCase());
}
