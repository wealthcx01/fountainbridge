/**
 * The admin ledger (FB-136) — every venture on one screen, coloured by whose attention it needs.
 *
 * Every other screen in the redesign is for a founder. This one is for the person running the
 * portfolio, and its question is narrow: **where is a venture stuck, and is it stuck on its founder
 * or on its engine?** The design states the whole rule in a sentence — *"a row is amber when its
 * founder is the bottleneck, red when its engine is"* — and this module is that sentence, made
 * testable.
 *
 * Pure, with the numbers injected, like every other read model here: the colouring rules can be
 * argued about in a unit test rather than in a browser.
 *
 * ## Why a row can be neither
 *
 * Two states the design does not name and the studio cannot do without. A venture whose reads FAILED
 * is not calm — it is unknown, and painting it green would be the studio reporting health it never
 * checked (CLAUDE.md #10). And a venture that is genuinely quiet — nothing waiting, nothing moving —
 * is idle, which is a fact about the venture rather than a fault in it.
 */

import type { EngineState } from './runreports';
import { waitingOnFounder } from './desk';

/** The spend figure a row shows, when the departments agree well enough to add one up. */
export interface LedgerSpend {
  spentMinor: number;
  limitMinor: number;
  currency: string;
  /** True when reported + queued exceeds the limit on any department. */
  over: boolean;
}

export interface LedgerRow {
  ventureId: string;
  name: string;
  status: string;
  founderName: string | null;
  founderEmail: string | null;
  /**
   * What waits on this founder — open work plus external actions at the gate.
   *
   * The SAME `waitingOnFounder` the founder's own desk counts. Two surfaces answering "how much is
   * waiting?" from different arithmetic is the FB-099 defect, and doing it across ventures would put
   * a number in front of Bruntsfield that the founder's own screen contradicts.
   *
   * `null` when it could not be read — never 0, which is a claim that nothing waits.
   */
  needsThem: number | null;
  /** Tickets the team is actually on. `null` when unread. A filed ticket is not work in progress. */
  underway: number | null;
  /**
   * What the venture's team is doing, in the engine's own words — or `null` when that read failed.
   *
   * `null` and `EngineState.unknown` are different facts and the first draft of this collapsed them.
   * "Unknown" is the engine reporting that it has never run here — a sentence a founder needs, and
   * one the studio owns. `null` is the studio not having read anything, which is a dash.
   */
  engine: { state: EngineState; text: string } | null;
  /** `null` when no department declares an envelope, or when they cannot be added up. */
  spend: LedgerSpend | null;
  /** True when any read behind this row failed. The row says so rather than showing a partial truth. */
  degraded: boolean;
}

/**
 * What colour a row is, and therefore whose problem it is.
 *
 * Order matters and is the argument:
 *
 * 1. `unknown` — a read failed. Nothing else on the row can be trusted, including its calm.
 * 2. `blocked` (red) — the engine has stopped, or the venture is over its own budget. Nobody can act
 *    their way out of either; they need fixing.
 * 3. `attention` (amber) — the founder is the bottleneck. Something waits on a person.
 * 4. `ok` — work is moving.
 * 5. `idle` — nothing waiting, nothing moving. A fact, not a fault.
 *
 * Red before amber, deliberately: a stopped engine with six decisions queued behind it is not a
 * founder who is slow, it is a venture that cannot proceed even if they decide.
 */
export type LedgerTone = 'unknown' | 'blocked' | 'attention' | 'ok' | 'idle';

export function rowTone(row: LedgerRow): LedgerTone {
  if (row.degraded) return 'unknown';
  if (row.engine?.state === 'stalled' || row.spend?.over) return 'blocked';
  if ((row.needsThem ?? 0) > 0) return 'attention';
  if ((row.underway ?? 0) > 0) return 'ok';
  return 'idle';
}

/**
 * The row's colour, said in words.
 *
 * The design contract's rule: state carried only by colour is state a screen-reader user does not
 * get, and every such marker needs a text twin. It is also the more useful half for a reader who can
 * see the colour — "amber" does not say which of the six decisions is the old one.
 */
export function rowReason(row: LedgerRow): string {
  const tone = rowTone(row);
  switch (tone) {
    case 'unknown':
      return 'Some of this venture’s records could not be read, so these numbers are incomplete.';
    case 'blocked':
      if (row.engine?.state === 'stalled') return 'Its team has stopped — this needs fixing, not deciding.';
      return 'Spending has passed the limit this venture set.';
    case 'attention': {
      const n = row.needsThem ?? 0;
      return `${n} thing${n === 1 ? '' : 's'} waiting on ${row.founderName ?? 'its founder'}.`;
    }
    case 'ok':
      return `Its team is on ${row.underway} ticket${row.underway === 1 ? '' : 's'}.`;
    case 'idle':
      return 'Nothing waiting and nothing moving.';
    default: {
      const unhandled: never = tone;
      return unhandled;
    }
  }
}

