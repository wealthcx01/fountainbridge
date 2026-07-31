/**
 * Department budget envelopes (FB-054) — applying meridian's `Company.budgets`.
 *
 * Each of a venture's departments (Build / Sell / Scale, FB-048) carries a spend envelope the
 * founder sets. When an external action that costs money reaches the gate, the studio computes what
 * it would do to that department's envelope and shows it as a policy check on the approval card —
 * so the founder sees the budget impact at the moment they decide, not in a bill afterwards.
 *
 * Three decisions, each of which a 10-specialist review proved was NOT optional:
 *
 * 1. **Envelopes live in the STUDIO repo, not the venture's.** The first cut put `budgets.json` on
 *    the venture's `foundry-approvals` ref — the same ref the proposing lane writes proposals to.
 *    A lane with repo-write could raise its own limit, switch the currency, or delete its
 *    department's entry to remove the check entirely. `grant.json` on that ref is HMAC-protected
 *    precisely because the executor's own header says "the lane can write ANY file… authority
 *    CANNOT rest on file contents"; the spending limits had no equivalent. They now sit beside the
 *    venture manifests in `ventures/budgets/<id>.yaml`, which venture lanes cannot write and which
 *    changes only through this repo's own PR + CI gate.
 *
 * 2. **The check is computed here, never read from the proposal.** FB-044's `checks[]` are written
 *    by the lane proposing the action — the proposer marking its own homework. The studio holds the
 *    live total, so the studio computes the check.
 *
 * 3. **Money is integer minor units, never floats**, and every agent-supplied input is validated or
 *    the check FAILS CLOSED. A gate is only as trustworthy as its least-protected input: an
 *    unreadable price, an unknown department or an unstated currency must produce a check that does
 *    not pass, never a check that silently vanishes. The first cut omitted the check in all three
 *    cases, so a £5,200 send with a malformed price rendered as a free action.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import type { PolicyCheck } from './approvals';

/** Fraction of the envelope at which a department is "nearing" its limit and worth flagging. */
export const NEARING_THRESHOLD = 0.8;

export interface Envelope {
  /** Department id this envelope governs (matches DepartmentSummary.id). */
  department: string;
  /** The limit in minor units (pence for GBP). */
  limitMinor: number;
  currency: string;
  /** The window spend is summed over. ENFORCED — see `withinPeriod`. */
  period: Period;
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
  /** Currencies with committed spend that could not be counted against this envelope. */
  uncountedCurrencies: string[];
  /**
   * The state if everything currently queued for this department were approved.
   *
   * The board's job is to flag a department AT RISK, and a department sitting at 83% with £5,200
   * waiting on the founder is at risk — reporting only committed spend would leave the ticket's own
   * flagging criterion unmet. The committed figure stays primary in `state`; this is what the
   * warning marker escalates on.
   */
  projectedState: EnvelopeState;
}

/** Anything with a department and a cost — the shape both approvals and test fixtures satisfy. */
export interface Spend {
  department: string | null;
  amountMinor: number;
  currency?: string | null;
  /** Only committed statuses count toward spend; see `committedSpend`. */
  status: string;
  /**
   * When this spend was committed (ISO-8601), from the grant/execution record. Null when the record
   * carries no timestamp — v0 did not require one. An undated spend counts in EVERY window rather
   * than none: dropping it would understate the total, and understating a budget is the direction
   * that hurts.
   */
  at?: string | null;
}

/** The committed statuses. Shared so `committedSpend` and `mismatchedCurrencies` cannot drift. */
const COMMITTED = new Set(['granted', 'executing', 'executed']);
const isCommitted = (s: Spend) => COMMITTED.has(s.status);

/** The start of the envelope's current window. `all-time` has none. */
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

/**
 * Is this spend inside the envelope's window?
 *
 * The first cut summed spend over ALL TIME while displaying "% of £4,800 per month". A venture
 * spending exactly on budget therefore read 100% in month 1 and 1200% in month 12, at which point
 * every priced action is permanently "over" and the one genuine runaway is indistinguishable from
 * twelve routine sends. The label was not merely unenforced — it made the number a lie that grew.
 */
