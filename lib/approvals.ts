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
import { disclose, normalizeCurrency, type BudgetDisclosure, type Envelope, type Spend } from './budgets';

/** Read a proposal's stated price, keeping "no price" and "unreadable price" distinct. */
function readPrice(raw: unknown): { amountMinor: number | null; unreadable: boolean } {
  if (raw === undefined || raw === null) return { amountMinor: null, unreadable: false };
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return { amountMinor: raw, unreadable: false };
  return { amountMinor: null, unreadable: true };
}

/** When the spend became committed, for period windowing. Absent in v0 records. */
function committedAtOf(grant: unknown, execution: unknown): string | null {
  const g = grant as { granted_at?: unknown } | null;
  const e = execution as { executed_at?: unknown; started_at?: unknown } | null;
  // The STUDIO writes grant.json's `granted_at`; the venture box writes execution.json. Prefer the
  // studio's, because the window is now load-bearing and a lane that can rewrite `executed_at` can
  // push its own past spend out of the period. (Neither is covered by the HMAC — see the ticket.)
  for (const v of [g?.granted_at, e?.executed_at, e?.started_at]) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

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
  /**
   * Cost in integer minor units, or null when the action states no readable price (FB-054).
   * Null is NOT zero: `priceUnreadable` distinguishes "free" from "we could not read the price",
   * and the latter must fail the envelope check rather than vanish from it.
   */
  amountMinor: number | null;
  /** True when a price WAS stated but could not be read (float, string, negative). */
  priceUnreadable: boolean;
  /** Normalised ISO-4217 currency, or null when unstated/unusable. */
  currency: string | null;
  /** When this approval was committed (grant/execution timestamp), for period windowing. */
  committedAt: string | null;
  /**
   * What the studio can say about this department's budget: the founder's own limit, and the spend
   * the VENTURE reports. Never a verdict on the action — see lib/budgets.ts on why.
   */
  budget: BudgetDisclosure | null;
  /** result/reason from execution.json when past the gate. */
  outcome: string | null;
}

/** Reads the raw JSON files of one approval; returns null for a missing file. Injectable for tests. */
export interface ApprovalSource {
  /** approval ids under `approvals/` on the ref. */
  listIds(repo: string): Promise<string[]>;
  read(repo: string, id: string, file: 'proposal' | 'grant' | 'execution'): Promise<{ json: unknown; sha: string } | null>;
  // NOTE: budget envelopes are deliberately NOT read through this source. They live in the STUDIO
  // repo (`ventures/budgets/<id>.yaml`), because this source reads the venture ref that the
  // proposing lane can write — an agent must not be able to edit the limits that police it.
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
    const priced = readPrice(p.amount_minor);
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
      // A float, string or negative is NOT coerced to zero — that made a £5,200 send with a
      // malformed price render as a free action with no check at all. `null` + `priceUnreadable`
      // carries the difference through to a failing check.
      amountMinor: priced.amountMinor,
      priceUnreadable: priced.unreadable,
      currency: normalizeCurrency(p.currency),
      committedAt: committedAtOf(grantR?.json ?? null, execR?.json ?? null),
      budget: null,
      outcome: (execR?.json as { reason?: string; result?: { note?: string } } | null)?.reason
        ?? (execR?.json as { result?: { note?: string } } | null)?.result?.note
        ?? null,
    });
  }
  // Proposed (awaiting the gate) first, then in-flight, then terminal.
  const rank: Record<ApprovalStatus, number> = { proposed: 0, granted: 1, executing: 2, executed: 3, rejected: 4 };
  out.sort((a, b) => rank[a.status] - rank[b.status] || a.id.localeCompare(b.id));

  return out;
}

/**
 * Attach each awaiting proposal's budget disclosure.
 *
 * Runs after the full list is built: the figure depends on every other approval's spend, so it
 * cannot be computed per-file as they stream in — and it is never taken from the proposal, where the
 * proposer would be reporting its own budget position.
 *
 * A proposal naming a department the venture does not declare gets no disclosure: there is no limit
 * to disclose. That is a fact about configuration, not a judgement on the spend, and it is shown as
 * such rather than as a failed check.
 */
export function attachBudgetDisclosure(
  approvals: ActiveGraphApproval[],
  envelopes: Envelope[],
  knownDepartments: Set<string>,
  now: Date,
): ActiveGraphApproval[] {
  const byDept = new Map(envelopes.map((e) => [e.department, e]));
  const spends = toSpends(approvals);

  return approvals.map((a) => {
    if (a.status !== 'proposed') return a;
    const department = a.department ?? '';
    if (!department || !knownDepartments.has(department)) return a;
    const envelope = byDept.get(department);
    if (!envelope) return a;
    return { ...a, budget: disclose(envelope, spends, now, a.amountMinor ?? 0, a.id) };
  });
}

/** One derivation of approval → spend, so the board and the cards cannot drift apart. */
export function toSpends(approvals: ActiveGraphApproval[]): Spend[] {
  return approvals.map((a) => ({
    id: a.id,
    department: a.department,
    // `?? 0` here used to make an unreadable-price GRANTED action contribute exactly nothing to the
    // department total, forever, named nowhere — the fail-closed rule protected the decision and
    // left the running total it is measured against silently understated.
    amountMinor: a.amountMinor ?? 0,
    // Carried, not flattened: a granted action whose price could not be read must be NAMED, never
    // silently counted as £0 in the total the founder reads.
    uncountable: a.priceUnreadable ? ('unreadable-price' as const) : undefined,
    currency: a.currency,
    status: a.status,
    at: a.committedAt,
  }));
}
