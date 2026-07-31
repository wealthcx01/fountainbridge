/**
 * ActiveGraph approval read model (FB-046) — the studio side of the FB-044 gate.
 *
 * Reads the venture repo's `foundry-approvals` ref (written by lanes proposing external actions and by
 * the executor recording outcomes) and surfaces the ones NEEDING A HUMAN — status `proposed`, not yet
 * granted or executed — as founder-grade cards in the attention queue. This is the E1 par-plus surface:
 * a plain-language card with the policy `checks[]` and an Approve action, so a founder never reviews on
 * github.com. Git stays the store (D2); this is a read + write-path onto it.
 *
 * The fetch source is injectable so mapping is unit-tested offline (APPROVALS_FIXTURE_DIR / a stub).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GitHubClient } from './github';
import type { VentureSummary } from './ventures';
import { ordered, project, type ApprovalEvent, type Actor, type ComplianceRecord, type Fault, type ProjectedApproval } from './activegraph';
import { eventsFromLegacy, isBridged, type LegacyFiles } from './activegraph-bridge';

export const APPROVALS_REF = 'foundry-approvals';

export interface PolicyCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface ApprovalProposal {
  id: string;
  ticket?: string;
  department?: string;
  action_type?: string;
  summary?: string;
  compliance?: Record<string, unknown>;
  checks?: PolicyCheck[];
}

/**
 * `failed` was missing before FB-051, and its absence was a misrepresentation: v0 inferred status
 * from file presence, so an execution that FAILED fell through to "granted" — the founder saw a
 * send as approved-and-fine when it had actually errored. The projection has a real failed state.
 */
export type ApprovalStatus = 'proposed' | 'granted' | 'executing' | 'executed' | 'rejected' | 'failed';

/** An Approval(kind='activegraph') — an external action awaiting (or past) the human gate. */
export interface ActiveGraphApproval {
  id: string;
  kind: 'activegraph';
  ventureId: string;
  repo: string;
  status: ApprovalStatus;
  proposalSha: string | null;
  ticket: string | null;
  department: string | null;
  actionType: string | null;
  summary: string;
  checks: PolicyCheck[];
  /** result/reason once past the gate. */
  outcome: string | null;
  // --- FB-051: what the event log proves, rather than what a file's presence implies -------------
  /** The human who granted it. Null unless a human actually did — a machine grant never projects. */
  grantedBy: Actor | null;
  grantedAt: string | null;
  /** The §5 compliance record, frozen on the proposal. */
  compliance: ComplianceRecord | null;
  /** Every actor that touched this approval, in causal order. */
  lineage: ProjectedApproval['lineage'];
  /** Non-empty ⇒ this record is NOT defensible and the studio must say so. */
  faults: Fault[];
  /** True when the log was derived from FB-044's files rather than natively appended. */
  bridged: boolean;
}

/** Reads the raw JSON files of one approval; returns null for a missing file. Injectable for tests. */
export interface ApprovalSource {
  /** approval ids under `approvals/` on the ref. */
  listIds(repo: string): Promise<string[]>;
  read(repo: string, id: string, file: 'proposal' | 'grant' | 'execution'): Promise<{ json: unknown; sha: string } | null>;
  /**
   * The append-only event log for one approval (FB-051), newest-agnostic — ordering comes from each
   * event's `seq`, not from the listing. Optional: a source without it (or an approval with no
   * events yet) falls back to bridging FB-044's files.
   */
  readEvents?(repo: string, id: string): Promise<ApprovalEvent[]>;
}

/** A GitHub-backed source over the `foundry-approvals` ref. */
export function githubApprovalSource(client: GitHubClient): ApprovalSource {
  return {
    async listIds(repo) {
      const entries = await client.listDir(repo, 'approvals', APPROVALS_REF);
      return entries.filter((e) => e.type === 'dir').map((e) => e.name);
    },
    async read(repo, id, file) {
      const r = await client.getFileWithSha(repo, `approvals/${id}/${file}.json`, APPROVALS_REF);
      if (r == null) return null;
      let json: unknown = null;
      try { json = JSON.parse(r.text); } catch { json = null; }
      return { json, sha: r.sha };
    },
    async readEvents(repo, id) {
      // Events are immutable files under `approvals/<id>/events/`, one per event, named by seq. A
      // missing directory is the normal case for an approval written before FB-051.
      let entries: { name: string; type: string }[] = [];
      try {
        entries = await client.listDir(repo, `approvals/${id}/events`, APPROVALS_REF);
      } catch {
        return [];
      }
      const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.json'));
      const read = await Promise.all(
        files.map(async (f) => {
          const r = await client.getFileWithSha(repo, `approvals/${id}/events/${f.name}`, APPROVALS_REF);
          if (!r) return null;
          try { return JSON.parse(r.text) as ApprovalEvent; } catch { return null; }
        }),
      );
      // One unparseable event file must not discard the rest of the log — the remaining events still
      // project, and `project()` reports the resulting gap as a lineage fault rather than letting a
      // single bad file silently erase an approval's history.
      return read.filter((e): e is ApprovalEvent => Boolean(e && typeof e.seq === 'number'));
    },
  };
}

