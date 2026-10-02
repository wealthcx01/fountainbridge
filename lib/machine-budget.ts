/**
 * Monthly budgets for temporary ticket machines: proposed, then approved by John (FB-239).
 *
 * John ruled on 2026-10-02 that each venture gets a monthly budget for temporary machines that he
 * approves once. This is the only code that records one. It follows the studio's existing approval
 * pattern (`app/actions/approvals.ts`):
 *
 *   1. Someone at Bruntsfield proposes an amount for a venture. The proposal is stored, and
 *      `approval.proposed` is written to the studio's ActiveGraph record, signed.
 *   2. The budget approver — the one address in `BUDGET_APPROVER_EMAIL`, John's — opens the budget
 *      page signed in with Google and approves it. The studio checks the signed-in address on the
 *      server, signs the budget with `FOUNDRY_APPROVAL_SECRET`, stores it, and writes
 *      `approval.granted` to the record.
 *
 * Any studio admin may propose. Only the budget approver may approve: being an admin is not enough.
 * If the record cannot be written, nothing is stored — the database work is rolled back — so a
 * budget never exists without its `approval.proposed` and `approval.granted` events.
 *
 * Nothing here reads the session or the network. The server action passes in who is signed in and
 * how to write the record, so the tests drive this file with real Postgres and a stand-in record.
 */
import { randomBytes } from 'node:crypto';
import { machineBudgetAttestationFor } from './approval-attestation';
import type { ActiveGraphEvent } from './activegraph';
import { parseAdminEmails } from './authz';
import {
  decideProposal, getProposal, latestBudget, openProposals, recordBudget, recordProposal, spentIn,
  type ProposalRow, type Querier,
} from './machine-store';
import { budgetApprover, dollars, monthOf, verifyBudget } from './ticket-machines';
import { approvalRepos } from './venture-repos';
import type { VentureSummary } from './ventures';

export interface BudgetDeps {
  env: Record<string, string | undefined>;
  ventures: VentureSummary[];
  withVenture: <T>(ventureId: string, fn: (q: Querier) => Promise<T>) => Promise<T>;
  /** Write one signed event to the studio's ActiveGraph record. */
  record: (event: Omit<ActiveGraphEvent, 'attestation'>) => Promise<{ ok: true } | { ok: false; reason: string }>;
  now?: () => number;
  newId?: () => string;
}

export interface BudgetResult { ok: boolean; message: string }

/** The largest monthly budget the database accepts: $10,000. */
export const MAX_MONTHLY_CENTS = 1_000_000;

/** The approval id a budget's events are filed under. Its own prefix, so it never meets a send's. */
export const budgetApprovalId = (proposalId: string) => `machine-budget-${proposalId}`;

class RecordNotWritten extends Error {}

function eventRepo(venture: VentureSummary): string {
  return approvalRepos(venture)[0] ?? venture.id;
}

/** "40", "37.50", "0" → cents. Null for anything else, or more than the largest budget allowed. */
export function parseDollars(text: string): number | null {
  const t = (text ?? '').trim().replace(/^\$/, '');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents <= MAX_MONTHLY_CENTS ? cents : null;
}

export async function proposeBudget(deps: BudgetDeps, email: string | null | undefined, ventureId: string, amount: string): Promise<BudgetResult> {
  const now = deps.now ?? Date.now;
  if (!email) return { ok: false, message: 'You need to sign in.' };
  const who = email.trim().toLowerCase();
  if (!parseAdminEmails(deps.env.STUDIO_ADMIN_EMAILS).map((a) => a.toLowerCase()).includes(who)) {
    return { ok: false, message: 'Only Bruntsfield can propose a budget for temporary machines.' };
  }
  const venture = deps.ventures.find((v) => v.id === ventureId);
  if (!venture) return { ok: false, message: 'There is no such venture.' };
  const cents = parseDollars(amount);
  if (cents === null) {
    return { ok: false, message: `Give the monthly amount in dollars, for example 40 or 37.50, up to ${dollars(MAX_MONTHLY_CENTS * 10_000)}.` };
  }

  const proposalId = (deps.newId ?? (() => randomBytes(8).toString('hex')))();
  const at = new Date(now());
  try {
    await deps.withVenture(venture.id, async (q) => {
      await recordProposal(q, { venture_id: venture.id, proposal_id: proposalId, monthly_cents: cents, proposed_by: who, proposed_at: at });
      const written = await deps.record({
        v: 1, seq: 1, venture: venture.id, repo: eventRepo(venture), id: budgetApprovalId(proposalId),
        type: 'approval.proposed', at: at.toISOString(),
        actor: { kind: 'human', id: who },
        data: { kind: 'machine-budget', monthly_cents: String(cents) },
      });
      if (!written.ok) throw new RecordNotWritten(written.reason);
    });
  } catch (e) {
    if (e instanceof RecordNotWritten) {
      return { ok: false, message: `The proposal could not be written to the approval record (${e.message}), so nothing was proposed.` };
    }
    throw e;
  }
  const approver = budgetApprover(deps.env);
  return {
    ok: true,
    message: `Proposed ${dollars(cents * 10_000)} a month for ${venture.name}. It counts once ${approver ?? 'the budget approver'} approves it.`,
  };
}

