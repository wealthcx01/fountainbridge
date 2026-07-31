import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseEnvelopes,
  loadEnvelopes,
  normalizeCurrency,
  periodStart,
  withinPeriod,
  committedSpend,
  mismatchedCurrencies,
  envelopeStatus,
  envelopeCheck,
  formatMoney,
  NEARING_THRESHOLD,
  type Spend,
  type Envelope,
} from '../budgets';

const NOW = new Date('2026-07-15T12:00:00Z');
const envelope: Envelope = { department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'monthly' };

const spend = (over: Partial<Spend> = {}): Spend => ({
  department: 'sell',
  amountMinor: 100_000,
  currency: 'GBP',
  status: 'executed',
  at: '2026-07-10T00:00:00Z',
  ...over,
});

describe('envelopes come from the studio repo, and a broken file says so', () => {
  const dir = mkdtempSync(join(tmpdir(), 'budgets-'));

  it('loads a venture budgets file', () => {
    writeFileSync(join(dir, 'arca.yaml'), 'currency: GBP\nperiod: monthly\ndepartments:\n  sell: 480000\n');
    const { envelopes, error } = loadEnvelopes('arca', dir);
    expect(error).toBeNull();
    expect(envelopes).toEqual([{ department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'monthly' }]);
  });

  it('treats a missing file as "no budgets set", not an error', () => {
    expect(loadEnvelopes('nosuchventure', dir)).toEqual({ envelopes: [], error: null });
  });

  it('REPORTS an unreadable file instead of silently disabling the gate', () => {
    // The first cut collapsed a corrupt file into an empty list, so the money gate turned itself off
    // with nothing on any screen to say why (non-negotiable 10).
    writeFileSync(join(dir, 'broken.yaml'), 'currency: GBP\n  departments: {oh no\n');
    const { envelopes, error } = loadEnvelopes('broken', dir);
    expect(envelopes).toEqual([]);
    expect(error).toMatch(/could not be read/);
  });

  it('reports a limit written in pounds instead of pence, rather than dropping it silently', () => {
    const { envelopes, error } = parseEnvelopes({ departments: { sell: 4800.5 } });
    expect(envelopes).toEqual([]);
    expect(error).toMatch(/whole number of minor units/);
  });

  it('rejects a bad currency or period outright', () => {
    expect(parseEnvelopes({ currency: 'pounds', departments: { sell: 1 } }).error).toMatch(/not a currency/);
    expect(parseEnvelopes({ period: 'fortnightly', departments: { sell: 1 } }).error).toMatch(/not a period/);
  });

  it('refuses a venture id that could escape the directory', () => {
    expect(loadEnvelopes('../../etc/passwd', dir)).toEqual({ envelopes: [], error: null });
  });
});

describe('currency normalisation', () => {
  it('accepts ISO-4217 shapes, case- and space-insensitively', () => {
    expect(normalizeCurrency(' gbp ')).toBe('GBP');
    expect(normalizeCurrency('USD')).toBe('USD');
  });
  it('rejects anything else, so "gbp"-style variants cannot dodge the comparison', () => {
    for (const bad of ['', 'POUNDS', 'G', 42, null, undefined, {}]) expect(normalizeCurrency(bad)).toBeNull();
  });
});

