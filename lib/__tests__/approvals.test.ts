import { describe, it, expect } from 'vitest';
import { loadApprovals, attachBudgetDisclosure, toSpends, type ApprovalSource } from '../approvals';
import type { VentureSummary } from '../ventures';

const venture: VentureSummary = {
  id: 'arca', name: 'ARCA', status: 'active', founderName: 'John', founderEmail: 'john@bruntsfield.capital',
  repos: ['arca'], vpsHost: null, departments: [], approvalMatrix: [],
};

// In-memory source: id → { proposal, grant, execution } (any omitted = 404/null).
function stub(data: Record<string, { proposal?: unknown; grant?: unknown; execution?: unknown }>): ApprovalSource {
  return {
    async listIds() { return Object.keys(data); },
    async read(_repo, id, file) {
      const j = data[id]?.[file];
      return j === undefined ? null : { json: j, sha: `sha-${id}-${file}` };
    },
  };
}

describe('loadApprovals', () => {
  it('derives status, keeps checks, and sorts proposed-first', async () => {
    const src = stub({
      'a-done': { proposal: { id: 'a-done', summary: 'done one', checks: [] }, grant: { id: 'a-done' }, execution: { status: 'executed', result: { note: 'sent' } } },
      'a-new': { proposal: { id: 'a-new', department: 'sell', action_type: 'send', summary: 'send launch email', checks: [{ name: 'Lawful basis', passed: true, detail: 'soft opt-in' }] } },
      'a-reject': { proposal: { id: 'a-reject', summary: 'bad one' }, grant: { id: 'a-reject' }, execution: { status: 'rejected', reason: 'attestation invalid' } },
    });
    const out = await loadApprovals(venture, src);
    expect(out.map((a) => `${a.id}:${a.status}`)).toEqual(['a-new:proposed', 'a-done:executed', 'a-reject:rejected']);
    const proposed = out.find((a) => a.id === 'a-new')!;
    expect(proposed.department).toBe('sell');
    expect(proposed.checks[0].name).toBe('Lawful basis');
    expect(proposed.proposalSha).toBe('sha-a-new-proposal');
    expect(out.find((a) => a.id === 'a-reject')!.outcome).toBe('attestation invalid');
  });

  it('ignores an id with no proposal (a grant with no proposal is not an approval)', async () => {
    const out = await loadApprovals(venture, stub({ orphan: { grant: { id: 'orphan' } } }));
    expect(out).toEqual([]);
  });

  it('returns [] for a venture with no repo', async () => {
    expect(await loadApprovals({ ...venture, repos: [] }, stub({}))).toEqual([]);
  });
});

// --- FB-054 rework: agent-supplied inputs are validated at the boundary -------------------------
describe('a proposal cannot exempt itself by malforming its price', () => {
  const venture = { id: 'arca', repos: ['wealthcx01/arca'] } as never;
  const src = (proposals: Record<string, unknown>): ApprovalSource => ({
    async listIds() { return Object.keys(proposals); },
    async read(_r, id, file) {
      return file === 'proposal' ? { json: proposals[id], sha: `sha-${id}` } : null;
    },
  });

  it('keeps "no price" and "unreadable price" distinct, and never coerces to zero', async () => {
    const out = await loadApprovals(venture, src({
      float: { amount_minor: 5200.5 },
      str: { amount_minor: '520000' },
      neg: { amount_minor: -1 },
      none: {},
      ok: { amount_minor: 520_000, currency: 'gbp' },
    }));
    const by = Object.fromEntries(out.map((a) => [a.id, a]));
    for (const id of ['float', 'str', 'neg']) {
      expect(by[id].amountMinor, id).toBeNull();
      expect(by[id].priceUnreadable, id).toBe(true); // → a FAILING check, not a vanished one
    }
    expect(by.none.amountMinor).toBeNull();
    expect(by.none.priceUnreadable).toBe(false);     // genuinely free
    expect(by.ok.amountMinor).toBe(520_000);
    expect(by.ok.currency).toBe('GBP');              // normalised, so "gbp" cannot dodge comparison
  });

  it('rejects a currency that is not a currency', async () => {
    const out = await loadApprovals(venture, src({ a: { currency: 'pounds' }, b: { currency: 42 } }));
    for (const a of out) expect(a.currency).toBeNull();
  });
});

describe('attachBudgetDisclosure + toSpends wiring', () => {
  const envelope = { department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'monthly' as const };
  const NOW = new Date('2026-07-15T12:00:00Z');
  const approval = (over: Record<string, unknown> = {}) => ({
    id: 'a1', kind: 'activegraph', ventureId: 'arca', repo: 'r', status: 'proposed',
    proposalSha: 's', ticket: null, department: 'sell', actionType: 'send', summary: 'Send',
    checks: [], amountMinor: 200_000, priceUnreadable: false,
    currency: 'GBP', committedAt: null, budget: null, outcome: null, ...over,
  }) as never;

  it('discloses against the department’s limit, including this proposal', () => {
    const [a] = attachBudgetDisclosure([approval()], [envelope], new Set(['sell']), NOW);
    expect(a.budget).toMatchObject({ department: 'sell', limitMinor: 480_000, reportedMinor: 200_000 });
  });

  it('discloses nothing for an unknown department or an approval past the gate', () => {
    expect(attachBudgetDisclosure([approval({ department: 'marketing' })], [envelope], new Set(['sell']), NOW)[0].budget).toBeNull();
    expect(attachBudgetDisclosure([approval({ status: 'granted' })], [envelope], new Set(['sell']), NOW)[0].budget).toBeNull();
  });

  it('counts siblings queued in the same department, and not other departments', () => {
    const [a] = attachBudgetDisclosure([
      approval({ id: 'a', amountMinor: 200_000 }),
      approval({ id: 'b', amountMinor: 300_000 }),
      approval({ id: 'c', department: 'scale', amountMinor: 900_000 }),
    ], [envelope], new Set(['sell', 'scale']), NOW);
    // Its own 200k as pending, its sibling's 300k as queued. It must NOT count itself twice, and
    // the scale proposal belongs to another department.
    expect(a.budget).toMatchObject({ reportedMinor: 200_000, queuedMinor: 300_000 });
  });

  // The wiring below was deletable under mutation: the units were tested, the connections were not.
  it('toSpends carries the unreadable-price flag onto the spend', () => {
    const s = toSpends([approval({ status: 'granted', amountMinor: null, priceUnreadable: true })]);
    expect(s[0].uncountable).toBe('unreadable-price');
  });

  it('toSpends carries committedAt onto the spend, so windowing is real', () => {
    const s = toSpends([approval({ status: 'granted', committedAt: '2026-06-20T00:00:00Z' })]);
    expect(s[0].at).toBe('2026-06-20T00:00:00Z');
  });
});
