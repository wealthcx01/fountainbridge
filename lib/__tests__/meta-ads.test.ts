import { describe, it, expect } from 'vitest';
import {
  adsConnection,
  campaignStatus,
  decimalToMinor,
  describePeriod,
  describeResult,
  formatAdsMoney,
  readAdsReport,
  type MetaAdsRaw,
  type MetaInsightRow,
} from '../meta-ads';
import example from '../meta-ads-example.json';

/**
 * FB-248. Every input here is Meta's own reporting shape: spend as a decimal STRING in the account's
 * currency, budgets as minor-unit strings, results inside `actions`, every list paged. A test built
 * on numbers would never meet the string-to-money step, which is where money goes wrong.
 */

const END_OF_SEPTEMBER = new Date('2026-09-30T23:59:59Z');
const EXAMPLE = example as MetaAdsRaw;

const row = (over: Partial<MetaInsightRow> & { campaign_id: string }): MetaInsightRow => ({
  spend: '10.00',
  date_start: '2026-09-01',
  date_stop: '2026-09-30',
  ...over,
});

const account = (currency = 'GBP') => ({ id: 'act_1', name: 'Test', currency });

describe('decimalToMinor — money as text, never through a float', () => {
  it('reads Meta’s decimal strings exactly', () => {
    expect(decimalToMinor('412.37', 2)).toBe(41237);
    // Meta drops a trailing zero.
    expect(decimalToMinor('268.9', 2)).toBe(26890);
    expect(decimalToMinor('300', 2)).toBe(30000);
    // 0.29 * 100 is 28.999999999999996 in floating point. Truncate it and a penny goes missing.
    expect(decimalToMinor('0.29', 2)).toBe(29);
    expect(decimalToMinor('1.15', 2)).toBe(115);
  });

  it('rounds extra places half-up, and respects a currency with no minor unit', () => {
    expect(decimalToMinor('1.005', 2)).toBe(101);
    expect(decimalToMinor('1.004', 2)).toBe(100);
    expect(decimalToMinor('5000', 0)).toBe(5000);
  });

  it('refuses anything that is not a plain amount, rather than calling it zero', () => {
    for (const bad of ['', 'n/a', '-5.00', '1e3', '12,50', undefined]) {
      expect(decimalToMinor(bad as string | undefined, 2)).toBeNull();
    }
  });
});

describe('campaignStatus', () => {
  it('maps Meta’s statuses to a founder’s words', () => {
    expect(campaignStatus({ effective_status: 'ACTIVE' }, END_OF_SEPTEMBER)).toBe('running');
    expect(campaignStatus({ effective_status: 'CAMPAIGN_PAUSED' }, END_OF_SEPTEMBER)).toBe('paused');
    expect(campaignStatus({ effective_status: 'WITH_ISSUES' }, END_OF_SEPTEMBER)).toBe('problem');
    expect(campaignStatus({ effective_status: 'IN_PROCESS' }, END_OF_SEPTEMBER)).toBe('in-review');
    expect(campaignStatus({ effective_status: 'ARCHIVED' }, END_OF_SEPTEMBER)).toBe('stopped');
  });

  it('says Ended for a campaign Meta still calls ACTIVE after its end date', () => {
    const c = { effective_status: 'ACTIVE', stop_time: '2026-09-21T23:59:00+0100' };
    expect(campaignStatus(c, END_OF_SEPTEMBER)).toBe('ended');
    expect(campaignStatus(c, new Date('2026-09-15T12:00:00Z'))).toBe('running');
  });

  it('does not guess at a status it was never told about', () => {
    expect(campaignStatus({ effective_status: 'SOMETHING_NEW' }, END_OF_SEPTEMBER)).toBe('unknown');
    expect(campaignStatus({}, END_OF_SEPTEMBER)).toBe('unknown');
  });
});

