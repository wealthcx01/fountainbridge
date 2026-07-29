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

export type ApprovalStatus = 'proposed' | 'granted' | 'executing' | 'executed' | 'rejected';

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
  /** result/reason from execution.json when past the gate. */
  outcome: string | null;
}

/** Reads the raw JSON files of one approval; returns null for a missing file. Injectable for tests. */
export interface ApprovalSource {
  /** approval ids under `approvals/` on the ref. */
  listIds(repo: string): Promise<string[]>;
  read(repo: string, id: string, file: 'proposal' | 'grant' | 'execution'): Promise<{ json: unknown; sha: string } | null>;
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

function statusOf(grant: unknown, execution: unknown): ApprovalStatus {
  const ex = execution as { status?: string } | null;
  if (ex?.status === 'executed') return 'executed';
  if (ex?.status === 'executing') return 'executing';
  if (ex?.status === 'rejected') return 'rejected';
  if (grant) return 'granted';
  return 'proposed';
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
    if (!proposalR || !proposalR.json) continue; // an approval is defined by its proposal
    const p = proposalR.json as ApprovalProposal;
    out.push({
      id,
      kind: 'activegraph',
      ventureId: venture.id,
      repo,
      status: statusOf(grantR?.json ?? null, execR?.json ?? null),
      proposalSha: proposalR.sha || null,
      ticket: p.ticket ?? null,
      department: p.department ?? null,
      actionType: p.action_type ?? null,
      summary: p.summary ?? '(no summary)',
      checks: Array.isArray(p.checks) ? p.checks : [],
      outcome: (execR?.json as { reason?: string; result?: { note?: string } } | null)?.reason
        ?? (execR?.json as { result?: { note?: string } } | null)?.result?.note
        ?? null,
    });
  }
  // Proposed (awaiting the gate) first, then in-flight, then terminal.
  const rank: Record<ApprovalStatus, number> = { proposed: 0, granted: 1, executing: 2, executed: 3, rejected: 4 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));
}