export function withinPeriod(spend: Spend, period: Period, now: Date): boolean {
  const start = periodStart(period, now);
  if (!start) return true;
  if (!spend.at) return true; // undated: count it rather than understate the total
  const at = Date.parse(spend.at);
  return !Number.isFinite(at) || at >= start.getTime();
}

/** How the founder should read the window in a sentence. */
export function periodLabel(period: Period): string {
  switch (period) {
    case 'monthly': return 'this month';
    case 'quarterly': return 'this quarter';
    case 'yearly': return 'this year';
    case 'all-time': return 'all time';
  }
}

/** ISO-4217-shaped: three uppercase letters. Anything else is not a currency we will do maths on. */
const CURRENCY_RE = /^[A-Z]{3}$/;

/** Normalise an agent- or founder-supplied currency. Returns null when it is not usable. */
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return CURRENCY_RE.test(upper) ? upper : null;
}

/**
 * The result of reading a venture's envelopes.
 *
 * `error` is the difference between "this venture has set no budgets" and "the budgets file is
 * there but we could not read it". The first cut collapsed both to an empty list, so a corrupt or
 * truncated file turned the money gate off with nothing on any screen to say so — the silent
 * failure non-negotiable 10 exists to prevent.
 */
export interface EnvelopeSet {
  envelopes: Envelope[];
  error: string | null;
}

/**
 * Parse a venture's budgets document.
 *
 * Expected shape (`ventures/budgets/<id>.yaml`):
 *   currency: GBP
 *   period: monthly          # monthly | quarterly | yearly | all-time
 *   departments:
 *     sell: 480000           # integer MINOR units
 */
export function parseEnvelopes(raw: unknown): EnvelopeSet {
  if (raw === null || raw === undefined) return { envelopes: [], error: null };
  if (typeof raw !== 'object') return { envelopes: [], error: 'the budgets file is not a mapping' };

  const doc = raw as { currency?: unknown; period?: unknown; departments?: unknown };
  const currency = normalizeCurrency(doc.currency) ?? 'GBP';
  if (doc.currency !== undefined && normalizeCurrency(doc.currency) === null) {
    return { envelopes: [], error: `"${String(doc.currency)}" is not a currency code` };
  }
  const period = parsePeriod(doc.period);
  if (doc.period !== undefined && period === null) {
    return { envelopes: [], error: `"${String(doc.period)}" is not a period (monthly|quarterly|yearly|all-time)` };
  }

  const depts = doc.departments;
  if (depts === undefined) return { envelopes: [], error: null };
  if (!depts || typeof depts !== 'object') return { envelopes: [], error: 'departments is not a mapping' };

  const out: Envelope[] = [];
  const rejected: string[] = [];
  for (const [department, value] of Object.entries(depts as Record<string, unknown>)) {
    // A limit must be a non-negative integer of MINOR units. A float means someone wrote pounds
    // where pence were expected; accepting it would misprice the gate by 100x. Rejecting silently
    // was the first cut's mistake — the department then rendered identically to having no budget,
    // so a fat-fingered limit looked like a deliberate absence.
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      rejected.push(department);
      continue;
    }
    out.push({ department, limitMinor: value, currency, period: period ?? 'monthly' });
  }

  return {
    envelopes: out.sort((a, b) => a.department.localeCompare(b.department)),
    error: rejected.length
      ? `limit for ${rejected.join(', ')} is not a whole number of minor units (pence, not pounds)`
      : null,
  };
}

export type Period = 'monthly' | 'quarterly' | 'yearly' | 'all-time';

export function parsePeriod(raw: unknown): Period | null {
  if (raw === undefined || raw === null) return 'monthly';
  const v = String(raw).trim().toLowerCase();
  return v === 'monthly' || v === 'quarterly' || v === 'yearly' || v === 'all-time' ? v : null;
}

// A SUBDIRECTORY, not `ventures/budgets/<id>.yaml`: the manifest validator globs `ventures/*.yaml`
// and `loadVentures` reads the same directory, so a budgets file sitting beside the manifests was
// parsed as a (malformed) Venture by both.
const BUDGETS_DIR = join(process.cwd(), 'ventures', 'budgets');

