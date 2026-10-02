'use client';

import { useState, useTransition } from 'react';
import { approveMachineBudget, proposeMachineBudget } from '@/app/actions/machine-budget';
import { toneColor } from '@/lib/status';

type Result = { ok: boolean; message: string } | null;

function Said({ result, testId }: { result: Result; testId: string }) {
  if (!result) return null;
  return (
    <p
      data-testid={`${testId}-${result.ok ? 'done' : 'error'}`}
      style={{ fontSize: 'var(--fs-meta)', margin: '0.4rem 0 0', color: toneColor(result.ok ? 'ok' : 'blocked') }}
    >
      {result.message}
    </p>
  );
}

/**
 * Propose a monthly amount for one venture (FB-239). Any studio admin may propose; the amount
 * counts only once the budget approver approves it, and the line under the box says so.
 */
export function ProposeBudgetForm({ ventureId, ventureName }: { ventureId: string; ventureName: string }) {
  const [amount, setAmount] = useState('');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  const testId = `budget-propose-${ventureId}`;
  return (
    <div>
      <form
        className="budget-form"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await proposeMachineBudget(ventureId, amount);
            setResult(r);
            if (r.ok) setAmount('');
          });
        }}
      >
        <label className="budget-label" htmlFor={`${testId}-amount`}>Propose a monthly amount, in dollars</label>
        <span className="budget-row">
          <input
            id={`${testId}-amount`}
            className="budget-input"
            data-testid={`${testId}-amount`}
            inputMode="decimal"
            placeholder="40"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={`Monthly amount in dollars for ${ventureName}`}
          />
          <button type="submit" className="btn" data-testid={testId} disabled={pending || !amount.trim()}>
            {pending ? 'Proposing…' : 'Propose'}
          </button>
        </span>
      </form>
      <Said result={result} testId={testId} />
    </div>
  );
}

/** Approve one proposed amount. Shown only to the budget approver; the server checks again. */
export function ApproveBudgetButton({ ventureId, proposalId }: { ventureId: string; proposalId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result>(null);
  const testId = `budget-approve-${proposalId}`;
  if (result?.ok) return <Said result={result} testId={testId} />;
  return (
    <span>
      <button
        type="button"
        className="btn btn-primary"
        data-testid={testId}
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await approveMachineBudget(ventureId, proposalId)))}
      >
        {pending ? 'Approving…' : 'Approve this budget'}
      </button>
      <Said result={result} testId={testId} />
    </span>
  );
}
