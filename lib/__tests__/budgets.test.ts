import { describe, it, expect } from 'vitest';
import {
  parseEnvelopes,
  committedSpend,
  envelopeStatus,
  envelopeCheck,
  formatMoney,
  NEARING_THRESHOLD,
  type Spend,
} from '../budgets';
import { attachEnvelopeChecks, type ActiveGraphApproval } from '../approvals';

const envelope = { department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'per month' };

const spend = (over: Partial<Spend> = {}): Spend => ({
  department: 'sell',
  amountMinor: 100_000,
  status: 'executed',
  ...over,
});

describe('parseEnvelopes — a missing or wrong budgets file must never read as "over budget"', () => {
  it('parses the state file', () => {
    const out = parseEnvelopes({ currency: 'GBP', period: 'per month', departments: { sell: 480_000, scale: 100_000 } });
    expect(out).toEqual([
      { department: 'scale', limitMinor: 100_000, currency: 'GBP', period: 'per month' },
      { department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'per month' },
    ]);
  });

  it('defaults the currency and period', () => {
    expect(parseEnvelopes({ departments: { sell: 1 } })[0]).toMatchObject({ currency: 'GBP', period: 'per month' });
  });

  it('returns nothing for a missing, null or malformed file', () => {
    for (const raw of [null, undefined, 'nonsense', 42, {}, { departments: 'no' }]) {
      expect(parseEnvelopes(raw)).toEqual([]);
    }
  });

  it('drops a non-integer limit rather than misprice the gate by 100x', () => {
    // 4800.5 is someone writing POUNDS where pence were expected. Accepting it would set a £48
    // envelope and flag every real spend as over budget.
    expect(parseEnvelopes({ departments: { sell: 4800.5, scale: -1, build: '500' } })).toEqual([]);
  });

  it('accepts a zero limit — "no spending here" is a real budget', () => {
    expect(parseEnvelopes({ departments: { sell: 0 } })).toHaveLength(1);
  });
});

describe('committedSpend — what actually counts against an envelope', () => {
  it('counts granted, executing and executed', () => {
    const spends = [spend({ status: 'granted' }), spend({ status: 'executing' }), spend({ status: 'executed' })];
    expect(committedSpend(spends, 'sell')).toBe(300_000);
  });

  it('excludes proposed — an unapproved ask must not squeeze out real work', () => {
    expect(committedSpend([spend({ status: 'proposed' })], 'sell')).toBe(0);
  });

  it('excludes rejected, and other departments', () => {
    expect(committedSpend([spend({ status: 'rejected' })], 'sell')).toBe(0);
    expect(committedSpend([spend({ department: 'build' })], 'sell')).toBe(0);
  });

  it('ignores a non-finite amount instead of poisoning the total with NaN', () => {
    expect(committedSpend([spend(), spend({ amountMinor: NaN })], 'sell')).toBe(100_000);
  });
});

describe('envelopeStatus', () => {
  it('reports within, with the pending spend included', () => {
    // The founder needs to see what approving this WOULD do, not the world without it.
    const s = envelopeStatus(envelope, [spend()], 'sell', 100_000);
    expect(s.state).toBe('within');
    expect(s.spentMinor).toBe(200_000);
    expect(s.percent).toBe(42);
  });

  it('reports nearing at the threshold', () => {
    const s = envelopeStatus(envelope, [spend({ amountMinor: envelope.limitMinor * NEARING_THRESHOLD })], 'sell');
    expect(s.state).toBe('nearing');
    expect(s.detail).toContain('80% of £4,800');
  });

  it('reports over, with the percentage the founder will ask about', () => {
    const s = envelopeStatus(envelope, [spend({ amountMinor: 500_000 })], 'sell');
    expect(s.state).toBe('over');
    expect(s.detail).toBe('over — 104% of £4,800 per month');
  });

  it('is "unset" — never "over" — when no envelope exists', () => {
    const s = envelopeStatus(undefined, [spend()], 'sell');
    expect(s.state).toBe('unset');
    expect(s.detail).toBe('no budget set');
  });

  it('handles a zero limit without dividing by zero', () => {
    const zero = { ...envelope, limitMinor: 0 };
    expect(envelopeStatus(zero, [], 'sell').state).toBe('within');
    expect(envelopeStatus(zero, [], 'sell').percent).toBe(0);
    const spent = envelopeStatus(zero, [spend({ amountMinor: 1 })], 'sell');
    expect(spent.state).toBe('over');
    expect(Number.isFinite(spent.percent)).toBe(true);
  });
});

