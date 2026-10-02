import {
  STATUS_LABEL,
  describePeriod,
  describeResult,
  formatAdsMoney,
  type AdsReport,
  type CampaignLine,
  type CampaignStatus,
} from '@/lib/meta-ads';
import { toneColor, type Tone } from '@/lib/status';
import { Mark } from '@/components/Mark';

/**
 * What a venture's Meta ads are doing (FB-248): what is running, what it cost, what it returned.
 *
 * Read-only by construction. There is not a button on this screen, because the only thing a button
 * could do to an ad is spend money, and that waits for the approval gate to be verified (FB-171).
 */

const STATUS_TONE: Record<CampaignStatus, Tone> = {
  running: 'working',
  ended: 'idle',
  paused: 'idle',
  stopped: 'idle',
  // Waiting on Meta, not on the founder: nothing for them to do yet.
  'in-review': 'idle',
  // These two need someone to look in Meta. A decision waiting on a human, not a failure of ours.
  problem: 'attention',
  unknown: 'attention',
};

function CampaignRow({ c, currency }: { c: CampaignLine; currency: string }) {
  const money = (minor: number) => formatAdsMoney(minor, currency);
  const facts: string[] = [];
  if (!c.delivered) {
    facts.push('Not shown to anyone in this period');
  } else {
    facts.push(c.spendMinor === null ? 'Spend could not be read' : `${money(c.spendMinor)} spent`);
    if (c.result) {
      facts.push(describeResult(c.result.kind, c.result.count));
      if (c.costPerResultMinor !== null) facts.push(`${money(c.costPerResultMinor)} each`);
    } else {
      facts.push('No result the studio can name');
    }
    if (c.salesMinor !== null) facts.push(`${money(c.salesMinor)} in sales, as Meta counts them`);
  }
  if (c.budget) facts.push(c.budget.per === 'day' ? `budget ${money(c.budget.minor)} a day` : `budget ${money(c.budget.minor)} in total`);

  return (
    <li className="ads-row" data-testid={`ads-campaign-${c.id}`}>
      <span className="ads-row-name">{c.name}</span>
      <span className="ads-row-status" style={{ color: toneColor(STATUS_TONE[c.status]) }} data-status={c.status}>
        <Mark tone={STATUS_TONE[c.status]} />
        {STATUS_LABEL[c.status]}
      </span>
      <span className="ads-row-facts muted">{facts.join(' · ')}</span>
    </li>
  );
}

export function AdsReportView({ report }: { report: AdsReport }) {
  const money = (minor: number) => formatAdsMoney(minor, report.currency);
  const results = report.totals.results.map((r) => describeResult(r.kind, r.count));

  return (
    <div data-testid="ads-report">
      <div className="ads-figures">
        <div className="ads-figure">
          <p className="ads-figure-label">Spent</p>
          <p className="ads-figure-value" data-testid="ads-total-spend">{money(report.totals.spendMinor)}</p>
          <p className="ads-figure-note muted">{report.period ? describePeriod(report.period) : 'Period not stated by Meta'}</p>
        </div>
        <div className="ads-figure">
          <p className="ads-figure-label">Running now</p>
          <p className="ads-figure-value" data-testid="ads-running">
            {report.totals.running} of {report.totals.campaigns}
          </p>
          <p className="ads-figure-note muted">campaigns</p>
        </div>
        <div className="ads-figure">
          <p className="ads-figure-label">What came back</p>
          <p className="ads-figure-value ads-figure-value-text" data-testid="ads-results">
            {results.length > 0 ? results.join(' · ') : 'Nothing yet'}
          </p>
          <p className="ads-figure-note muted">as Meta counts them</p>
        </div>
      </div>

      {report.notes.length > 0 ? (
        <ul className="ads-notes" data-testid="ads-notes">
          {report.notes.map((n) => (
            <li key={n} style={{ color: toneColor('attention') }}>
              <Mark tone="attention" />
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      <h3 className="ads-list-head">Campaigns</h3>
      {report.campaigns.length === 0 ? (
        <p className="muted" data-testid="ads-empty">No campaigns in this account.</p>
      ) : (
        <ul className="ads-list">
          {report.campaigns.map((c) => (
            <CampaignRow key={c.id} c={c} currency={report.currency} />
          ))}
        </ul>
      )}
    </div>
  );
}
