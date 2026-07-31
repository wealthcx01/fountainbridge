import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeCurrency, parsePeriod, periodStart, periodLabel,
  withinPeriod, spendInstant, disclose, describe as describeBudget, departmentBudgets,
  formatMoney, pct, type Spend, type Envelope,
} from '../budgets';
import { parseEnvelopes, loadEnvelopes } from '../budgets-load';

const NOW = new Date('2026-07-15T12:00:00Z');
const envelope: Envelope = { department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'monthly' };
const spend = (over: Partial<Spend> = {}): Spend => ({
  department: 'sell', amountMinor: 100_000, currency: 'GBP', status: 'executed',
  at: '2026-07-10T00:00:00Z', ...over,
});

describe('limits come from the studio repo, and a broken file says so', () => {
  const dir = mkdtempSync(join(tmpdir(), 'budgets-'));

  it('loads a venture budgets file', () => {
    writeFileSync(join(dir, 'arca.yaml'), 'currency: GBP\nperiod: monthly\ndepartments:\n  sell: 480000\n');
    expect(loadEnvelopes('arca', dir)).toEqual({ envelopes: [envelope], error: null });
  });

  it('treats a MISSING file as "no budgets", but reports any other read failure', () => {
    expect(loadEnvelopes('nosuchventure', dir)).toEqual({ envelopes: [], error: null });
    // A directory where the file should be (EISDIR). Collapsing this into "no budgets" is how the
    // disclosure would switch itself off with nothing on screen.
    mkdirSync(join(dir, 'eisdir.yaml'), { recursive: true });
    expect(loadEnvelopes('eisdir', dir).error).toMatch(/could not be read/);
  });

  it('reports unparseable YAML', () => {
    writeFileSync(join(dir, 'broken.yaml'), 'currency: GBP\n  departments: {oh no\n');
    expect(loadEnvelopes('broken', dir).error).toMatch(/could not be read/);
  });

  it('refuses a venture id that could escape the directory', () => {
    // A readable file really does sit outside, so this fails the moment the guard goes.
    writeFileSync(join(dir, 'escaped.yaml'), 'departments:\n  sell: 999999\n');
    const nested = join(dir, 'nested'); mkdirSync(nested, { recursive: true });
    expect(loadEnvelopes('../escaped', nested).envelopes).toEqual([]);
    expect(loadEnvelopes('has_underscore', dir).error).toMatch(/not a usable venture id/);
  });

  it('rejects a pounds-for-pence limit, a bad currency, a bad period, and a list', () => {
    expect(parseEnvelopes({ departments: { sell: 4800.5 } }).error).toMatch(/whole number of minor units/);
    expect(parseEnvelopes({ currency: 'pounds', departments: { sell: 1 } }).error).toMatch(/not a currency/);
    expect(parseEnvelopes({ period: 'fortnightly', departments: { sell: 1 } }).error).toMatch(/not a period/);
    expect(parseEnvelopes([{ sell: 1 }]).error).toMatch(/is a list/);
    expect(parseEnvelopes({ currency: 'GBP' }).error).toMatch(/sets no departments/);
  });

  it('keeps the valid limits when only some are rejected', () => {
    const { envelopes, error } = parseEnvelopes({ departments: { sell: 480_000, scale: 4800.5 } });
    expect(envelopes.map((e) => e.department)).toEqual(['sell']);
    expect(error).toMatch(/scale/);
  });
});

