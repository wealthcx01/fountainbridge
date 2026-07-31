/**
 * Department budget disclosure (FB-054) — applying meridian's `Company.budgets`, narrowed.
 *
 * Each department carries a spend limit the founder sets. When an external action that costs money
 * reaches the gate, the studio shows what that department's budget looks like — so the founder sees
 * the position at the moment they decide, not in a bill afterwards.
 *
 * ## Why this DISCLOSES rather than judges
 *
 * Three review passes killed the earlier design, which rendered a verdict: a pass/fail policy check
 * saying whether a spend was "within budget". A verdict has to be true or false, and the studio can
 * support neither, because almost every input belongs to the party being gated:
 *
 *   - the amount, currency and department are written by the proposing lane;
 *   - the timestamps are lane-written and covered by no attestation;
 *   - a lane can write `execution.json {status:'rejected'}` over its own grant and erase the spend;
 *   - spend for a department with its own repo is not read at all (see the ticket).
 *
 * Every guard added to compensate produced a worse failure than the one it replaced. Failing closed
 * on anything uncountable meant an ordinary no-cost action — a post, a tweet, every proposal that
 * predates this feature — turned the gate permanently red, and let a lane freeze a department by
 * filing one costless proposal. Judging on the queue let one unapproved million-pound proposal fail
 * every honest card beside it.
 *
 * So this states facts and attributes them:
 *
 *   **The limit is the studio's.** It lives in `ventures/budgets/<id>.yaml` in the STUDIO repo,
 *   which venture lanes cannot write; changing it goes through this repo's PR + CI gate. That much
 *   the studio genuinely owns and can stand behind.
 *
 *   **The spend is the venture's report.** It is summed where it can be and NAMED where it cannot,
 *   and the founder is told whose number it is. What the studio will not do is convert a figure it
 *   cannot verify into a verdict that looks like it did.
 *
 * Money is integer minor units throughout — `0.1 + 0.2 !== 0.3`, and a budget figure that drifts by
 * rounding is worse than none.
 */

export type Period = 'monthly' | 'quarterly' | 'yearly' | 'all-time';

export interface Envelope {
  /** Department id this limit governs (matches DepartmentSummary.id). */
  department: string;
  /** The limit in minor units (pence for GBP). */
  limitMinor: number;
  currency: string;
  /** The window reported spend is summed over. Enforced — see `withinPeriod`. */
  period: Period;
}

/** Anything with a department and a cost. Both approvals and test fixtures satisfy it. */
export interface Spend {
  /** The approval this spend came from, so the one being decided can be excluded from its own queue. */
  id?: string;
  department: string | null;
  amountMinor: number;
  currency?: string | null;
  status: string;
  /** ISO-8601 with offset, from the grant/execution record. Null when the record carries none. */
  at?: string | null;
  /** Set when the amount could not be read, so it is named rather than counted as £0. */
  uncountable?: 'unreadable-price';
}

/** What the studio can say about one department's budget. Facts and their provenance — no verdict. */
export interface BudgetDisclosure {
  department: string;
  /** The founder's own limit, from the studio repo. */
  limitMinor: number;
  currency: string;
  period: Period;
  /** Committed spend the venture reports for this window, plus any proposal being decided. */
  reportedMinor: number;
  /** Spend queued in this department and awaiting the founder. */
  queuedMinor: number;
  /** Committed or queued spend the studio could not add up, phrased for a founder. */
  notes: string[];
  /** Reported + queued exceeds the limit. A statement about the reported figures, not a judgement. */
  overLimit: boolean;
}

/** ISO-4217-shaped: three uppercase letters. Anything else is not a currency we will do maths on. */
const CURRENCY_RE = /^[A-Z]{3}$/;

/** Normalise a supplied currency. Null when unusable, so `"gbp "` cannot dodge a comparison. */
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return CURRENCY_RE.test(upper) ? upper : null;
}

