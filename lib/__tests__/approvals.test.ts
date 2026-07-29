import { describe, it, expect } from 'vitest';
import { loadApprovals, type ApprovalSource } from '../approvals';
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
