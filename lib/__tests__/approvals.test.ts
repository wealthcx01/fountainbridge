import { describe, it, expect } from 'vitest';
import { loadApprovals, attachEnvelopeChecks, type ApprovalSource } from '../approvals';
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

describe('attachEnvelopeChecks', () => {
  const envelope = { department: 'sell', limitMinor: 480_000, currency: 'GBP', period: 'monthly' as const };
  const NOW = new Date('2026-07-15T12:00:00Z');
  const approval = (over: Record<string, unknown> = {}) => ({
    id: 'a1', kind: 'activegraph', ventureId: 'arca', repo: 'r', status: 'proposed',
    proposalSha: 's', ticket: null, department: 'sell', actionType: 'send', summary: 'Send',
    checks: [{ name: 'no PII', passed: true }], amountMinor: 200_000, priceUnreadable: false,
    currency: 'GBP', committedAt: null, studioChecks: [], outcome: null, ...over,
  }) as never;

  it('puts the studio check in studioChecks, never mixed with the proposer’s own', () => {
    const [a] = attachEnvelopeChecks([approval()], [envelope], new Set(['sell']), NOW);
    expect(a.checks).toHaveLength(1);                    // the lane's claim, untouched
    expect(a.studioChecks).toHaveLength(1);
    expect(a.studioChecks[0].name).toBe('sell budget envelope');
  });

  it('fails closed on a department the venture does not declare', () => {
    const [a] = attachEnvelopeChecks([approval({ department: 'marketing' })], [envelope], new Set(['sell']), NOW);
    expect(a.studioChecks[0]).toMatchObject({ passed: false });
    expect(a.studioChecks[0].detail).toMatch(/not a department/);
  });

  it('counts sibling queued proposals, so a split spend cannot hide', () => {
    const many = Array.from({ length: 5 }, (_, i) => approval({ id: `a${i}`, amountMinor: 200_000 }));
    const [first] = attachEnvelopeChecks(many, [envelope], new Set(['sell']), NOW);
    expect(first.studioChecks[0].detail).toContain('if everything queued is approved');
  });
});
