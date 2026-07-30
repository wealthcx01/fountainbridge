/**
 * Department budget envelopes (FB-054) — applying meridian's `Company.budgets`.
 *
 * Each of a venture's departments (Build / Sell / Scale, FB-048) carries a spend envelope the
 * founder sets. When an external action that costs money reaches the gate, the studio computes what
 * it would do to that department's envelope and shows it as a policy check on the approval card —
 * so the founder sees the budget impact at the moment they decide, not in a bill afterwards.
 *
 * Two design decisions worth stating, because both are load-bearing:
 *
 * 1. **The envelope check is computed HERE, not read from the proposal.** FB-044's `checks[]` are
 *    written by the lane that proposes the action. A lane asserting its own spend is within budget
 *    is the proposer marking its own homework — and worse, a stale snapshot: two proposals written
 *    an hour apart both "within budget" can blow the envelope together. The studio holds the live
 *    total, so the studio computes the check.
 *
 * 2. **Money is integer minor units (pence), never floats.** `0.1 + 0.2 !== 0.3`, and a budget gate
 *    that drifts by rounding is worse than no gate: it would pass a spend it should have flagged and
 *    nobody would know why.
 *
 * Envelopes live in venture STATE (a `budgets.json` on the approvals ref), not in the manifest. The
 * Venture contract's `Department` is `additionalProperties: false` and pinned to bcap-contracts, so
 * a `budget` field there is a change to *that* repo (non-negotiable 7). The ticket allows either
 * ("manifest/state"); state is the half that does not need another repo's release. See FB-054.
 */

import type { PolicyCheck } from './approvals';

/** Fraction of the envelope at which a department is "nearing" its limit and worth flagging. */
export const NEARING_THRESHOLD = 0.8;

export interface Envelope {
  /** Department id this envelope governs (matches DepartmentSummary.id). */
  department: string;
  /** The limit in minor units (pence for GBP). */
  limitMinor: number;
  currency: string;
  /** Free-text period label for the founder ("per month"). Not enforced here — see note below. */
  period: string;
}

export type EnvelopeState = 'within' | 'nearing' | 'over' | 'unset';

export interface EnvelopeStatus {
  department: string;
  state: EnvelopeState;
  /** Committed spend + anything pending, in minor units. */
  spentMinor: number;
  limitMinor: number;
  currency: string;
  /** Spend as a percentage of the limit, rounded. 0 when there is no limit. */
  percent: number;
  /** Founder-facing one-liner: "104% of £4,800 for Sell". */
  detail: string;
}

/** Anything with a department and a cost — the shape both approvals and test fixtures satisfy. */
export interface Spend {
  department: string | null;
  amountMinor: number;
  currency?: string | null;
  /** Only committed statuses count toward spend; see `committedSpend`. */
  status: string;
}

/**
 * Parse the `budgets.json` state file. Tolerant of a missing/garbage file — a venture with no
 * budgets configured is the normal case, and must render as "no envelope set", never as an error
 * and never as "over budget" (which would block real work over a missing config file).
 *
 * Expected shape:
 *   { "currency": "GBP", "period": "per month",
 *     "departments": { "sell": 480000, "scale": 100000 } }
 */
export function parseEnvelopes(raw: unknown): Envelope[] {
  if (!raw || typeof raw !== 'object') return [];
  const doc = raw as { currency?: unknown; period?: unknown; departments?: unknown };
  const currency = typeof doc.currency === 'string' && doc.currency ? doc.currency : 'GBP';
  const period = typeof doc.period === 'string' && doc.period ? doc.period : 'per month';
  const depts = doc.departments;
  if (!depts || typeof depts !== 'object') return [];

  const out: Envelope[] = [];
  for (const [department, value] of Object.entries(depts as Record<string, unknown>)) {
    // A limit must be a non-negative integer of minor units. A float here means someone wrote
    // pounds where pence were expected — accepting it silently would misprice the gate by 100x,
    // so it is dropped and the department reads "no envelope" rather than a wrong one.
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) continue;
    out.push({ department, limitMinor: value, currency, period });
  }
  return out.sort((a, b) => a.department.localeCompare(b.department));
}