/** A fixture source: <dir>/<repo-with-slashes-as-__>/<id>/<file>.json. Used by tests + offline dev. */
export function fixtureApprovalSource(dir: string): ApprovalSource {
  const key = (repo: string) => repo.replace(/\//g, '__');
  return {
    async listIds(repo) {
      try {
        const idsRaw = readFileSync(join(dir, key(repo), '_ids.json'), 'utf8');
        return JSON.parse(idsRaw) as string[];
      } catch { return []; }
    },
    async read(repo, id, file) {
      try {
        const text = readFileSync(join(dir, key(repo), id, `${file}.json`), 'utf8');
        return { json: JSON.parse(text), sha: `sha-${id}-${file}` };
      } catch { return null; }
    },
    async readEvents(repo, id) {
      try {
        const text = readFileSync(join(dir, key(repo), id, 'events.json'), 'utf8');
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? (parsed as ApprovalEvent[]) : [];
      } catch { return []; }
    },
  };
}

/**
 * FB-051: an approval's log, from events where they exist and bridged from FB-044's files where they
 * do not. Every approval therefore reaches the projection as an event chain, so the studio has one
 * model rather than two code paths that can disagree.
 */
async function logFor(source: ApprovalSource, repo: string, id: string, files: LegacyFiles): Promise<ApprovalEvent[]> {
  const events = source.readEvents ? await source.readEvents(repo, id) : [];
  const bridged = eventsFromLegacy(files);

  // No native log at all: the v0 files are the whole record.
  if (!events.length) return bridged;
  // A native log that opens mid-story is a partial migration — the files are the fuller record.
  if (ordered(events)[0]?.type !== 'approval.proposed') return bridged.length ? bridged : events;

  // Both exist. RECONCILE rather than prefer, because appending an event and writing the v0 file are
  // two separate writes and either can fail alone.
  //
  // The dangerous direction is a grant.json that landed while its `approval.granted` event did not:
  // the native log would project to `proposed`, the studio would offer Approve on an action that is
  // ALREADY granted, and the executor — which reads grant.json — would run it. The founder would be
  // told an approved action still needs approving, and could grant it twice. Taking whichever record
  // is further along closes that, in both directions.
  return reconcile(events, bridged);
}

/** Rank of the furthest state a log reaches, for comparing two records of the same approval. */
const REACHED: Record<string, number> = {
  'approval.proposed': 0,
  'approval.granted': 1,
  'approval.executing': 2,
  'approval.rejected': 3,
  'approval.failed': 3,
  'approval.executed': 3,
};

function furthest(events: ApprovalEvent[]): number {
  return events.reduce((max, e) => Math.max(max, REACHED[e.type] ?? 0), 0);
}

/**
 * Fold whatever the v0 files know that the native log does not onto the end of the native log.
 *
 * The appended events are marked `bridged` (they came from a file, not from a real append), so the
 * studio can still tell a fully-native record from a repaired one.
 */
function reconcile(events: ApprovalEvent[], bridged: ApprovalEvent[]): ApprovalEvent[] {
  if (!bridged.length || furthest(bridged) <= furthest(events)) return events;

  const have = new Set(events.map((e) => e.type));
  const missing = bridged.filter((e) => !have.has(e.type) && e.type !== 'approval.proposed');
  if (!missing.length) return events;

  const log = ordered(events);
  let seq = log[log.length - 1].seq;
  return [
    ...log,
    ...missing.map((e) => {
      const causedBy = seq;
      seq += 1;
      return { ...e, seq, causedBy, data: { ...(e.data ?? {}), bridged: true, repaired: true } };
    }),
  ];
}

/** Build the approval list for one venture from a source. */
export async function loadApprovals(
  venture: VentureSummary,
  source: ApprovalSource,
  repo = venture.repos[0],
): Promise<ActiveGraphApproval[]> {
  if (!repo) return [];
  const ids = await source.listIds(repo);
  const out: ActiveGraphApproval[] = [];
  for (const id of ids) {
    const [proposalR, grantR, execR] = await Promise.all([
      source.read(repo, id, 'proposal'),
      source.read(repo, id, 'grant'),
      source.read(repo, id, 'execution'),
    ]);
    const events = await logFor(source, repo, id, {
      proposal: proposalR?.json ?? null,
      grant: grantR?.json ?? null,
      execution: execR?.json ?? null,
    });
    if (!events.length) continue; // an approval is defined by having been proposed
    const projected = project(events);
    const p = (proposalR?.json ?? {}) as ApprovalProposal;

    out.push({
      id,
      kind: 'activegraph',
      ventureId: venture.id,
      repo,
      // The status is now PROJECTED from the log, not inferred from which files exist. A forged
      // grant does not reach `granted` — project() refuses the transition (FB-051).
      status: projected.status,
      proposalSha: proposalR?.sha || null,
      ticket: projected.ticket ?? p.ticket ?? null,
      department: projected.department ?? p.department ?? null,
      actionType: p.action_type ?? null,
      summary: projected.summary !== '(no summary)' ? projected.summary : p.summary ?? '(no summary)',
      checks: Array.isArray(p.checks) ? p.checks : [],
      outcome: projected.outcome,
      grantedBy: projected.grantedBy,
      grantedAt: projected.grantedAt,
      compliance: projected.compliance,
      lineage: projected.lineage,
      faults: projected.faults,
      bridged: isBridged(events),
    });
  }
  // Proposed (awaiting the gate) first, then in-flight, then terminal.
  const rank: Record<ApprovalStatus, number> = { proposed: 0, granted: 1, executing: 2, failed: 3, executed: 4, rejected: 5 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
}