/**
 * Load a venture's envelopes from THE STUDIO REPO — `ventures/budgets/<id>.yaml`, beside the
 * manifests. Venture lanes have no write access here, which is the entire point: the limits that
 * police an agent's spending must not be writable by that agent.
 *
 * A missing file is the normal case (no budgets configured). An unreadable one is reported, never
 * swallowed into "no budgets".
 */
export function loadEnvelopes(ventureId: string, dir = BUDGETS_DIR): EnvelopeSet {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(ventureId)) return { envelopes: [], error: null };
  let text: string;
  try {
    text = readFileSync(join(dir, `${ventureId}.yaml`), 'utf8');
  } catch {
    return { envelopes: [], error: null }; // no budgets set for this venture
  }
  try {
    return parseEnvelopes(yaml.load(text));
  } catch (err) {
    return { envelopes: [], error: `the budgets file could not be read (${(err as Error).message})` };
  }
}

/**
 * Spend that counts against an envelope: everything a human has already waved through, plus what is
 * mid-flight. `proposed` is excluded — it has not been approved, and counting it would let an
 * unapproved (or never-to-be-approved) proposal squeeze out real work.
 */
export function committedSpend(
  spends: Spend[],
  department: string,
  currency: string | undefined,
  period: Period,
  now: Date,
): number {
  return spends
    .filter((s) => s.department === department)
    .filter(isCommitted)
    .filter((s) => withinPeriod(s, period, now))
    // Minor units are only comparable within one currency. Adding $4,000 to a £4,800 envelope as if
    // it were £4,000 is a silent 100%+ mispricing of a MONEY gate. An UNSTATED currency is equally
    // uncountable — the first cut counted it as the envelope's, which is how a $10,000 send with no
    // currency field rendered as "208% of £4,800". Both are excluded here and both are named by
    // `mismatchedCurrencies`, so they are visible rather than ignored or wrongly counted.
    .filter((s) => !currency || s.currency === currency)
    .reduce((sum, s) => sum + (Number.isFinite(s.amountMinor) ? s.amountMinor : 0), 0);
}

/**
 * Spend in this department that could NOT be counted because it is in another currency.
 *
 * Converting would need an exchange rate and a rate date, which is a real feature (and a compliance
 * question) rather than something to guess at inside a read model. So the honest answer is to count
 * what is comparable and tell the founder plainly what was left out.
 */
export function mismatchedCurrencies(
  spends: Spend[],
  department: string,
  currency: string,
  period: Period,
  now: Date,
): string[] {
  const found = spends
    .filter((s) => s.department === department)
    .filter(isCommitted)
    .filter((s) => withinPeriod(s, period, now))
    .map((s) => s.currency);
  // An unstated currency on committed spend is ALSO uncountable — it was previously dropped from
  // both the total and the caveat, so it vanished entirely.
  const out = found.filter((c) => c !== currency).map((c) => c ?? '(unstated)');
  return [...new Set(out)].sort();
}