/**
 * Spend that counts against an envelope: everything a human has already waved through, plus what is
 * mid-flight. `proposed` is excluded — it has not been approved, and counting it would let an
 * unapproved (or never-to-be-approved) proposal squeeze out real work.
 */
export function committedSpend(spends: Spend[], department: string): number {
  return spends
    .filter((s) => s.department === department)
    .filter((s) => s.status === 'granted' || s.status === 'executing' || s.status === 'executed')
    .reduce((sum, s) => sum + (Number.isFinite(s.amountMinor) ? s.amountMinor : 0), 0);
}

/** Format minor units as a founder-facing amount: 480000 + GBP → "£4,800". */
export function formatMoney(minor: number, currency: string): string {
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  const symbol = symbols[currency] ?? '';
  const major = minor / 100;
  const text = Number.isInteger(major)
    ? major.toLocaleString('en-GB')
    : major.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${symbol}${text}` : `${text} ${currency}`;
}

/**
 * Where a department stands against its envelope, optionally including a spend being considered.
 *
 * `pendingMinor` is the proposal on the table: the founder needs to see what approving it WOULD do,
 * not what the world looks like without it.
 */
export function envelopeStatus(
  envelope: Envelope | undefined,
  spends: Spend[],
  departmentName: string,
  pendingMinor = 0,
): EnvelopeStatus {
  const department = envelope?.department ?? departmentName;
  if (!envelope) {
    return {
      department,
      state: 'unset',
      spentMinor: 0,
      limitMinor: 0,
      currency: 'GBP',
      percent: 0,
      detail: 'no budget set',
    };
  }

  const spentMinor = committedSpend(spends, envelope.department) + Math.max(0, pendingMinor);
  const { limitMinor, currency } = envelope;
  // A zero limit means "no spending here", so anything at all is over — but zero spend against it is
  // still within. Guarding the division separately keeps that from becoming NaN or Infinity%.
  const percent = limitMinor > 0 ? Math.round((spentMinor / limitMinor) * 100) : spentMinor > 0 ? 100 : 0;
  // The `limitMinor > 0` guard on `nearing` is not redundant: with a zero limit and zero spend,
  // `0 >= 0 * 0.8` is true, and a department that has spent nothing would read as "nearing" its
  // budget. Nothing has happened yet — that is `within`.
  const state: EnvelopeState =
    spentMinor > limitMinor
      ? 'over'
      : limitMinor > 0 && spentMinor >= limitMinor * NEARING_THRESHOLD
        ? 'nearing'
        : 'within';

  const of = `${formatMoney(limitMinor, currency)} ${envelope.period}`;
  const detail =
    state === 'over'
      ? `over — ${percent}% of ${of}`
      : state === 'nearing'
        ? `nearing — ${percent}% of ${of}`
        : `within — ${percent}% of ${of}`;

  return { department, state, spentMinor, limitMinor, currency, percent, detail };
}

/**
 * The policy check the founder sees on a spend approval.
 *
 * `passed: false` does NOT block the approval — it informs it. The founder may well decide the
 * over-budget send is the right call; what they must not be able to do is make that call unaware.
 * (Hard-blocking belongs to the executor's own checks, not to a presentation-layer read model.)
 */
export function envelopeCheck(
  envelope: Envelope | undefined,
  spends: Spend[],
  departmentName: string,
  pendingMinor: number,
): PolicyCheck | null {
  // Nothing to say about an action that costs nothing, or a department with no envelope set.
  if (!envelope || pendingMinor <= 0) return null;
  const status = envelopeStatus(envelope, spends, departmentName, pendingMinor);
  return {
    name: `${departmentName} budget envelope`,
    passed: status.state !== 'over',
    detail: status.detail,
  };
}
