/**
 * Meta ads, read-only (FB-248).
 *
 * ## What this is
 *
 * John ruled Meta first (FB-248, 2026-10-01): it is the one ad platform with an official AI connector
 * (`mcp.facebook.com/ads`, in beta, behind Meta Business sign-in) that can both report and spend.
 * This module is the **reporting half only**: it turns what Meta says about an ad account into what a
 * founder needs to read — what is running, what it cost, and what it returned.
 *
 * ## What this deliberately is not
 *
 * There is no write path here and there must not be one. Creating or changing a campaign spends
 * money, which is an external action (CLAUDE.md #4) and a dual-approve one under D7. That path waits
 * for FB-171 to confirm the approval gate is real, and when it comes the lane drafts a proposal and
 * the gated executor makes the call. Nothing in this file holds, asks for, or knows about a
 * credential.
 *
 * ## Why the input is Meta's own shape
 *
 * No venture has a Meta ad account yet, so nothing can be read. Rather than invent a tidy shape and
 * discover later that Meta's is different, the input here is Meta's Marketing API reporting shape —
 * the one its connector reports from: an ad account with a currency, a list of campaigns with an
 * `effective_status` and budgets in minor units as **strings**, and insight rows with `spend` as a
 * **decimal string** in the account's currency and results buried in an `actions` list. The
 * example in `meta-ads-example.json` is that shape. The connector's exact tool output still has to
 * be checked against this the day an account exists; that is written into the ticket.
 *
 * ## The rules it keeps, which are the studio's rules everywhere else
 *
 * - **Money is integer minor units.** Meta sends `"123.45"`. Parsing that as a float and multiplying
 *   by 100 is how a budget drifts by a penny. It is split as text.
 * - **An unreadable figure is named, never counted as zero** (lib/budgets.ts, FB-054).
 * - **A short read is said out loud.** Meta pages its answers. A report built on the first page and
 *   presented as the whole account is the GitHub contents-API failure again (every ARCA screen froze
 *   on 31 August because a list stopped at a thousand and nothing said so).
 * - **Results are never added across kinds.** Twelve sign-ups and three hundred clicks are not 312
 *   of anything.
 */

/** The connector name a department declares to say "our ads are on Meta" (venture-as-config, #5). */
export const META_ADS_CONNECTOR = 'meta-ads';

// --- Meta's shape, as it arrives -----------------------------------------------------------------

/** Meta pages every list. `next` is present when there is more than this page. */
export interface MetaPaging {
  cursors?: { before?: string; after?: string };
  next?: string;
}

export interface MetaCampaign {
  id: string;
  name?: string;
  objective?: string;
  effective_status?: string;
  /** Minor units, as a string. Absent when the budget is set on each ad set instead. */
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  campaign_id: string;
  campaign_name?: string;
  /** Major units, as a decimal string, in the account's currency. */
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: MetaAction[];
  /** Money each action was worth — Meta reports purchase value here. */
  action_values?: MetaAction[];
  date_start?: string;
  date_stop?: string;
}

export interface MetaAdsRaw {
  account: { id: string; name?: string; currency?: string; timezone_name?: string };
  campaigns: { data: MetaCampaign[]; paging?: MetaPaging };
  insights: { data: MetaInsightRow[]; paging?: MetaPaging };
}

// --- what a founder reads ------------------------------------------------------------------------

export type CampaignStatus = 'running' | 'ended' | 'paused' | 'stopped' | 'in-review' | 'problem' | 'unknown';

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  running: 'Running',
  ended: 'Ended',
  paused: 'Paused',
  stopped: 'Stopped',
  'in-review': 'Waiting for Meta’s review',
  problem: 'Meta has flagged a problem',
  unknown: 'Status not recognised',
};

/** The kinds of result the studio can name. One per campaign, chosen by what the campaign is for. */
export type ResultKind = 'sign-up' | 'click' | 'purchase' | 'interaction' | 'app-install' | 'person-reached';

