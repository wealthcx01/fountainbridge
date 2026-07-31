import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
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

// --- FB-051 (narrowed): the studio shows what it can prove ---------------------------------------
describe('loadApprovals verifies the grant rather than trusting the file', () => {
  const SECRET = 'studio-signing-secret';
  const venture = { id: 'arca', repos: ['wealthcx01/arca'] } as never;
  const sign = (id: string, sha: string, approver: string) =>
    createHmac('sha256', SECRET).update(`${id}|${sha}|${approver.toLowerCase()}`).digest('hex');

  const source = (files: Record<string, unknown>): ApprovalSource => ({
    async listIds() { return ['a1']; },
    async read(_r, _i, file) {
      return files[file] === undefined ? null : { json: files[file], sha: 'sha-proposal' };
    },
  });

  it('shows an attested grant as granted, naming the human', async () => {
    const [a] = await loadApprovals(venture, source({
      proposal: { summary: 'Send it', department: 'sell' },
      grant: { approver: 'ross@b.capital', proposal_sha: 'sha-proposal', attestation: sign('a1', 'sha-proposal', 'ross@b.capital'), granted_at: 't' },
    }), undefined, SECRET);
    expect(a.status).toBe('granted');
    expect(a.grantProvenance).toBe('attested');
    expect(a.grantedBy).toBe('ross@b.capital');
  });

  it('does NOT show a lane-forged grant as granted', async () => {
    // The forgery the previous design accepted: a grant file naming a human, with no valid HMAC.
    const [a] = await loadApprovals(venture, source({
      proposal: { summary: 'Send it' },
      grant: { approver: 'john@bruntsfield.capital', attestation: 'forged' },
    }), undefined, SECRET);
    expect(a.status).toBe('proposed');           // still awaiting a real approval
    expect(a.grantProvenance).toBe('unattested');
    expect(a.grantedBy).toBeNull();
    expect(a.provenanceNote).toMatch(/Treat it as unapproved/);
  });

  it('reports a failed execution as failed, not as granted', async () => {
    // v0's file-presence inference had no `failed` case, so an errored send showed as approved.
    const [a] = await loadApprovals(venture, source({
      proposal: {}, grant: {}, execution: { status: 'failed', reason: 'smtp refused' },
    }), undefined, SECRET);
    expect(a.status).toBe('failed');
    expect(a.outcome).toBe('smtp refused');
  });

  it('renders every founder-visible field from the sha-pinned proposal', async () => {
    // Display and attestation must describe the SAME artefact: the previous design rendered the
    // summary from a lane-written event while the attestation pinned the proposal, so the founder
    // could approve one document and the executor send another.
    const [a] = await loadApprovals(venture, source({
      proposal: { summary: 'Reply to Jane', department: 'sell', ticket: 'ARCA-004' },
    }), undefined, SECRET);
    expect(a.summary).toBe('Reply to Jane');
    expect(a.department).toBe('sell');
    expect(a.ticket).toBe('ARCA-004');
    expect(a.proposalSha).toBe('sha-proposal');
  });

  it('says it cannot verify when the studio has no secret', async () => {
    const [a] = await loadApprovals(venture, source({ proposal: {}, grant: { approver: 'x', attestation: 'y' } }), undefined, undefined);
    expect(a.grantProvenance).toBe('unattested');
    expect(a.provenanceNote).toMatch(/no signing secret/);
  });
});
