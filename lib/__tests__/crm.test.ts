import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describePipeline, formatDealValue, PIPELINE_READ_CAP, type CrmContact, type CrmDeal } from '../crm';
import { loadPipeline } from '../crm-load';
import { handleMcp, toolFor } from '../mcp';

/**
 * The Sell pipeline's read and its words (FB-234). Every person here is invented.
 */

const contact = (over: Partial<CrmContact> = {}): CrmContact => ({
  id: 'c1', name: 'Ada Example', email: 'ada@example.test', title: 'Owner', company: 'Example Card Shop',
  temperature: 'hot', snoozedUntil: null,
  last: { kind: 'email_in', summary: 'Asked when the pilot could start', at: '2026-09-30T09:00:00.000Z' },
  awaitingReply: 1,
  waiting: { summary: 'Asked when the pilot could start', at: '2026-09-30T09:00:00.000Z' }, ...over,
});

const deal = (over: Partial<CrmDeal> = {}): CrmDeal => ({
  id: 'd1', title: 'Shop pilot', contactId: 'c1', company: 'Example Card Shop', stage: 'proposal',
  valueMinor: 250000, currency: 'GBP', probability: null, nextStep: 'Send the pilot terms',
  nextStepDue: '2026-10-03', stageChangedAt: '2026-09-28T09:00:00.000Z', ...over,
});

describe('what the Sell lane is told', () => {
  it('names each deal by stage, who it is with, and who is waiting', () => {
    const text = describePipeline('ARCA', {
      state: 'ok', contacts: [contact()], deals: [deal()], totals: { contacts: 1, deals: 1 },
    });
    expect(text).toMatch(/Proposal sent \(1\):/);
    expect(text).toMatch(/- Shop pilot, with Ada Example, at Example Card Shop, worth 2,500 GBP, next: Send the pilot terms by 2026-10-03/);
    expect(text).toMatch(/Waiting for a reply from the founder:\n- Ada Example: Asked when the pilot could start/);
    expect(text).toMatch(/Nothing here can contact anyone/);
  });

  it('quotes what they wrote, not a note the founder logged after it', () => {
    const text = describePipeline('ARCA', {
      state: 'ok',
      contacts: [contact({ last: { kind: 'note', summary: 'Our own note: chase on Friday', at: '2026-10-01T09:00:00.000Z' } })],
      deals: [deal()], totals: { contacts: 1, deals: 1 },
    });
    expect(text).toMatch(/Waiting for a reply from the founder:\n- Ada Example: Asked when the pilot could start/);
    expect(text).not.toMatch(/Our own note/);
  });

  it('says when the read was capped, rather than looking complete', () => {
    const capped = describePipeline('ARCA', {
      state: 'ok', contacts: [contact()], deals: [deal()], totals: { contacts: 1, deals: 1400 },
    });
    expect(capped).toMatch(new RegExp(`first ${PIPELINE_READ_CAP} of each.*1400 deals`));
    const whole = describePipeline('ARCA', {
      state: 'ok', contacts: [contact()], deals: [deal()], totals: { contacts: 1, deals: 1 },
    });
    expect(whole).not.toMatch(/first \d+ of each/);
  });

  it('says three different things for empty, not connected and unreadable', () => {
    const empty = describePipeline('ARCA', { state: 'ok', contacts: [], deals: [], totals: { contacts: 0, deals: 0 } });
    const none = describePipeline('ARCA', { state: 'not-connected' });
    const broken = describePipeline('ARCA', { state: 'unreadable', reason: 'the studio’s database did not answer' });
    expect(empty).toMatch(/is empty/);
    expect(none).toMatch(/no database/);
    expect(none).not.toMatch(/is empty/);
    expect(broken).toMatch(/could not be read/);
    expect(broken).toMatch(/not the same as it being empty/);
  });

  it('prints money with its currency, and nothing when either half is missing', () => {
    expect(formatDealValue(250000, 'GBP')).toBe('2,500 GBP');
    expect(formatDealValue(1999, 'EUR')).toBe('19.99 EUR');
    expect(formatDealValue(null, 'GBP')).toBeNull();
    expect(formatDealValue(100, null)).toBeNull();
  });
});

describe('loading the pipeline', () => {
  it('says "not connected" when the studio has no database, rather than "empty"', async () => {
    expect(await loadPipeline('arca', {})).toEqual({ state: 'not-connected' });
  });

  it('a failed read is unreadable, never empty', async () => {
    const read = await loadPipeline('arca', { E2E_TEST_LOGIN: '1', E2E_FAIL_READS: 'pipeline' });
    expect(read.state).toBe('unreadable');
  });

  it('reads the fixture only on the test rig', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crm-'));
    writeFileSync(join(dir, 'arca.json'), JSON.stringify({ contacts: [contact()], deals: [deal()] }));
    const rig = await loadPipeline('arca', { E2E_TEST_LOGIN: '1', CRM_FIXTURE_DIR: dir });
    expect(rig.state === 'ok' && rig.deals.map((d) => d.title)).toEqual(['Shop pilot']);
    // The same directory without the rig flag must not swap a founder's real pipeline for a file.
    expect(await loadPipeline('arca', { CRM_FIXTURE_DIR: dir })).toEqual({ state: 'not-connected' });
  });
});

describe('nothing in the pipeline can send — tried, not assumed', () => {
  it('the pipeline tool is a read, and asking for a send by any name is refused', async () => {
    expect(toolFor('sell_pipeline')?.kind).toBe('read');
    const ran: string[] = [];
    for (const name of ['send_email', 'reply_to_contact', 'email_contact', 'nudge_contact', 'send']) {
      const r = await handleMcp(
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { to: 'ada@example.test' } } },
        { ventureId: 'arca', email: 'studio-tools@arca' },
        async (n) => { ran.push(n); return 'ran'; },
      ) as { error?: { message: string } };
      expect(r.error?.message, name).toMatch(/There is no tool called/);
    }
    expect(ran, 'a refused tool still ran').toEqual([]);
  });

  it('the pipeline code reaches nothing outside the studio’s own database', () => {
    // The only way a read module could send is by reaching the network itself. Neither does.
    for (const f of ['lib/crm.ts', 'lib/crm-load.ts']) {
      const src = readFileSync(join(process.cwd(), f), 'utf8');
      expect(src, f).not.toMatch(/\bfetch\(|from ['"]node:(https?|net)['"]|googleapis|gmail|nodemailer|smtp/i);
    }
  });
});
