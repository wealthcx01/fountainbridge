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

// --- FB-051: the studio operates on the event log ------------------------------------------------
describe('loadApprovals projects from the event log', () => {
  const venture = { id: 'arca', repos: ['wealthcx01/arca'] } as never;

  const source = (events: unknown[], files: Record<string, unknown> = {}): ApprovalSource => ({
    async listIds() { return ['a1']; },
    async read(_r, _i, file) {
      const json = files[file];
      return json === undefined ? null : { json, sha: `sha-${file}` };
    },
    async readEvents() { return events as never; },
  });

  const proposedEvent = {
    seq: 1, type: 'approval.proposed', at: 't1', actor: { kind: 'lane', id: 'lane' }, causedBy: null,
    summary: 'Send it', department: 'sell',
  };

  it('uses the native log when it is a complete chain, and reports who granted', async () => {
    const [a] = await loadApprovals(venture, source([
      proposedEvent,
      { seq: 2, type: 'approval.granted', at: 't2', actor: { kind: 'founder', id: 'ross@b.capital' }, causedBy: 1 },
    ], { proposal: { summary: 'stale file copy' } }));
    expect(a.status).toBe('granted');
    expect(a.grantedBy).toEqual({ kind: 'founder', id: 'ross@b.capital' });
    expect(a.bridged).toBe(false);
    expect(a.faults).toEqual([]);
  });

  it('REFUSES a machine-forged grant — it never reaches `granted`', async () => {
    const [a] = await loadApprovals(venture, source([
      proposedEvent,
      { seq: 2, type: 'approval.granted', at: 't2', actor: { kind: 'lane', id: 'lane' }, causedBy: 1 },
    ]));
    expect(a.status).toBe('proposed');
    expect(a.grantedBy).toBeNull();
    expect(a.faults.map((f) => f.code)).toContain('non-human-grant');
  });

  it('bridges FB-044 files when there is no event log', async () => {
    const [a] = await loadApprovals(venture, source([], {
      proposal: { summary: 'Send it', department: 'sell' },
      grant: { approver: 'ross@b.capital' },
    }));
    expect(a.status).toBe('granted');
    expect(a.bridged).toBe(true);
  });

  it('prefers the files when the event log opens mid-story (a partial migration)', async () => {
    const [a] = await loadApprovals(venture, source(
      [{ seq: 1, type: 'approval.executing', at: 't', actor: { kind: 'executor', id: 'x' }, causedBy: null }],
      { proposal: { summary: 'Send it' }, grant: { approver: 'ross@b.capital' } },
    ));
    // The truncated log would have projected a fault and lost the proposal + grant entirely.
    expect(a.status).toBe('granted');
    expect(a.bridged).toBe(true);
    expect(a.faults).toEqual([]);
  });

  it('surfaces a failed execution as `failed`, not as "granted" (the v0 misrepresentation)', async () => {
    const [a] = await loadApprovals(venture, source([], {
      proposal: { summary: 'Send it' },
      grant: { approver: 'ross@b.capital' },
      execution: { status: 'failed', reason: 'smtp refused' },
    }));
    expect(a.status).toBe('failed');
    expect(a.outcome).toBe('smtp refused');
  });
});