describe('readAdsReport, on the example the page shows', () => {
  const report = readAdsReport(EXAMPLE, END_OF_SEPTEMBER);

  it('totals the spend to the penny', () => {
    // 412.37 + 268.90 + 96.12 + 300.00 + 18.40 + 54.10
    expect(report.totals.spendMinor).toBe(114989);
    expect(formatAdsMoney(report.totals.spendMinor, report.currency)).toBe('£1,149.89');
  });

  it('keeps the campaign that was deleted after it spent, and the one that never showed', () => {
    expect(report.campaigns).toHaveLength(7);
    const deleted = report.campaigns.find((c) => c.id === '120000000000000007');
    expect(deleted).toMatchObject({ name: 'Early test — broad UK', spendMinor: 5410, status: 'stopped', result: null });
    const unshown = report.campaigns.find((c) => c.id === '120000000000000005');
    expect(unshown).toMatchObject({ delivered: false, spendMinor: 0, status: 'in-review' });
  });

  it('counts a lead once, not once per place Meta reports it', () => {
    // The waitlist row reports `lead` 38 AND its parts, pixel 24 + on-Facebook 14. Adding them
    // would claim 76 sign-ups from 38 people.
    const waitlist = report.campaigns.find((c) => c.id === '120000000000000001');
    expect(waitlist?.result).toEqual({ kind: 'sign-up', count: 38 });
    expect(waitlist?.costPerResultMinor).toBe(1085); // £412.37 / 38
    expect(waitlist?.budget).toEqual({ per: 'day', minor: 2500 });
  });

  it('never adds results of different kinds together', () => {
    expect(report.totals.results).toEqual(
      expect.arrayContaining([
        { kind: 'sign-up', count: 47 },
        { kind: 'click', count: 942 },
        { kind: 'person-reached', count: 48211 },
      ]),
    );
    expect(report.totals.results).toHaveLength(3);
  });

  it('gives no price "each" for people reached, which would be a fraction of a penny', () => {
    const teaser = report.campaigns.find((c) => c.id === '120000000000000004');
    expect(teaser?.result).toEqual({ kind: 'person-reached', count: 48211 });
    expect(teaser?.costPerResultMinor).toBeNull();
  });

  it('a lead campaign that brought none back says zero, not nothing', () => {
    const alerts = report.campaigns.find((c) => c.id === '120000000000000006');
    expect(alerts?.result).toEqual({ kind: 'sign-up', count: 0 });
    expect(alerts?.costPerResultMinor).toBeNull();
  });

  it('puts what needs someone first, then what is running', () => {
    expect(report.campaigns.map((c) => c.status)).toEqual([
      'problem',
      'in-review',
      'running',
      'running',
      'paused',
      'ended',
      'stopped',
    ]);
    expect(report.totals.running).toBe(2);
  });

  it('states the period Meta reported, and has nothing to warn about', () => {
    expect(report.period).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(describePeriod(report.period!)).toBe('1 Sept – 30 Sept 2026');
    expect(report.notes).toEqual([]);
  });
});