describe('formatMoney', () => {
  it('renders minor units as a founder would read them', () => {
    expect(formatMoney(480_000, 'GBP')).toBe('£4,800');
    expect(formatMoney(1_050, 'GBP')).toBe('£10.50');
    expect(formatMoney(500, 'USD')).toBe('$5');
    expect(formatMoney(500, 'CHF')).toBe('5 CHF');
  });
});

describe('envelopeCheck — what the founder sees at approve-time', () => {
  it('fails an over-envelope spend, but stays informational', () => {
    const check = envelopeCheck(envelope, [spend({ amountMinor: 400_000 })], 'sell', 200_000);
    expect(check).toEqual({
      name: 'sell budget envelope',
      passed: false,
      detail: 'over — 125% of £4,800 per month',
    });
  });

  it('passes a spend within the envelope', () => {
    expect(envelopeCheck(envelope, [], 'sell', 100_000)?.passed).toBe(true);
  });

  it('says nothing about a free action or an unbudgeted department', () => {
    expect(envelopeCheck(envelope, [], 'sell', 0)).toBeNull();
    expect(envelopeCheck(undefined, [], 'sell', 100_000)).toBeNull();
  });
});

// The ticket's own verification: "an over-envelope spend renders a failing check on the approval card."
describe('attachEnvelopeChecks — the check the card renders', () => {
  const approval = (over: Partial<ActiveGraphApproval> = {}): ActiveGraphApproval => ({
    id: 'a1',
    kind: 'activegraph',
    ventureId: 'arca',
    repo: 'wealthcx01/arca',
    status: 'proposed',
    proposalSha: 'sha',
    ticket: null,
    department: 'sell',
    actionType: 'send',
    summary: 'Send the launch email to 4,000 people',
    checks: [{ name: 'no PII in the body', passed: true }],
    amountMinor: 200_000,
    currency: 'GBP',
    outcome: null,
    ...over,
  });

  it('appends a FAILING envelope check to an over-budget proposal, keeping the lane’s own checks', () => {
    const prior = approval({ id: 'a0', status: 'executed', amountMinor: 400_000 });
    const [, pending] = attachEnvelopeChecks([prior, approval()], [envelope]);
    expect(pending.checks).toHaveLength(2);
    expect(pending.checks[0].name).toBe('no PII in the body');
    expect(pending.checks[1]).toMatchObject({ name: 'sell budget envelope', passed: false });
    expect(pending.checks[1].detail).toContain('125%');
  });

  it('does not re-annotate an approval past the gate — that decision is already made', () => {
    const done = approval({ status: 'executed', amountMinor: 900_000 });
    expect(attachEnvelopeChecks([done], [envelope])[0].checks).toHaveLength(1);
  });

  it('leaves everything alone when no envelopes are configured', () => {
    const input = [approval()];
    expect(attachEnvelopeChecks(input, [])).toBe(input);
  });

  it('ignores a proposal with no price or no department', () => {
    expect(attachEnvelopeChecks([approval({ amountMinor: 0 })], [envelope])[0].checks).toHaveLength(1);
    expect(attachEnvelopeChecks([approval({ department: null })], [envelope])[0].checks).toHaveLength(1);
  });

  it('counts a second pending proposal’s own spend but not its sibling’s', () => {
    // Two unapproved asks must each be judged on committed spend + THEMSELVES. If a proposal counted
    // its siblings, filing two would make both look over budget and the founder could approve
    // neither.
    const [first, second] = attachEnvelopeChecks(
      [approval({ id: 'a1', amountMinor: 300_000 }), approval({ id: 'a2', amountMinor: 300_000 })],
      [envelope],
    );
    expect(first.checks[1]).toMatchObject({ passed: true });
    expect(second.checks[1]).toMatchObject({ passed: true });
  });
});