const RESULT_WORDS: Record<ResultKind, [string, string]> = {
  'sign-up': ['sign-up', 'sign-ups'],
  click: ['click to the site', 'clicks to the site'],
  purchase: ['purchase', 'purchases'],
  interaction: ['interaction', 'interactions'],
  'app-install': ['app install', 'app installs'],
  'person-reached': ['person reached', 'people reached'],
};

/** "12 sign-ups", "1 purchase". */
export function describeResult(kind: ResultKind, count: number): string {
  const [one, many] = RESULT_WORDS[kind];
  return `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;
}

export interface CampaignLine {
  id: string;
  name: string;
  status: CampaignStatus;
  /** Spend in the period, in minor units. Null when Meta's figure could not be read. */
  spendMinor: number | null;
  /** False when Meta has no reporting row for it in the period: it showed to nobody. */
  delivered: boolean;
  /** What it returned. Null when its purpose is one the studio does not read, or nothing came back. */
  result: { kind: ResultKind; count: number } | null;
  /** Spend ÷ results, minor units. Null whenever either side is missing or zero. */
  costPerResultMinor: number | null;
  /** Sales value Meta credits to it, minor units. Only for a sales campaign that reports one. */
  salesMinor: number | null;
  budget: { per: 'day' | 'total'; minor: number } | null;
}

export interface AdsReport {
  accountName: string | null;
  currency: string;
  /** The reporting window, as Meta stated it. Null when no row carried dates. */
  period: { start: string; end: string } | null;
  campaigns: CampaignLine[];
  totals: {
    /** Only what could be read. Anything that could not is in `notes`, not in this. */
    spendMinor: number;
    running: number;
    campaigns: number;
    /** One entry per kind, never summed across kinds. */
    results: { kind: ResultKind; count: number }[];
  };
  /** Caveats in a founder's words: a short read, a figure that could not be read. */
  notes: string[];
}

// --- reading it ----------------------------------------------------------------------------------

/** How many digits after the point a currency uses. GBP 2, JPY 0. Falls back to 2. */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * `"123.45"` → 12345, as text, never through a float.
 *
 * More decimal places than the currency uses are rounded half-up on the integer. Anything that is not
 * a plain non-negative decimal is null — the caller names it rather than counting it as nothing.
 */
export function decimalToMinor(value: string | undefined, digits: number): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return null;
  const whole = m[1];
  const frac = m[2] ?? '';
  const kept = frac.slice(0, digits).padEnd(digits, '0');
  let minor = Number(whole + kept);
  if (frac.length > digits && Number(frac[digits]) >= 5) minor += 1;
  return Number.isSafeInteger(minor) ? minor : null;
}

function count(value: string | undefined): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function minorString(value: string | undefined): number | null {
  // Budgets arrive already in minor units ("2000" is £20.00). "0" means not set at this level.
  const n = count(value);
  return n && n > 0 ? n : null;
}

const STATUS_OF: Record<string, CampaignStatus> = {
  ACTIVE: 'running',
  PAUSED: 'paused',
  CAMPAIGN_PAUSED: 'paused',
  ADSET_PAUSED: 'paused',
  ARCHIVED: 'stopped',
  DELETED: 'stopped',
  IN_PROCESS: 'in-review',
  PENDING_REVIEW: 'in-review',
  WITH_ISSUES: 'problem',
  DISAPPROVED: 'problem',
  PENDING_BILLING_INFO: 'problem',
};

/** Meta keeps a campaign ACTIVE after its end date; it has stopped spending, so it says Ended. */
export function campaignStatus(c: Pick<MetaCampaign, 'effective_status' | 'stop_time'>, now: Date): CampaignStatus {
  const raw = (c.effective_status ?? '').toUpperCase();
  const status = Object.hasOwn(STATUS_OF, raw) ? STATUS_OF[raw] : 'unknown';
  if (status === 'running' && c.stop_time) {
    const stop = Date.parse(c.stop_time);
    if (Number.isFinite(stop) && stop <= now.getTime()) return 'ended';
  }
  return status;
}

/**
 * What a campaign counts as a result, by what it was set up to do.
 *
 * Order within a list is preference, and only ONE type is taken. Meta's `lead` is already the total
 * of pixel and on-Facebook leads; adding `offsite_conversion.fb_pixel_lead` to it would count the
 * same person twice. The older objective names (before Meta's 2022 rename) are kept because old
 * campaigns still carry them.
 */
const RESULT_RULES: { objectives: string[]; kind: ResultKind; actions: string[] | 'reach' }[] = [
  {
    objectives: ['OUTCOME_LEADS', 'LEAD_GENERATION'],
    kind: 'sign-up',
    actions: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'complete_registration'],
  },
  {
    objectives: ['OUTCOME_SALES', 'CONVERSIONS', 'PRODUCT_CATALOG_SALES'],
    kind: 'purchase',
    actions: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'],
  },
  { objectives: ['OUTCOME_TRAFFIC', 'LINK_CLICKS'], kind: 'click', actions: ['link_click'] },
  { objectives: ['OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT'], kind: 'interaction', actions: ['post_engagement'] },
  { objectives: ['OUTCOME_APP_PROMOTION', 'APP_INSTALLS'], kind: 'app-install', actions: ['mobile_app_install'] },
  { objectives: ['OUTCOME_AWARENESS', 'REACH', 'BRAND_AWARENESS'], kind: 'person-reached', actions: 'reach' },
];

function resultOf(
  objective: string | undefined,
  row: MetaInsightRow | undefined,
  digits: number,
): { result: CampaignLine['result']; salesMinor: number | null } {
  const rule = RESULT_RULES.find((r) => r.objectives.includes((objective ?? '').toUpperCase()));
  if (!rule || !row) return { result: null, salesMinor: null };
  if (rule.actions === 'reach') {
    const n = count(row.reach);
    return { result: n === null ? null : { kind: rule.kind, count: n }, salesMinor: null };
  }
  for (const type of rule.actions) {
    const hit = row.actions?.find((a) => a.action_type === type);
    const n = count(hit?.value);
    if (n === null) continue;
    const value = rule.kind === 'purchase' ? row.action_values?.find((a) => a.action_type === type) : undefined;
    return { result: { kind: rule.kind, count: n }, salesMinor: value ? decimalToMinor(value.value, digits) : null };
  }
  // Set up for this, and nothing of this kind came back. Zero is a real answer here: Meta reported
  // the row and the row has none.
  return { result: { kind: rule.kind, count: 0 }, salesMinor: null };
}

const ORDER: CampaignStatus[] = ['problem', 'in-review', 'running', 'unknown', 'paused', 'ended', 'stopped'];

/**
 * Meta's account, campaigns and insight rows → one report a founder can read.
 *
 * Campaigns are joined to their insight row by id. A campaign with no row showed to nobody in the
 * period; a row with no campaign is one that was deleted since, and is still money that went out, so
 * it is kept. Problems first (they need someone), then what is running, then by money.
 */
export function readAdsReport(raw: MetaAdsRaw, now: Date = new Date()): AdsReport {
  const currency = (raw.account.currency ?? '').toUpperCase() || 'GBP';
  const digits = currencyDigits(currency);
  const notes: string[] = [];
  if (!raw.account.currency) notes.push('Meta did not say which currency this account uses, so pounds are assumed.');

  const rows = new Map<string, MetaInsightRow>();
  for (const r of raw.insights.data) rows.set(r.campaign_id, r);

  const lines: CampaignLine[] = [];
  const seen = new Set<string>();
  const unreadable: string[] = [];

  const line = (c: MetaCampaign | null, row: MetaInsightRow | undefined): CampaignLine => {
    const id = c?.id ?? row!.campaign_id;
    const name = c?.name ?? row?.campaign_name ?? `Campaign ${id}`;
    const spendMinor = row ? decimalToMinor(row.spend ?? '0', digits) : 0;
    if (spendMinor === null) unreadable.push(name);
    const { result, salesMinor } = resultOf(c?.objective, row, digits);
    const daily = minorString(c?.daily_budget);
    const lifetime = minorString(c?.lifetime_budget);
    return {
      id,
      name,
      // A row with no campaign behind it: the campaign was deleted after it spent.
      status: c ? campaignStatus(c, now) : 'stopped',
      spendMinor,
      delivered: Boolean(row),
      result,
      // Not for reach: a penny "each" per person shown an ad is a meaningless number, and Meta itself
      // prices reach per thousand. The people-reached count is the figure worth reading there.
      costPerResultMinor:
        result && result.kind !== 'person-reached' && result.count > 0 && spendMinor !== null && spendMinor > 0
          ? Math.round(spendMinor / result.count)
          : null,
      salesMinor,
      budget: daily ? { per: 'day', minor: daily } : lifetime ? { per: 'total', minor: lifetime } : null,
    };
  };

  for (const c of raw.campaigns.data) {
    if (!c || typeof c.id !== 'string' || seen.has(c.id)) continue;
    seen.add(c.id);
    lines.push(line(c, rows.get(c.id)));
  }
  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      seen.add(id);
      lines.push(line(null, row));
    }
  }

  lines.sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (b.spendMinor ?? 0) - (a.spendMinor ?? 0),
  );

  if (unreadable.length > 0) {
    notes.push(
      `Meta’s spend figure for ${unreadable.join(', ')} could not be read, so it is left out of the total rather than counted as nothing.`,
    );
  }
  // Either list being cut short makes every total on the page a part-total.
  if (raw.campaigns.paging?.next || raw.insights.paging?.next) {
    notes.push(
      `Meta has more to report than the studio read. These ${lines.length} campaigns are only part of the account, and the totals cover only them.`,
    );
  }
  const unknown = lines.filter((l) => l.status === 'unknown').map((l) => l.name);
  if (unknown.length > 0) {
    notes.push(`Meta gave a status the studio does not recognise for ${unknown.join(', ')}. Check it in Meta before relying on it.`);
  }

  const results = new Map<ResultKind, number>();
  for (const l of lines) if (l.result) results.set(l.result.kind, (results.get(l.result.kind) ?? 0) + l.result.count);

  const dates = raw.insights.data.flatMap((r) => [r.date_start, r.date_stop]).filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  dates.sort();

  return {
    accountName: raw.account.name ?? null,
    currency,
    period: dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null,
    campaigns: lines,
    totals: {
      spendMinor: lines.reduce((sum, l) => sum + (l.spendMinor ?? 0), 0),
      running: lines.filter((l) => l.status === 'running').length,
      campaigns: lines.length,
      results: [...results.entries()].filter(([, n]) => n > 0).map(([kind, n]) => ({ kind, count: n })),
    },
    notes,
  };
}

/** Money as a founder reads it, in the account's own currency: "£1,234.50", "¥5,000". */
export function formatAdsMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  const major = minor / 10 ** digits;
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(major) ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency}`;
  }
}

