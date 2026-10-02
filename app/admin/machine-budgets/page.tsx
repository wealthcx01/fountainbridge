import { readFileSync } from 'node:fs';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { withVenture } from '@/lib/db';
import { budgetOverview, type VentureBudget } from '@/lib/machine-budget';
import type { Querier } from '@/lib/machine-store';
import { budgetApprover, dollars } from '@/lib/ticket-machines';
import { ApproveBudgetButton, ProposeBudgetForm } from '@/components/MachineBudgetControls';

/**
 * Monthly budgets for temporary ticket machines (FB-239) — Bruntsfield only.
 *
 * John ruled on 2026-10-02 that a venture's team may work tickets on temporary machines only within
 * a monthly budget he approves once. This is where that happens: anyone at Bruntsfield proposes an
 * amount, and the budget approver (`BUDGET_APPROVER_EMAIL`) approves it here, signed in with Google.
 * Each step is written to the studio's ActiveGraph record as `approval.proposed` and
 * `approval.granted` (`lib/machine-budget.ts`).
 *
 * Admin-only and unlinked, like the timing page: a founder has no budget to set, and is told so.
 */
export const dynamic = 'force-dynamic';

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Fixture rows for the UI gate, which runs with no database. Only when the test login is on. */
function fixtureOverview(path: string): VentureBudget[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as VentureBudget[];
  return raw.map((v) => ({
    ...v,
    open: v.open.map((p) => ({ ...p, proposed_at: new Date(p.proposed_at), decided_at: null })),
  }));
}

async function readOverview(): Promise<{ rows: VentureBudget[] } | { error: string }> {
  const fixture = process.env.MACHINE_BUDGETS_FIXTURE;
  if (fixture && process.env.E2E_TEST_LOGIN === '1') return { rows: fixtureOverview(fixture) };
  if (!process.env.DATABASE_URL?.trim()) {
    return { error: 'The studio has no database set up yet, so budgets cannot be shown or changed here.' };
  }
  try {
    const rows = await budgetOverview({
      env: process.env,
      ventures: loadVentures(),
      withVenture: <T,>(id: string, fn: (q: Querier) => Promise<T>) => withVenture(id, (c) => fn(c as unknown as Querier)),
      record: async () => ({ ok: false, reason: 'not used for reading' }),
    });
    return { rows };
  } catch (e) {
    console.error('[machine-budgets] could not read', { message: (e as Error)?.message });
    return { error: 'The studio could not read the budgets just now. Nothing has changed; try again in a minute.' };
  }
}

export default async function MachineBudgetsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/login');

  const access = authorizeVentures(email, loadVentures(), parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  if (!access.isAdmin) {
    return (
      <p className="card" data-testid="machine-budgets-forbidden" style={{ fontSize: 'var(--fs-body-sm)' }}>
        This page is for the Bruntsfield team. Nothing here is about your venture.
      </p>
    );
  }

  const approver = budgetApprover(process.env);
  const isApprover = approver !== null && email.trim().toLowerCase() === approver;
  const switchedOn = process.env.TICKET_MACHINES?.trim() === 'on';
  const overview = await readOverview();

  return (
    <section data-testid="machine-budgets">
      <p className="eyebrow"><span className="eyebrow-id">Temporary machines</span> — Bruntsfield only</p>
      <h1 style={{ margin: '0 0 0.35rem' }}>Monthly budgets</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-body-sm)', maxWidth: 'var(--content-narrow)', marginTop: 0 }}>
        A venture&rsquo;s team works a ticket on a temporary machine only while the venture has a monthly
        budget, and only {approver ?? 'the budget approver'} can approve one. Anyone at Bruntsfield can
        propose an amount. {switchedOn
          ? 'Temporary machines are switched on in the studio.'
          : 'Temporary machines are switched off in the studio, so no machine is made whatever the budget.'}
      </p>
      {approver ? null : (
        <p className="card" data-testid="machine-budgets-no-approver" style={{ fontSize: 'var(--fs-body-sm)' }}>
          No budget approver is set on the studio (BUDGET_APPROVER_EMAIL), so no budget can be approved yet.
        </p>
      )}

      {'error' in overview ? (
        <p className="card muted" data-testid="machine-budgets-unavailable" style={{ fontSize: 'var(--fs-body-sm)' }}>
          {overview.error}
        </p>
      ) : (
        <div className="budget-list">
          {overview.rows.map((v) => (
            <article key={v.ventureId} className="card budget-card" data-testid={`budget-${v.ventureId}`}>
              <h2 className="budget-name">{v.name}</h2>
              <p className="budget-line" data-testid={`budget-${v.ventureId}-in-force`}>
                {v.inForce
                  ? <>{dollars(v.inForce.monthlyCents * 10_000)} a month, approved by {v.inForce.approver}. Spent this month: {dollars(v.spentMicroUsd)}.</>
                  : <>No budget in force, so no machine is made. Spent this month: {dollars(v.spentMicroUsd)}.</>}
              </p>
              {v.open.map((p) => (
                <div key={p.proposal_id} className="budget-proposal" data-testid={`budget-proposal-${p.proposal_id}`}>
                  <p className="budget-line">
                    Proposed: {p.monthly_cents > 0 ? `${dollars(p.monthly_cents * 10_000)} a month` : 'withdraw the budget'}, by {p.proposed_by} on {day(p.proposed_at)}.
                    {isApprover ? null : <> Waiting for {approver ?? 'the budget approver'} to approve it.</>}
                  </p>
                  {isApprover ? <ApproveBudgetButton ventureId={v.ventureId} proposalId={p.proposal_id} /> : null}
                </div>
              ))}
              <ProposeBudgetForm ventureId={v.ventureId} ventureName={v.name} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
