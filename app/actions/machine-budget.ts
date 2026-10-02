'use server';

/**
 * Propose and approve a monthly budget for temporary ticket machines (FB-239).
 *
 * The same shape as `approvals.ts`: the signed-in address is read from the session on the server,
 * never from anything the page sends, and the record is written with the studio's own write
 * credential and signing secret, which no lane holds. The rules — who may propose, that only
 * `BUDGET_APPROVER_EMAIL` may approve, and that nothing is stored unless the record is written —
 * live in `lib/machine-budget.ts`, where they are tested.
 */

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { withVenture } from '@/lib/db';
import { appendEvent } from '@/lib/activegraph-log';
import type { Querier } from '@/lib/machine-store';
import { approveBudget, proposeBudget, type BudgetDeps, type BudgetResult } from '@/lib/machine-budget';

function deps(): BudgetDeps {
  const env = process.env;
  return {
    env,
    ventures: loadVentures(),
    withVenture: <T>(id: string, fn: (q: Querier) => Promise<T>) => withVenture(id, (c) => fn(c as unknown as Querier)),
    record: (event) => appendEvent(env.STUDIO_APPROVAL_GITHUB_TOKEN ?? '', event, env.FOUNDRY_APPROVAL_SECRET ?? ''),
  };
}

async function signedInEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

function fault(e: unknown, what: string): BudgetResult {
  console.error(`[machine-budget] ${what} failed`, { message: (e as Error)?.message });
  return { ok: false, message: 'The studio could not save this just now, so nothing changed. Try again in a minute.' };
}

export async function proposeMachineBudget(ventureId: string, amount: string): Promise<BudgetResult> {
  try {
    const r = await proposeBudget(deps(), await signedInEmail(), ventureId, amount);
    if (r.ok) revalidatePath('/admin/machine-budgets');
    return r;
  } catch (e) {
    return fault(e, 'propose');
  }
}

export async function approveMachineBudget(ventureId: string, proposalId: string): Promise<BudgetResult> {
  try {
    const r = await approveBudget(deps(), await signedInEmail(), ventureId, proposalId);
    if (r.ok) revalidatePath('/admin/machine-budgets');
    return r;
  } catch (e) {
    return fault(e, 'approve');
  }
}