describe('readAdsReport, when Meta’s answer is not clean', () => {
  const raw = (over: Partial<MetaAdsRaw> = {}): MetaAdsRaw => ({
    account: account(),
    campaigns: { data: [{ id: 'a', name: 'A', objective: 'OUTCOME_LEADS', effective_status: 'ACTIVE' }, { id: 'b', name: 'B', objective: 'OUTCOME_LEADS', effective_status: 'ACTIVE' }] },
    insights: { data: [row({ campaign_id: 'a', spend: '20.00' }), row({ campaign_id: 'b', spend: '30.00' })] },
    ...over,
  });

  it('says out loud when Meta had more than it read', () => {
    // Meta pages its lists. A total built on page one and presented as the account is the
    // contents-API failure that froze every ARCA screen on 31 August.
    const cut = readAdsReport(raw({ insights: { data: raw().insights.data, paging: { next: 'https://graph.facebook.com/next' } } }), END_OF_SEPTEMBER);
    expect(cut.notes.join(' ')).toMatch(/more to report than the studio read/);
    const cutCampaigns = readAdsReport(raw({ campaigns: { data: raw().campaigns.data, paging: { next: 'x' } } }), END_OF_SEPTEMBER);
    expect(cutCampaigns.notes.join(' ')).toMatch(/only part of the account/);
    expect(readAdsReport(raw(), END_OF_SEPTEMBER).notes).toEqual([]);
  });

  it('names a spend it cannot read and leaves it out of the total, rather than counting it as zero', () => {
    const r = readAdsReport(raw({ insights: { data: [row({ campaign_id: 'a', spend: 'twenty' }), row({ campaign_id: 'b', spend: '30.00' })] } }), END_OF_SEPTEMBER);
    expect(r.campaigns.find((c) => c.id === 'a')?.spendMinor).toBeNull();
    expect(r.totals.spendMinor).toBe(3000);
    expect(r.notes.join(' ')).toMatch(/spend figure for A was missing or could not be read/);
  });

  it('adds up every row Meta sends for a campaign, when it sends one per day', () => {
    // Asked for a daily breakdown, Meta sends one row per campaign per day. Keeping only the last
    // would show £20 of £30 spent while the page still claimed both days.
    const r = readAdsReport(
      raw({
        insights: {
          data: [
            row({ campaign_id: 'a', spend: '10.00', date_start: '2026-09-01', date_stop: '2026-09-01', actions: [{ action_type: 'lead', value: '2' }] }),
            row({ campaign_id: 'a', spend: '20.00', date_start: '2026-09-02', date_stop: '2026-09-02', actions: [{ action_type: 'lead', value: '3' }] }),
          ],
        },
      }),
      END_OF_SEPTEMBER,
    );
    const a = r.campaigns.find((c) => c.id === 'a');
    expect(a).toMatchObject({ spendMinor: 3000, result: { kind: 'sign-up', count: 5 }, costPerResultMinor: 600 });
    expect(r.totals.spendMinor).toBe(3000);
    expect(r.period).toEqual({ start: '2026-09-01', end: '2026-09-02' });
    expect(r.notes).toEqual([]);
  });

  it('adds sales value across daily rows too', () => {
    const r = readAdsReport(
      {
        account: account(),
        campaigns: { data: [{ id: 's', name: 'S', objective: 'OUTCOME_SALES', effective_status: 'ACTIVE' }] },
        insights: {
          data: [
            row({ campaign_id: 's', actions: [{ action_type: 'purchase', value: '1' }], action_values: [{ action_type: 'purchase', value: '40.00' }] }),
            row({ campaign_id: 's', actions: [{ action_type: 'purchase', value: '2' }], action_values: [{ action_type: 'purchase', value: '60.50' }] }),
          ],
        },
      },
      END_OF_SEPTEMBER,
    );
    expect(r.campaigns[0]).toMatchObject({ spendMinor: 2000, result: { kind: 'purchase', count: 3 }, salesMinor: 10050 });
  });

  it('one unreadable day makes the campaign’s spend unreadable, not a smaller number', () => {
    const r = readAdsReport(
      raw({ insights: { data: [row({ campaign_id: 'a', spend: '10.00' }), row({ campaign_id: 'a', spend: 'n/a' }), row({ campaign_id: 'b', spend: '30.00' })] } }),
      END_OF_SEPTEMBER,
    );
    expect(r.campaigns.find((c) => c.id === 'a')?.spendMinor).toBeNull();
    expect(r.totals.spendMinor).toBe(3000);
    expect(r.notes.join(' ')).toMatch(/spend figure for A was missing or could not be read/);
  });

  it('does not add people reached across days, and says why it is missing', () => {
    // The same person reached on two days is one person. Adding daily reach would overstate it.
    const teaser = { id: 't', name: 'Teaser', objective: 'OUTCOME_AWARENESS', effective_status: 'ACTIVE' };
    const daily = readAdsReport(
      raw({ campaigns: { data: [teaser] }, insights: { data: [row({ campaign_id: 't', reach: '100' }), row({ campaign_id: 't', reach: '80' })] } }),
      END_OF_SEPTEMBER,
    );
    expect(daily.campaigns[0].result).toBeNull();
    expect(daily.campaigns[0].spendMinor).toBe(2000);
    expect(daily.notes.join(' ')).toMatch(/figures for Teaser in parts.*people reached cannot be added up/);
    const whole = readAdsReport(raw({ campaigns: { data: [teaser] }, insights: { data: [row({ campaign_id: 't', reach: '150' })] } }), END_OF_SEPTEMBER);
    expect(whole.campaigns[0].result).toEqual({ kind: 'person-reached', count: 150 });
    expect(whole.notes).toEqual([]);
  });

  it('names a row with no spend figure at all, rather than counting it as £0', () => {
    const r = readAdsReport(
      raw({ insights: { data: [row({ campaign_id: 'a', spend: undefined }), row({ campaign_id: 'b', spend: '30.00' })] } }),
      END_OF_SEPTEMBER,
    );
    expect(r.campaigns.find((c) => c.id === 'a')?.spendMinor).toBeNull();
    expect(r.notes.join(' ')).toMatch(/spend figure for A was missing or could not be read/);
  });

  it('orders campaigns of the same status by what they spent, most first', () => {
    const r = readAdsReport(
      raw({
        campaigns: {
          data: [
            { id: 'small', name: 'Small', effective_status: 'ACTIVE' },
            { id: 'big', name: 'Big', effective_status: 'ACTIVE' },
            { id: 'mid', name: 'Mid', effective_status: 'ACTIVE' },
          ],
        },
        insights: { data: [row({ campaign_id: 'small', spend: '5.00' }), row({ campaign_id: 'big', spend: '50.00' }), row({ campaign_id: 'mid', spend: '20.00' })] },
      }),
      END_OF_SEPTEMBER,
    );
    expect(r.campaigns.map((c) => c.id)).toEqual(['big', 'mid', 'small']);
  });

  it('names a status it does not recognise', () => {
    const r = readAdsReport(raw({ campaigns: { data: [{ id: 'a', name: 'A', effective_status: 'BRAND_NEW_STATE' }] } }), END_OF_SEPTEMBER);
    expect(r.notes.join(' ')).toMatch(/does not recognise for A/);
  });

  it('reads an account in a currency with no pennies', () => {
    const r = readAdsReport(
      { account: account('JPY'), campaigns: { data: [{ id: 'a', name: 'A', objective: 'OUTCOME_TRAFFIC', effective_status: 'ACTIVE', daily_budget: '3000' }] }, insights: { data: [row({ campaign_id: 'a', spend: '5000', actions: [{ action_type: 'link_click', value: '40' }] })] } },
      END_OF_SEPTEMBER,
    );
    expect(r.totals.spendMinor).toBe(5000);
    expect(formatAdsMoney(r.totals.spendMinor, 'JPY')).toBe('JP¥5,000');
    expect(r.campaigns[0].costPerResultMinor).toBe(125);
  });

  it('reports sales value for a sales campaign, in the account’s money', () => {
    const r = readAdsReport(
      {
        account: account(),
        campaigns: { data: [{ id: 's', name: 'S', objective: 'OUTCOME_SALES', effective_status: 'ACTIVE', lifetime_budget: '50000' }] },
        insights: { data: [row({ campaign_id: 's', spend: '100.00', actions: [{ action_type: 'purchase', value: '4' }], action_values: [{ action_type: 'purchase', value: '259.96' }] })] },
      },
      END_OF_SEPTEMBER,
    );
    expect(r.campaigns[0]).toMatchObject({ result: { kind: 'purchase', count: 4 }, salesMinor: 25996, budget: { per: 'total', minor: 50000 } });
  });
});

describe('describeResult', () => {
  it('says the thing in words, singular and plural', () => {
    expect(describeResult('sign-up', 1)).toBe('1 sign-up');
    expect(describeResult('person-reached', 48211)).toBe('48,211 people reached');
  });
});

describe('adsConnection — from what the venture declares', () => {
  it('is not connected when a surface declares Meta, and not chosen when none does', () => {
    expect(adsConnection([{ id: 'scale', name: 'Scale', connectors: ['meta-ads'] }])).toEqual({
      state: 'not-connected',
      departmentId: 'scale',
      departmentName: 'Scale',
    });
    expect(adsConnection([{ id: 'sell', name: 'Sell', connectors: ['postmark'] }])).toEqual({ state: 'not-chosen' });
    expect(adsConnection([])).toEqual({ state: 'not-chosen' });
  });
});