/** Build one row from the parts the loader gathered. `null` inputs stay null; nothing defaults to 0. */
export function toRow(input: {
  venture: { id: string; name: string; status: string; founderName: string | null; founderEmail: string | null };
  openWork: number | null;
  awaitingApproval: number | null;
  underway: number | null;
  engine: { state: EngineState; text: string } | null;
  budgets: ReadonlyArray<{ limitMinor: number; currency: string; reportedMinor: number; queuedMinor: number; overLimit: boolean } | null>;
  degraded: boolean;
}): LedgerRow {
  const { venture, openWork, awaitingApproval } = input;
  const needsThem =
    openWork === null || awaitingApproval === null
      ? null
      : waitingOnFounder({ openWork, awaitingApproval });
  return {
    ventureId: venture.id,
    name: venture.name,
    status: venture.status,
    founderName: venture.founderName,
    founderEmail: venture.founderEmail,
    needsThem,
    underway: input.underway,
    engine: input.engine,
    spend: totalSpend(input.budgets),
    degraded: input.degraded,
  };
}

/**
 * One spend figure for a venture, or none.
 *
 * `lib/budgets.ts` refuses to add spend across currencies per department, and this must not undo
 * that one level up: a venture with a GBP Build envelope and a USD Sell envelope would get their
 * arithmetic total, formatted in GBP — a number wrong in both. Periods too. When the departments
 * disagree, the column is empty rather than wrong. The same rule the desk's summary sentence applies.
 */
export function totalSpend(
  budgets: ReadonlyArray<{ limitMinor: number; currency: string; reportedMinor: number; queuedMinor: number; overLimit: boolean } | null>,
): LedgerSpend | null {
  const declared = budgets.filter((b): b is NonNullable<typeof b> => b !== null && b.limitMinor > 0);
  if (declared.length === 0) return null;
  if (!declared.every((b) => b.currency === declared[0].currency)) return null;
  return {
    spentMinor: declared.reduce((n, b) => n + b.reportedMinor + b.queuedMinor, 0),
    limitMinor: declared.reduce((n, b) => n + b.limitMinor, 0),
    currency: declared[0].currency,
    over: declared.some((b) => b.overLimit),
  };
}

/**
 * The sentence over the ledger, counted from the rows on the screen.
 *
 * Never from a different list than the one below it — that is the FB-149 badge/destination
 * disagreement, and here it would be Bruntsfield's whole picture of the portfolio.
 */
export function ledgerSummary(rows: readonly LedgerRow[]): string {
  if (rows.length === 0) return 'No ventures yet.';
  const by = (t: LedgerTone) => rows.filter((r) => rowTone(r) === t).length;
  const parts: string[] = [];
  const stopped = by('blocked');
  const waiting = by('attention');
  const unknown = by('unknown');
  if (stopped) parts.push(`${stopped} need${stopped === 1 ? 's' : ''} fixing`);
  if (waiting) parts.push(`${waiting} waiting on ${waiting === 1 ? 'its founder' : 'their founders'}`);
  if (unknown) parts.push(`${unknown} could not be read`);
  const head = `${rows.length} venture${rows.length === 1 ? '' : 's'}`;
  return parts.length ? `${head}: ${parts.join(', ')}.` : `${head}, and nothing is stuck.`;
}

/**
 * How long the things waiting on founders have been waiting, right now.
 *
 * **Not response time.** The design asks for "median from needs-you to decided", and the studio does
 * not record when something *started* needing a founder — an approval carries when it was granted,
 * never when it was proposed, and a decided pull request keeps no trace of how long it sat. So this
 * is the statistic that IS knowable, named for what it actually measures.
 *
 * Recording the other half is FB-159. Until then, a median labelled "response time" would be a number
 * about founders that nobody measured, on the one screen Bruntsfield uses to judge them.
 */
export function waitingNow(agesMs: readonly number[]): { count: number; medianMs: number } | null {
  const ages = agesMs.filter((a) => Number.isFinite(a) && a >= 0).sort((a, b) => a - b);
  if (ages.length === 0) return null;
  return { count: ages.length, medianMs: ages[Math.floor(ages.length / 2)] };
}

/**
 * Which ventures a new founder could be provisioned from.
 *
 * The design's footnote names one — *"The Arca account is the template"* — which is a decision
 * somebody made, not a fact in any manifest. Rather than hard-code a venture into the studio core
 * (CLAUDE.md #5) or invent a designation, this reports what is derivable: a venture is a usable
 * pattern when it has a founder account, a box, and its engine key set. Naming the ones that qualify
 * answers the same question without asserting a choice nobody recorded.
 */
export function provisioningPatterns(
  ventures: ReadonlyArray<{ id: string; name: string; founderEmail: string | null; vpsHost: string | null }>,
  ready: ReadonlyArray<{ id: string; ready: boolean }>,
): string[] {
  const isReady = new Set(ready.filter((r) => r.ready).map((r) => r.id));
  return ventures
    .filter((v) => v.founderEmail && v.vpsHost && isReady.has(v.id))
    .map((v) => v.name);
}