/** "1 Sep – 30 Sep 2026". */
export function describePeriod(period: { start: string; end: string }): string {
  const fmt = (d: string, withYear: boolean) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    });
  const sameYear = period.start.slice(0, 4) === period.end.slice(0, 4);
  return `${fmt(period.start, !sameYear)} – ${fmt(period.end, true)}`;
}

// --- whether there is anything to read -----------------------------------------------------------

/**
 * Whether this venture's ads can be read, from what its setup declares.
 *
 * - `not-chosen`: no department declares Meta. The venture has not picked an ad platform.
 * - `not-connected`: a department declares Meta, but no account is linked. **Every venture is here
 *   today** — the connector itself is not built, because there is no account to build it against.
 *
 * There is no `connected` state yet on purpose. Adding one before a real account has been read would
 * be a state nobody has ever seen, which is how a screen comes to show something untrue.
 */
export type AdsConnection =
  | { state: 'not-chosen' }
  | { state: 'not-connected'; departmentId: string; departmentName: string };

export function adsConnection(departments: { id: string; name: string; connectors: string[] }[]): AdsConnection {
  const d = departments.find((x) => x.connectors.includes(META_ADS_CONNECTOR));
  return d ? { state: 'not-connected', departmentId: d.id, departmentName: d.name } : { state: 'not-chosen' };
}