export async function approveBudget(deps: BudgetDeps, email: string | null | undefined, ventureId: string, proposalId: string): Promise<BudgetResult> {
  const now = deps.now ?? Date.now;
  if (!email) return { ok: false, message: 'You need to sign in.' };
  const approver = budgetApprover(deps.env);
  if (!approver) {
    return { ok: false, message: 'The studio has no budget approver set (BUDGET_APPROVER_EMAIL), so no budget can be approved.' };
  }
  const who = email.trim().toLowerCase();
  if (who !== approver) return { ok: false, message: `Only ${approver} can approve a budget for temporary machines.` };
  const secret = deps.env.FOUNDRY_APPROVAL_SECRET?.trim();
  if (!secret) return { ok: false, message: 'Approvals are not set up on the studio yet (no signing secret), so nothing was approved.' };
  const venture = deps.ventures.find((v) => v.id === ventureId);
  if (!venture) return { ok: false, message: 'There is no such venture.' };
  if (!/^[a-f0-9]{16}$/.test(proposalId)) return { ok: false, message: 'That is not a budget proposal.' };

  const at = new Date(now());
  let outcome: BudgetResult;
  try {
    outcome = await deps.withVenture(venture.id, async (q) => {
      const p = await getProposal(q, proposalId);
      if (!p) return { ok: false, message: 'That proposal no longer exists.' };
      if (!(await decideProposal(q, proposalId, who, at))) return { ok: false, message: 'That proposal has already been approved.' };
      const approvedAt = at.toISOString();
      await recordBudget(q, {
        venture_id: venture.id, proposal_id: proposalId, monthly_cents: p.monthly_cents, approver: who, approved_at: approvedAt,
        attestation: machineBudgetAttestationFor(venture.id, proposalId, p.monthly_cents, who, approvedAt, secret),
      });
      const written = await deps.record({
        v: 1, seq: 2, venture: venture.id, repo: eventRepo(venture), id: budgetApprovalId(proposalId),
        type: 'approval.granted', at: approvedAt,
        actor: { kind: 'human', id: who },
        data: { kind: 'machine-budget', monthly_cents: String(p.monthly_cents) },
      });
      if (!written.ok) throw new RecordNotWritten(written.reason);
      return p.monthly_cents > 0
        ? { ok: true, message: `Approved: ${dollars(p.monthly_cents * 10_000)} a month for temporary machines for ${venture.name}, starting now.` }
        : { ok: true, message: `Withdrawn: ${venture.name} has no budget for temporary machines now, so none will be made.` };
    });
  } catch (e) {
    if (e instanceof RecordNotWritten) {
      return { ok: false, message: `Your approval could not be written to the approval record (${e.message}), so the budget was not approved. Try again.` };
    }
    throw e;
  }
  return outcome;
}

export interface VentureBudget {
  ventureId: string;
  name: string;
  /** The budget that counts today, or null. */
  inForce: { monthlyCents: number; approver: string } | null;
  spentMicroUsd: number;
  open: ProposalRow[];
}

/** What the budget page shows for each venture. */
export async function budgetOverview(deps: BudgetDeps): Promise<VentureBudget[]> {
  const now = deps.now ?? Date.now;
  const month = monthOf(now());
  const out: VentureBudget[] = [];
  for (const v of deps.ventures) {
    const { row, spent, open } = await deps.withVenture(v.id, async (q) => ({
      row: await latestBudget(q), spent: await spentIn(q, month), open: await openProposals(q),
    }));
    const check = verifyBudget(row, v.id, deps.env.FOUNDRY_APPROVAL_SECRET?.trim(), budgetApprover(deps.env));
    out.push({
      ventureId: v.id,
      name: v.name,
      inForce: check.ok ? { monthlyCents: check.monthlyCents, approver: check.approver } : null,
      spentMicroUsd: spent,
      open,
    });
  }
  return out;
}