describe('currency, period and money formatting', () => {
  it('normalises a currency, and rejects anything that is not one', () => {
    expect(normalizeCurrency(' gbp ')).toBe('GBP');
    for (const bad of ['', 'POUNDS', 'G', 42, null, {}]) expect(normalizeCurrency(bad)).toBeNull();
  });

  it('computes window starts — mid-quarter, so monthly and quarterly differ', () => {
    const midQ = new Date('2026-08-15T12:00:00Z');
    expect(periodStart('quarterly', midQ)?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(periodStart('monthly', midQ)?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(periodStart('yearly', midQ)?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(periodStart('all-time', midQ)).toBeNull();
  });

  it('labels every period distinctly', () => {
    expect((['monthly', 'quarterly', 'yearly', 'all-time'] as const).map(periodLabel))
      .toEqual(['this month', 'this quarter', 'this year', 'all time']);
    expect(parsePeriod('QUARTERLY ')).toBe('quarterly');
    expect(parsePeriod('fortnightly')).toBeNull();
  });

  it('formats money, without walking the prototype chain for a symbol', () => {
    expect(formatMoney(480_000, 'GBP')).toBe('£4,800');
    expect(formatMoney(1_050, 'GBP')).toBe('£10.50');
    expect(formatMoney(480_000, 'constructor')).toBe('4,800 constructor');
    expect(pct(500_000, 0)).toBe(100); // one formula, no divide-by-zero garbage
  });
});

describe('timestamps are not taken on trust', () => {
  it('rejects a future date, an offset-less datetime, and a non-ISO string', () => {
    expect(spendInstant('3000-01-01T00:00:00Z', NOW)).toBeNull();
    expect(spendInstant('2026-07-10T00:00:00', NOW)).toBeNull();
    expect(spendInstant('07/10/2026', NOW)).toBeNull();
    expect(spendInstant('2026-07-10T00:00:00Z', NOW)).toBe(Date.parse('2026-07-10T00:00:00Z'));
  });

  it('counts an undatable spend in every window', () => {
    expect(withinPeriod(spend({ at: null }), 'monthly', NOW)).toBe(true);
    expect(withinPeriod(spend({ at: '2026-06-02T00:00:00Z' }), 'monthly', NOW)).toBe(false);
    expect(withinPeriod(spend({ at: '2026-06-02T00:00:00Z' }), 'all-time', NOW)).toBe(true);
  });
});

describe('the disclosure reports, and names what it could not add up', () => {
  it('sums committed spend in the window and in the limit’s currency', () => {
    const d = disclose(envelope, [spend(), spend({ at: '2026-06-02T00:00:00Z' })], NOW);
    expect(d.reportedMinor).toBe(100_000); // last month excluded
    expect(d.overLimit).toBe(false);
    expect(d.notes).toEqual([]);
  });

  it('includes the proposal being decided, and the rest of the queue separately', () => {
    const d = disclose(envelope, [spend(), spend({ status: 'proposed', amountMinor: 300_000 })], NOW, 200_000);
    expect(d.reportedMinor).toBe(300_000);   // 100k committed + 200k pending
    expect(d.queuedMinor).toBe(300_000);
    expect(d.overLimit).toBe(true);          // 600k > 480k
  });

  it('A FREE ACTION IS NOT UNCOUNTABLE SPEND', () => {
    // The defect that made the previous design unusable: an action with no price arrives as
    // {amountMinor: 0, currency: null}, and `null !== 'GBP'` booked it as spend-in-an-unknown-
    // currency — so every ordinary post or tweet permanently poisoned its department.
    const free = spend({ amountMinor: 0, currency: null });
    const d = disclose(envelope, [free, spend()], NOW);
    expect(d.notes).toEqual([]);
    expect(d.reportedMinor).toBe(100_000);
    // …and a free proposal queued by a lane cannot poison it either.
    expect(disclose(envelope, [free, { ...free, status: 'proposed' }], NOW).notes).toEqual([]);
  });

  it('names foreign, unreadable and undated spend rather than silently dropping it', () => {
    const d = disclose(envelope, [
      spend({ currency: 'USD', amountMinor: 900_000 }),
      spend({ amountMinor: 0, uncountable: 'unreadable-price' }),
      spend({ at: null }),
    ], NOW);
    expect(d.reportedMinor).toBe(100_000); // only the datable GBP one
    expect(d.notes).toEqual([
      'spend in USD',
      '1 action stating a cost the studio cannot read',
      '1 action with no usable date, counted in every period',
    ]);
  });

  it('does not let a PREVIOUS window’s foreign spend taint this one', () => {
    const old = spend({ currency: 'USD', at: '2026-06-02T00:00:00Z' });
    expect(disclose(envelope, [old], NOW).notes).toEqual([]);
  });

  it('ignores a negative pending amount rather than crediting the limit', () => {
    expect(disclose(envelope, [spend()], NOW, -1_000_000).reportedMinor).toBe(100_000);
  });
});

describe('the sentence a founder reads', () => {
  it('is a whole sentence, owned here — the view adds no prefix', () => {
    const d = disclose(envelope, [spend({ amountMinor: 400_000 })], NOW);
    expect(describeBudget(d, 'Sell'))
      .toBe('Limit £4,800 this month. The venture reports £4,000 spent — 83% of the limit.');
  });

  it('names the queue and the uncounted', () => {
    const d = disclose(envelope, [spend({ amountMinor: 400_000 }), spend({ status: 'proposed', amountMinor: 520_000 }), spend({ currency: 'USD', amountMinor: 1 })], NOW);
    const text = describeBudget(d, 'Sell');
    expect(text).toContain('£5,200 more awaiting your OK');
    expect(text).toContain('192% of the limit');
    expect(text).toContain('Not counted: spend in USD.');
  });

  it('says so plainly when there is no budget', () => {
    expect(describeBudget(null, 'Build')).toBe('No budget set for Build.');
  });
});

describe('departmentBudgets — the board, now a pure function', () => {
  it('returns a disclosure per declared department and flags orphan limits', () => {
    const { budgets, orphanEnvelopes } = departmentBudgets(
      ['build', 'sell'],
      [envelope, { ...envelope, department: 'marketing' }],
      [spend()],
      NOW,
    );
    expect(budgets[0]).toBeNull();               // build has no limit
    expect(budgets[1]?.reportedMinor).toBe(100_000);
    expect(orphanEnvelopes).toEqual(['marketing']);
  });

  it('does not count another department’s spend', () => {
    const { budgets } = departmentBudgets(['sell'], [envelope], [spend({ department: 'scale', amountMinor: 999_999 })], NOW);
    expect(budgets[0]?.reportedMinor).toBe(0);
  });
});
