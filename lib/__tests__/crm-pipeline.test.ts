import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nextActions,
  pipelineNumbers,
  NEXT_ACTIONS_SHOWN,
  DRAFT_ONLY,
  type CrmContact,
  type CrmDeal,
  type PipelineRead,
} from '../crm';

/**
 * Who needs the founder now, and what the pipeline adds up to (FB-235).
 *
 * Run against the UI gate's own fixture — fourteen invented people and sixteen deals, built to be
 * big enough to hit the caps: more people waiting than the list shows, a stage with more deals than
 * the board shows, a snoozed person, a won and a lost deal, and open deals with no value.
 */
const FIXTURE = JSON.parse(readFileSync(join(process.cwd(), 'e2e/fixtures/crm/arca.json'), 'utf8')) as {
  contacts: CrmContact[]; deals: CrmDeal[];
};
const NOW = Date.parse('2026-07-22T00:00:00Z'); // the UI gate's pinned E2E_NOW

const ok = (contacts: CrmContact[], deals: CrmDeal[]): PipelineRead & { state: 'ok' } => ({
  state: 'ok', contacts, deals, totals: { contacts: contacts.length, deals: deals.length },
});
const read = ok(FIXTURE.contacts, FIXTURE.deals);

describe('who needs you now', () => {
  const { shown, more } = nextActions(read, NOW);

  it('is short, and says how many more there are', () => {
    expect(shown).toHaveLength(NEXT_ACTIONS_SHOWN);
    expect(more).toBe(2);
  });

  it('puts people waiting for a reply first, hot before warm before cold, then what is overdue, then what is due', () => {
    expect(shown.map((a) => `${a.status}:${a.name}`)).toEqual([
      'awaiting-reply:Ada Example',
      'awaiting-reply:Ben Placeholder',
      'awaiting-reply:Cara Sample',
      'overdue:Dev Testwell',
      'due:Eli Mockford',
    ]);
  });

  it('gives one sentence of why, in words a founder reads', () => {
    const [ada, ben] = shown;
    expect(ada.reason).toBe('Wrote yesterday: “Asked whether the pilot can start before the August show”.');
    expect(ben.reason).toMatch(/^Wrote 4 days ago: .*They have written 2 times without an answer\.$/);
    expect(shown[3].reason).toBe('Send the rollout plan on “Buying-team rollout” was due 2 days ago.');
    expect(shown[4].reason).toBe('Chase the signed terms on “Pilot terms” is due today.');
  });

  it('leaves off anyone snoozed until later, and brings them back when it ends', () => {
    // Hana's next step is due tomorrow, and she is snoozed until 5 August.
    const hana = ok(FIXTURE.contacts.filter((c) => c.name === 'Hana Specimen'), FIXTURE.deals);
    expect(nextActions(hana, NOW).shown).toEqual([]);
    const after = nextActions(hana, Date.parse('2026-08-06T00:00:00Z')).shown;
    expect(after.map((a) => `${a.status}:${a.name}`)).toEqual(['overdue:Hana Specimen']);
  });

  it('lists never-contacted warm and hot people, and not cold ones', () => {
    // Jo is cold; with nothing recorded against them they would qualify on every other count.
    const wide = nextActions(ok(
      FIXTURE.contacts
        .filter((c) => ['Fay Fixture', 'Gus Dummy', 'Jo Prototype'].includes(c.name))
        .map((c) => (c.name === 'Jo Prototype' ? { ...c, last: null } : c)),
      FIXTURE.deals,
    ), NOW);
    expect(wide.shown.map((a) => `${a.status}:${a.name}`)).toEqual([
      'not-contacted:Gus Dummy',
      'not-contacted:Fay Fixture',
    ]);
  });

  it('never lists anyone twice, and never for a won or lost deal alone', () => {
    const all = nextActions(read, NOW);
    const names = all.shown.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain('Mo Pretend');
  });

  it('every action drafts and none of them sends', () => {
    for (const a of shown) {
      expect(a.draft.label).toMatch(/^Draft /);
      expect(a.draft.ask.endsWith(DRAFT_ONLY)).toBe(true);
    }
  });

  it('says nothing about a pipeline it could not read', () => {
    expect(nextActions({ state: 'unreadable', reason: 'x' }, NOW)).toEqual({ shown: [], more: 0 });
  });
});

describe('what the pipeline adds up to', () => {
  it('counts what is true and refuses to total what is missing', () => {
    const n = pipelineNumbers(read);
    expect(n).toMatchObject({ people: 14, open: 14, won: 1, lost: 1 });
    expect(n.openValue).toBeNull();
    expect(n.openValueMissing).toBe('6 of 14 open deals have no value yet, so there is no total.');
    expect(n.expected).toBeNull();
  });

  it('totals open deals only when every one has a value in one currency', () => {
    const priced = FIXTURE.deals.filter((d) => d.valueMinor !== null);
    const n = pipelineNumbers(ok(FIXTURE.contacts, priced));
    // Open and priced: 2,400 + 900 + 6,000 + 1,500 + 450 + 1,800 + 2,100 + 750 = 15,900 GBP.
    expect(n.openValue).toBe('15,900 GBP');
    expect(n.expectedMissing).toBe('An expected value needs a chance of closing on every open deal; 2 have none.');
  });

  it('weights by chance of closing only when every open deal has one', () => {
    const scored = FIXTURE.deals.filter((d) => d.valueMinor !== null && d.probability !== null);
    const n = pipelineNumbers(ok(FIXTURE.contacts, scored));
    // 2,400×60% + 6,000×40% + 1,500×50% + 1,800×50% + 2,100×70% + 750×60% = 7,410 GBP
    expect(n.openValue).toBe('14,550 GBP');
    expect(n.expected).toBe('7,410 GBP');
  });

  it('does not add pounds to euros', () => {
    const mixed = FIXTURE.deals.filter((d) => d.valueMinor !== null && d.stage !== 'won' && d.stage !== 'lost')
      .map((d, i) => (i === 0 ? { ...d, currency: 'EUR' } : d));
    const n = pipelineNumbers(ok(FIXTURE.contacts, mixed));
    expect(n.openValue).toBeNull();
    expect(n.openValueMissing).toMatch(/EUR and GBP|GBP and EUR/);
  });

  it('an empty pipeline is zeros, and claims no value', () => {
    const n = pipelineNumbers(ok([], []));
    expect(n).toEqual({
      people: 0, open: 0, won: 0, lost: 0, openValue: null, openValueMissing: null, expected: null, expectedMissing: null,
    });
  });
});