export function parsePeriod(raw: unknown): Period | null {
  if (raw === undefined || raw === null) return 'monthly';
  const v = String(raw).trim().toLowerCase();
  return v === 'monthly' || v === 'quarterly' || v === 'yearly' || v === 'all-time' ? v : null;
}

export function periodLabel(period: Period): string {
  switch (period) {
    case 'monthly': return 'this month';
    case 'quarterly': return 'this quarter';
    case 'yearly': return 'this year';
    case 'all-time': return 'all time';
  }
}

/** The start of the current window. `all-time` has none. */
export function periodStart(period: Period, now: Date): Date | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (period) {
    case 'monthly': return new Date(Date.UTC(y, m, 1));
    case 'quarterly': return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
    case 'yearly': return new Date(Date.UTC(y, 0, 1));
    case 'all-time': return null;
  }
}

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * When a spend happened, or null if we cannot know.
 *
 * Strict ISO-8601 WITH an offset only: an offset-less datetime resolves in server-local time, so on
 * a deployment not pinned to UTC a spend near a period boundary would land in the wrong window,
 * silently. A FUTURE timestamp is rejected too — the value is lane-written and the window comparison
 * has no upper bound, so a year-3000 date would otherwise sit in every window forever.
 */
export function spendInstant(at: string | null | undefined, now: Date): number | null {
  if (!at || !ISO_WITH_OFFSET.test(at)) return null;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms) || ms > now.getTime()) return null;
  return ms;
}

/** Undatable spend counts in every window — understating a budget is the direction that hurts. */
export function withinPeriod(spend: Spend, period: Period, now: Date): boolean {
  const start = periodStart(period, now);
  if (!start) return true;
  const ms = spendInstant(spend.at, now);
  return ms === null || ms >= start.getTime();
}

/** Statuses that represent money the venture says is already committed. */
const COMMITTED = new Set(['granted', 'executing', 'executed']);

/** Does this spend involve money at all? A free action has no currency to state and no total to join. */
const hasCost = (s: Spend) => s.uncountable === 'unreadable-price' || s.amountMinor > 0;

