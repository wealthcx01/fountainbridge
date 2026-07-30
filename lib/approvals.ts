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
import { envelopeCheck, parseEnvelopes, type Envelope } from './budgets';

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
  /**
   * What this action costs, in integer MINOR units (pence), and its currency (FB-054). Absent or
   * malformed means "costs nothing" — an action with no stated price must not silently consume a
   * department's envelope, and a float here would be pounds written where pence were expected.
   */
  amount_minor?: number;
  currency?: string;
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
  /** Cost in integer minor units; 0 when the action states no price (FB-054). */
  amountMinor: number;
  currency: string | null;
  /** result/reason from execution.json when past the gate. */
  outcome: string | null;
}

/** Reads the raw JSON files of one approval; returns null for a missing file. Injectable for tests. */
export interface ApprovalSource {
  /** approval ids under `approvals/` on the ref. */
  listIds(repo: string): Promise<string[]>;
  read(repo: string, id: string, file: 'proposal' | 'grant' | 'execution'): Promise<{ json: unknown; sha: string } | null>;
  /**
   * The department budget envelopes state file, `budgets.json` on the ref (FB-054). Optional: a
   * source that cannot supply it (an older stub, a fixture without one) means "no envelopes
   * configured", which is the normal case for a venture that has not set any.
   */
  readBudgets?(repo: string): Promise<unknown>;
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
    async readBudgets(repo) {
      const r = await client.getFileWithSha(repo, 'budgets.json', APPROVALS_REF);
      if (r == null) return null;
      try { return JSON.parse(r.text); } catch { return null; }
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
    async readBudgets(repo) {
      try {
        return JSON.parse(readFileSync(join(dir, key(repo), 'budgets.json'), 'utf8'));
      } catch { return null; }
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
      // Only a non-negative integer counts. A float, a string or a negative is treated as "no
      // price stated" rather than coerced — a mispriced action is worse than an unpriced one,
      // because it silently moves a department's envelope by the wrong amount.
      amountMinor:
        typeof p.amount_minor === 'number' && Number.isInteger(p.amount_minor) && p.amount_minor >= 0
          ? p.amount_minor
          : 0,
      currency: typeof p.currency === 'string' && p.currency ? p.currency : null,
      outcome: (execR?.json as { reason?: string; result?: { note?: string } } | null)?.reason
        ?? (execR?.json as { result?: { note?: string } } | null)?.result?.note
        ?? null,
    });
  }
  // Proposed (awaiting the gate) first, then in-flight, then terminal.
  const rank: Record<ApprovalStatus, number> = { proposed: 0, granted: 1, executing: 2, executed: 3, rejected: 4 };
  out.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));

  // FB-054: attach the budget-envelope check. Deliberately AFTER the full list is built — the check
  // for one proposal depends on every other approval's spend, so it cannot be computed per-file as
  // they stream in, and it must never be taken from the proposal (the proposer would be grading its
  // own budget, from a snapshot that may be an hour stale).
  const envelopes = await loadEnvelopes(venture, source, repo);
  return attachEnvelopeChecks(out, envelopes);
}

/** Read the venture's envelopes from state. A source without budgets support means "none set". */
export async function loadEnvelopes(
  venture: VentureSummary,
  source: ApprovalSource,
  repo = venture.repos[0],
): Promise<Envelope[]> {
  if (!repo || !source.readBudgets) return [];
  try {
    return parseEnvelopes(await source.readBudgets(repo));
  } catch {
    // A budgets file that cannot be read must never blank the approvals queue — the founder's gate
    // matters more than the budget annotation on it (non-negotiable 10 is about surfacing, and an
    // approval that never renders surfaces nothing).
    return [];
  }
}

/**
 * Add each priced approval's envelope check to its `checks[]`.
 *
 * Only `proposed` approvals get one: past the gate the decision is made, and re-annotating an
 * executed action with today's budget picture would be telling the founder something about a choice
 * they can no longer change.
 */
export function attachEnvelopeChecks(
  approvals: ActiveGraphApproval[],
  envelopes: Envelope[],
): ActiveGraphApproval[] {
  if (!envelopes.length) return approvals;
  const byDept = new Map(envelopes.map((e) => [e.department, e]));
  const spends = approvals.map((a) => ({
    department: a.department,
    amountMinor: a.amountMinor,
    currency: a.currency,
    status: a.status,
  }));

  return approvals.map((a) => {
    if (a.status !== 'proposed' || !a.department || a.amountMinor <= 0) return a;
    const check = envelopeCheck(byDept.get(a.department), spends, a.department, a.amountMinor);
    return check ? { ...a, checks: [...a.checks, check] } : a;
  });
}