describe('spend is windowed to the envelope period', () => {
  it('computes the window start', () => {
    expect(periodStart('monthly', NOW)?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(periodStart('quarterly', NOW)?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(periodStart('yearly', NOW)?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(periodStart('all-time', NOW)).toBeNull();
  });

  it('excludes spend from a previous window', () => {
    // Before this, spend was summed over ALL TIME against a monthly limit, so a venture spending
    // exactly on budget read 100% in month 1 and 1200% in month 12.
    const old = spend({ at: '2026-06-02T00:00:00Z' });
    expect(committedSpend([old, spend()], 'sell', 'GBP', 'monthly', NOW)).toBe(100_000);
    expect(committedSpend([old, spend()], 'sell', 'GBP', 'all-time', NOW)).toBe(200_000);
  });

  it('counts an undated spend in every window rather than dropping it', () => {
    // Understating a budget is the direction that hurts, so v0 records with no timestamp count.
    expect(withinPeriod(spend({ at: null }), 'monthly', NOW)).toBe(true);
    expect(committedSpend([spend({ at: null })], 'sell', 'GBP', 'monthly', NOW)).toBe(100_000);
  });
});

describe('committedSpend', () => {
  it('counts granted, executing and executed only', () => {
    const s = [spend({ status: 'granted' }), spend({ status: 'executing' }), spend({ status: 'executed' })];
    expect(committedSpend(s, 'sell', 'GBP', 'monthly', NOW)).toBe(300_000);
    expect(committedSpend([spend({ status: 'proposed' })], 'sell', 'GBP', 'monthly', NOW)).toBe(0);
    expect(committedSpend([spend({ status: 'rejected' })], 'sell', 'GBP', 'monthly', NOW)).toBe(0);
  });

  it('excludes a foreign OR unstated currency, and names both as uncounted', () => {
    const mixed = [spend({ currency: 'USD' }), spend({ currency: null }), spend()];
    expect(committedSpend(mixed, 'sell', 'GBP', 'monthly', NOW)).toBe(100_000);
    expect(mismatchedCurrencies(mixed, 'sell', 'GBP', 'monthly', NOW)).toEqual(['(unstated)', 'USD']);
  });
});

describe('envelopeStatus', () => {
  const at = (amountMinor: number) => envelopeStatus(envelope, [spend({ amountMinor })], 'sell', NOW);

  it('pins the over/nearing/within boundaries exactly', () => {
    // Flipping `>` to `>=` on a money gate must break a test.
    expect(at(envelope.limitMinor).state).toBe('nearing');
    expect(at(envelope.limitMinor).percent).toBe(100);
    expect(at(envelope.limitMinor + 1).state).toBe('over');
    expect(at(envelope.limitMinor * NEARING_THRESHOLD).state).toBe('nearing');
    expect(at(envelope.limitMinor * NEARING_THRESHOLD - 1).state).toBe('within');
  });

  it('reads "unset" — never "over" — when no envelope exists', () => {
    const s = envelopeStatus(undefined, [spend()], 'sell', NOW);
    expect(s.state).toBe('unset');
    expect(s.detail).toBe('no budget set');
  });

  it('labels the window honestly instead of a period it does not enforce', () => {
    expect(at(100_000).detail).toContain('of £4,800 this month');
    const yearly = envelopeStatus({ ...envelope, period: 'yearly' }, [spend()], 'sell', NOW);
    expect(yearly.detail).toContain('this year');
  });

  it('shows what the whole queue would do, not just this one proposal', () => {
    // Ten £1,000 proposals each read "within — 21%"; approving all ten spent £10,000 and no card
    // ever said so.
    const s = envelopeStatus(envelope, [], 'sell', NOW, 100_000, 900_000);
    expect(s.detail).toContain('208% if everything queued is approved');
  });

  it('handles a zero limit without dividing by zero', () => {
    const zero = { ...envelope, limitMinor: 0 };
    expect(envelopeStatus(zero, [], 'sell', NOW).state).toBe('within');
    expect(Number.isFinite(envelopeStatus(zero, [spend({ amountMinor: 1 })], 'sell', NOW).percent)).toBe(true);
  });
});

describe('formatMoney', () => {
  it('renders minor units as a founder reads them', () => {
    expect(formatMoney(480_000, 'GBP')).toBe('£4,800');
    expect(formatMoney(1_050, 'GBP')).toBe('£10.50');
    expect(formatMoney(500, 'CHF')).toBe('5 CHF');
  });

  it('does not walk the prototype chain for a symbol', () => {
    // "constructor" previously returned an inherited function and rendered
    // `function Object() { [native code] }4,800` on the card.
    expect(formatMoney(480_000, 'constructor')).toBe('4,800 constructor');
    expect(formatMoney(480_000, 'toString')).toBe('4,800 toString');
  });
});

describe('the check FAILS CLOSED — an unreadable input never yields a silent pass', () => {
  const priced = { amountMinor: 100_000, currency: 'GBP' };

  it('fails when the price was stated but could not be read', () => {
    const c = envelopeCheck(envelope, [], 'sell', { amountMinor: null, currency: 'GBP', priceUnreadable: true }, NOW);
    expect(c?.passed).toBe(false);
    expect(c?.detail).toMatch(/cannot read/);
  });

  it('fails when the department is not one this venture declares', () => {
    const c = envelopeCheck(undefined, [], 'marketing', priced, NOW, false);
    expect(c?.passed).toBe(false);
    expect(c?.detail).toMatch(/not a department/);
  });

  it('fails when the department has no envelope, rather than omitting the check', () => {
    const c = envelopeCheck(undefined, [], 'sell', priced, NOW);
    expect(c?.passed).toBe(false);
    expect(c?.detail).toMatch(/no budget is set/);
  });

  it('fails on an unstated or foreign currency', () => {
    expect(envelopeCheck(envelope, [], 'sell', { amountMinor: 100_000, currency: null }, NOW)?.passed).toBe(false);
    expect(envelopeCheck(envelope, [], 'sell', { amountMinor: 100_000, currency: 'USD' }, NOW)?.detail)
      .toMatch(/priced in USD/);
  });

  it('says nothing only for a genuinely free action', () => {
    expect(envelopeCheck(envelope, [], 'sell', { amountMinor: null, currency: null }, NOW)).toBeNull();
    expect(envelopeCheck(envelope, [], 'sell', { amountMinor: 0, currency: 'GBP' }, NOW)).toBeNull();
  });

  it('passes a real within-budget spend', () => {
    const c = envelopeCheck(envelope, [], 'sell', priced, NOW);
    expect(c?.passed).toBe(true);
    expect(c?.detail).toContain('within');
  });
});
