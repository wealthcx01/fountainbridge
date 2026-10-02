import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DRAFT_ONLY, type CrmContact, type CrmDeal, type PipelineRead } from '../crm';

/**
 * The Sell surface, rendered (FB-235).
 *
 * The non-negotiable here is that nothing on it sends (non-negotiable 4). That is proved by rendering
 * the Sell content with the UI gate's fixture and looking at every control it draws: there is no form
 * and no button, and every link goes to the composer with a request that ends "do not send anything".
 * The studio's prompt bar sits above this content on every venture page and is a form; it too only
 * opens the composer. `e2e/sell.spec.ts` checks the whole page, prompt bar included.
 */
const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), 'e2e/fixtures/crm/arca.json'), 'utf8')) as {
  contacts: CrmContact[]; deals: CrmDeal[];
};
const NOW = Date.parse('2026-07-22T00:00:00Z');
const full: PipelineRead = {
  state: 'ok', contacts: FIXTURE.contacts, deals: FIXTURE.deals,
  totals: { contacts: FIXTURE.contacts.length, deals: FIXTURE.deals.length },
};

// Under vitest, JSX compiles to `React.createElement` (the app's own build uses the automatic runtime),
// so React has to be in scope before the component module is loaded.
(globalThis as { React?: typeof React }).React = React;
const { SellView } = await import('@/components/SellView');

const render = (read: PipelineRead) =>
  renderToStaticMarkup(React.createElement(SellView, { ventureId: 'arca', ventureName: 'ARCA', read, nowMs: NOW }));

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

describe('nothing on the Sell surface can send — tried, not assumed', () => {
  const html = render(full);

  it('draws no form and no button at all', () => {
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/formAction|<input\b/i);
  });

  it('every link it draws goes to the composer, asking for a draft and saying do not send', () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1]));
    expect(hrefs.length).toBe(5);
    for (const href of hrefs) {
      const url = new URL(href, 'https://studio.test');
      expect(url.pathname).toBe('/venture/arca/composer');
      const ask = url.searchParams.get('ask') ?? '';
      expect(ask.startsWith('Draft ')).toBe(true);
      expect(ask.endsWith(DRAFT_ONLY)).toBe(true);
      // The composer cuts a seeded request at 500 characters; one cut there would lose "do not send".
      expect(ask.length).toBeLessThanOrEqual(500);
    }
  });

  it('a very long message from someone still keeps "do not send" in the request', () => {
    const long = { ...FIXTURE.contacts[0], waiting: { ...FIXTURE.contacts[0].waiting!, summary: 'x'.repeat(900) } };
    const html2 = render({ ...full, contacts: [long, ...FIXTURE.contacts.slice(1)] } as PipelineRead);
    const first = decode(/href="([^"]+)"/.exec(html2)![1]);
    const ask = new URL(first, 'https://studio.test').searchParams.get('ask') ?? '';
    expect(ask.length).toBeLessThanOrEqual(500);
    expect(ask.endsWith(DRAFT_ONLY)).toBe(true);
  });
});

describe('what the founder reads', () => {
  it('leads with who needs them, then the board ending in Won', () => {
    const html = render(full);
    expect(html.indexOf('Who needs you now')).toBeLessThan(html.indexOf('Where every deal stands'));
    const stages = [...html.matchAll(/data-stage="([a-z_]+)"/g)].map((m) => m[1]);
    expect(stages).toEqual(['added', 'contacted', 'meeting', 'proposal', 'follow_up', 'won']);
    // Added holds four deals and shows three; across the board, 14 of the 15 not-lost deals show.
    expect(html).toMatch(/and 1 more/);
    expect([...html.matchAll(/data-testid="sell-deal"/g)]).toHaveLength(14);
    expect(html).toMatch(/And 2 more after these/);
    expect(html).toMatch(/1 deal lost, kept off the board/);
  });

  it('says what is missing rather than printing a partial total', () => {
    const html = render(full);
    expect(html).toMatch(/15 people, 14 open deals, 1 won, 1 lost\./);
    expect(html).toMatch(/6 of 14 open deals have no value yet, so there is no total\./);
    expect(html).not.toMatch(/add up to/);
  });

  it('says three different things for not set up, unreadable and empty', () => {
    expect(render({ state: 'not-connected' })).toMatch(/data-testid="sell-not-connected"/);
    const broken = render({ state: 'unreadable', reason: 'the studio’s database did not answer' });
    expect(broken).toMatch(/data-testid="sell-unreadable"/);
    expect(broken).toMatch(/not the same as it being\s+empty/);
    const empty = render({ state: 'ok', contacts: [], deals: [], totals: { contacts: 0, deals: 0 } });
    expect(empty).toMatch(/data-testid="sell-empty"/);
    for (const page of [broken, empty]) expect(page).not.toMatch(/sell-board/);
  });

  it('says when it is showing only part of a large pipeline', () => {
    const html = render({ ...full, totals: { contacts: 1400, deals: 2100 } } as PipelineRead);
    expect(html).toMatch(/data-testid="sell-capped"/);
    expect(html).toMatch(/1,400/);
  });
});