/** Format minor units as a founder-facing amount: 480000 + GBP → "£4,800". */
export function formatMoney(minor: number, currency: string): string {
  // Object.hasOwn, not a bare lookup: a currency of "constructor" or "toString" walks the prototype
  // chain and returns an inherited function, which `?? ''` does not catch — verified to render
  // `function Object() { [native code] }4,800` on the founder's card.
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  const symbol = Object.hasOwn(symbols, currency) ? symbols[currency] : '';
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
  now: Date,
  pendingMinor = 0,
  queuedMinor = 0,
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
      uncountedCurrencies: [],
      projectedState: 'unset',
    };
  }

  const { limitMinor, currency, period } = envelope;
  const spentMinor =
    committedSpend(spends, envelope.department, currency, period, now) + Math.max(0, pendingMinor);
  const uncounted = mismatchedCurrencies(spends, envelope.department, currency, period, now);
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

  const of = `${formatMoney(limitMinor, currency)} ${periodLabel(period)}`;
  // Never hide uncounted spend. "104% of £4,800" that quietly omits $4,000 of committed spend is a
  // more dangerous number than one that admits what it could not add up.
  const caveat = uncounted.length ? ` (excludes spend in ${uncounted.join(', ')})` : '';
  // What the founder's OWN queue would do to this envelope. Ten £1,000 proposals each used to read
  // "within — 21%": committed spend excludes `proposed`, and each card only added its own amount,
  // so approving all ten spent £10,000 and no card ever said so. Sibling pending spend is the thing
  // the founder is deciding among, so it belongs on the same line.
  const queued = Math.max(0, queuedMinor);
  const ifAllApproved = queued > 0
    ? `; ${Math.round(((spentMinor + queued) / (limitMinor || 1)) * 100)}% if everything queued is approved`
    : '';
  const detail =
    state === 'over'
      ? `over — ${percent}% of ${of}${ifAllApproved}${caveat}`
      : state === 'nearing'
        ? `nearing — ${percent}% of ${of}${ifAllApproved}${caveat}`
        : `within — ${percent}% of ${of}${ifAllApproved}${caveat}`;

  const projected = spentMinor + queued;
  const projectedState: EnvelopeState =
    projected > limitMinor
      ? 'over'
      : limitMinor > 0 && projected >= limitMinor * NEARING_THRESHOLD
        ? 'nearing'
        : 'within';

  return {
    department, state, spentMinor, limitMinor, currency, percent, detail,
    uncountedCurrencies: uncounted, projectedState,
  };
}

/** Why a priced action could not be checked against its envelope. Never silently omitted. */
export type UncheckableReason =
  | 'no-price'
  | 'unreadable-price'
  | 'unknown-department'
  | 'unstated-currency'
  | 'foreign-currency';

export interface PendingSpend {
  /** Integer minor units, or null when the proposal stated no readable price. */
  amountMinor: number | null;
  /** Normalised currency, or null when unstated/unusable. */
  currency: string | null;
  /** True when the proposal DID state a price but it could not be read (float, string, negative). */
  priceUnreadable?: boolean;
}

/**
 * The policy check the founder sees on a spend approval.
 *
 * FAILS CLOSED. Every branch that cannot produce an honest number returns a check that does NOT
 * pass, saying why. The first cut returned `null` — no check at all — whenever the price was
 * missing or malformed, the department unknown, or the envelope absent, so an agent could exempt
 * its own spend by omitting one field and the card would read "✓ policy checks clear".
 *
 * `passed: false` still does not BLOCK: the founder may decide the over-budget send is right. What
 * they must not be able to do is make that call believing the spend was checked when it was not.
 */
export function envelopeCheck(
  envelope: Envelope | undefined,
  spends: Spend[],
  departmentName: string,
  pending: PendingSpend,
  now: Date,
  knownDepartment = true,
  queuedMinor = 0,
): PolicyCheck | null {
  const name = `${departmentName || 'unknown department'} budget envelope`;
  const cannot = (detail: string): PolicyCheck => ({ name, passed: false, detail });

  // A department the manifest does not declare cannot be budgeted, and an agent choosing an
  // unrecognised string was the first cut's way to opt its own spend out of the gate entirely.
  if (!knownDepartment) {
    return cannot(`cannot be checked — "${departmentName}" is not a department of this venture`);
  }
  if (pending.priceUnreadable) {
    return cannot('cannot be checked — this action states a cost the studio cannot read');
  }
  // Genuinely free actions say nothing; that is not a bypass because a stated-but-unreadable price
  // is caught above.
  if (pending.amountMinor === null || pending.amountMinor <= 0) return null;
  if (!envelope) {
    return cannot(`cannot be checked — no budget is set for ${departmentName}`);
  }
  // An unstated currency used to be treated as the envelope's, so a $10,000 send with no currency
  // field rendered as "208% of £4,800" — wrong units on the exact number being decided on.
  if (!pending.currency) {
    return cannot(`cannot be checked — this action states no currency; the envelope is in ${envelope.currency}`);
  }
  if (pending.currency !== envelope.currency) {
    return cannot(`cannot be checked — priced in ${pending.currency}, the envelope is in ${envelope.currency}`);
  }

  const status = envelopeStatus(envelope, spends, departmentName, now, pending.amountMinor, queuedMinor);
  return { name, passed: status.state !== 'over', detail: status.detail };
}