/** Format minor units as a founder reads them: 480000 + GBP → "£4,800". */
export function formatMoney(minor: number, currency: string): string {
  // Object.hasOwn, not a bare lookup: a currency of "constructor" walks the prototype chain and
  // returns an inherited function, which `?? ''` does not catch.
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  const symbol = Object.hasOwn(symbols, currency) ? symbols[currency] : '';
  const major = minor / 100;
  const text = Number.isInteger(major)
    ? major.toLocaleString('en-GB')
    : major.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${symbol}${text}` : `${text} ${currency}`;
}

/** Spend as a percentage of a limit. One definition, so no second formula can disagree with it. */
export function pct(amountMinor: number, limitMinor: number): number {
  if (limitMinor > 0) return Math.round((amountMinor / limitMinor) * 100);
  return amountMinor > 0 ? 100 : 0;
}

// --- the disclosure ----------------------------------------------------------------------------

/**
 * Sum what can be summed for one department, and name what cannot.
 *
 * `hasCost` guards every "could not count this" branch. Without it an ordinary FREE action —
 * `{amountMinor: 0, currency: null}`, which is every action stating no price, including every
 * proposal predating this feature — was booked as spend in an unknown currency. That is how the
 * previous design became permanently unable to report on any real venture.
 */
function tally(spends: Spend[], department: string, currency: string, period: Period, now: Date, excludeId?: string) {
  const mine = spends.filter((s) => s.department === department);
  const committed = mine.filter((s) => COMMITTED.has(s.status)).filter((s) => withinPeriod(s, period, now));
  // The proposal being decided is carried as `pendingMinor`; counting it in the queue as well would
  // report it twice — caught by the UI gate, which read 300% where it should read 192%.
  const queued = mine.filter((s) => s.status === 'proposed' && (!excludeId || s.id !== excludeId));
  const notes: string[] = [];

  const countable = (s: Spend) => !s.uncountable && (!hasCost(s) || s.currency === currency);
  const reportedMinor = committed.filter(countable).reduce((sum, s) => sum + s.amountMinor, 0);
  const queuedMinor = queued.filter(countable).reduce((sum, s) => sum + s.amountMinor, 0);

  const foreign = [...new Set(
    [...committed, ...queued].filter(hasCost).filter((s) => !s.uncountable && s.currency !== currency)
      .map((s) => s.currency ?? '(no currency stated)'),
  )].sort();
  if (foreign.length) notes.push(`spend in ${foreign.join(', ')}`);

  const unreadable = [...committed, ...queued].filter((s) => s.uncountable === 'unreadable-price').length;
  if (unreadable) {
    notes.push(`${unreadable} action${unreadable === 1 ? '' : 's'} stating a cost the studio cannot read`);
  }

  const undated = committed.filter((s) => hasCost(s) && spendInstant(s.at, now) === null).length;
  if (undated && period !== 'all-time') {
    notes.push(`${undated} action${undated === 1 ? '' : 's'} with no usable date, counted in every period`);
  }

  return { reportedMinor, queuedMinor, notes };
}

/**
 * What the studio can say about a department's budget, given the spend a venture reports.
 *
 * `pendingMinor` is the proposal on the table — the founder needs to see what approving it would do
 * to the figure, which is the whole reason this appears on an approval card.
 */
export function disclose(
  envelope: Envelope,
  spends: Spend[],
  now: Date,
  pendingMinor = 0,
  excludeId?: string,
): BudgetDisclosure {
  const { department, limitMinor, currency, period } = envelope;
  const { reportedMinor, queuedMinor, notes } = tally(spends, department, currency, period, now, excludeId);
  const withPending = reportedMinor + Math.max(0, pendingMinor);
  return {
    department,
    limitMinor,
    currency,
    period,
    reportedMinor: withPending,
    queuedMinor,
    notes,
    overLimit: withPending + queuedMinor > limitMinor,
  };
}

/**
 * The founder-facing sentence. ONE string owner — the view adds no prefix of its own, which is how
 * "Budget no budget set" happened.
 */
export function describe(d: BudgetDisclosure | null, departmentName: string): string {
  if (!d) return `No budget set for ${departmentName}.`;
  const limit = `${formatMoney(d.limitMinor, d.currency)} ${periodLabel(d.period)}`;
  const queued = d.queuedMinor > 0
    ? `, ${formatMoney(d.queuedMinor, d.currency)} more awaiting your OK`
    : '';
  const share = d.limitMinor > 0
    ? ` — ${pct(d.reportedMinor + d.queuedMinor, d.limitMinor)}% of the limit`
    : '';
  const notes = d.notes.length ? ` Not counted: ${d.notes.join('; ')}.` : '';
  return `Limit ${limit}. The venture reports ${formatMoney(d.reportedMinor, d.currency)} spent${queued}${share}.${notes}`;
}

/**
 * The board's per-department disclosure. A pure function so it is unit-testable — the previous
 * version lived inline in an async server component and was reachable only through Playwright.
 */
export function departmentBudgets(
  departmentIds: string[],
  envelopes: Envelope[],
  spends: Spend[],
  now: Date,
): { budgets: (BudgetDisclosure | null)[]; orphanEnvelopes: string[] } {
  const declared = new Set(departmentIds);
  return {
    budgets: departmentIds.map((id) => {
      const envelope = envelopes.find((e) => e.department === id);
      return envelope ? disclose(envelope, spends, now) : null;
    }),
    // A limit keyed to a department the venture does not declare enforces nothing while looking
    // configured.
    orphanEnvelopes: envelopes.filter((e) => !declared.has(e.department)).map((e) => e.department),
  };
}
