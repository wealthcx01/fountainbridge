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
import { verifyGrant, describeProvenance, type GrantProvenance, type VerifiedGrant } from './provenance';

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
  // --- FB-051 (narrowed): what the studio can PROVE about the grant ------------------------------
  /** `attested` when the HMAC verifies; `unattested` when a grant exists but does not. */
  grantProvenance: GrantProvenance;
  /** The approver — ONLY when the attestation verifies. An unverified name is noise. */
  grantedBy: string | null;
  grantedAt: string | null;
  /** The founder-facing provenance line, or null when nothing has been granted yet. */
  provenanceNote: string | null;
}

/** Reads the raw JSON files of one approval; returns null for a missing file. Injectable for tests. */
export interface ApprovalSource {
  /** approval ids under `approvals/` on the ref. */
  listIds(repo: string): Promise<string[]>;
  read(repo: string, id: string, file: 'proposal' | 'grant' | 'execution'): Promise<{ json: unknown; sha: string } | null>;
  // NOTE: the append-only event files under `approvals/<id>/events/` are deliberately NOT read
  // here. They are an annotation stream a lane can write to, so they can prove nothing — and
  // reading them cost one directory listing plus one request PER EVENT, per approval, per render.
  // The attestation is the anchor; see lib/provenance.ts.
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
  };
}

/**
 * The approval's state, from the records the executor acts on.
 *
 * Two rules the file-presence version got wrong: an execution that FAILED read as `granted` (there
 * was no `failed` case, so an errored send showed the founder as approved and fine); and any grant
 * file at all read as `granted`, including one no human issued. An unattested grant now stays
 * `proposed` — the executor will refuse it, and the card says why.
 */
function statusOf(grant: VerifiedGrant, execution: unknown): ApprovalStatus {
  const ex = execution as { status?: string } | null;
  if (ex?.status === 'executed') return 'executed';
  if (ex?.status === 'executing') return 'executing';
  if (ex?.status === 'rejected') return 'rejected';
  if (ex?.status === 'failed') return 'failed';
  return grant.provenance === 'attested' ? 'granted' : 'proposed';
}

/** Build the approval list for one venture from a source. */
export async function loadApprovals(
  venture: VentureSummary,
  source: ApprovalSource,
  repo = venture.repos[0],
  /** The studio's signing secret. Absent ⇒ nothing can be verified, and every grant says so. */
  secret: string | undefined = process.env.FOUNDRY_APPROVAL_SECRET,
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
    if (!proposalR || !proposalR.json) continue; // an approval is defined by its proposal
    const p = proposalR.json as ApprovalProposal;
    // The ONE thing the studio can prove. Everything else on this card is a report.
    const grant = verifyGrant(id, proposalR.sha || null, grantR?.json as never, secret);

    out.push({
      id,
      kind: 'activegraph',
      ventureId: venture.id,
      repo,
      // Status comes from the records the EXECUTOR acts on, so the studio and the executor cannot
      // disagree about what happened. A grant that does not verify is not shown as granted.
      status: statusOf(grant, execR?.json ?? null),
      proposalSha: proposalR.sha || null,
      // Every founder-visible field is read from the sha-pinned proposal — the artefact the
      // attestation covers and the executor performs. The previous design rendered the summary from
      // a lane-written event while the attestation pinned the proposal, so the founder could approve
      // one document and the executor send another.
      ticket: p.ticket ?? null,
      department: p.department ?? null,
      actionType: p.action_type ?? null,
      summary: p.summary ?? '(no summary)',
      checks: Array.isArray(p.checks) ? p.checks : [],
      grantProvenance: grant.provenance,
      grantedBy: grant.approver,
      grantedAt: grant.grantedAt,
      provenanceNote: describeProvenance(grant),
      outcome: (execR?.json as { reason?: string } | null)?.reason
        ?? (execR?.json as { result?: { note?: string } } | null)?.result?.note
        ?? null,
    });
  }
  // Proposed (awaiting the gate) first, then in-flight, then terminal.
  const rank: Record<ApprovalStatus, number> = { proposed: 0, granted: 1, executing: 2, failed: 3, executed: 4, rejected: 5 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
}
