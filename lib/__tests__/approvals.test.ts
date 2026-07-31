import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';
import { loadApprovals, type ApprovalSource } from '../approvals';
import { attestationFor } from '../approval-attestation';
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
  // These grants carry no valid attestation (they predate FB-051's verification), so a terminal
  // execution behind one now reads `unverified-action` rather than a clean outcome — the studio will
  // not report a finished external action it cannot tie to a human.
  it('derives status, keeps checks, and sorts unverifiable + waiting items first', async () => {
    const src = stub({
      'a-done': { proposal: { id: 'a-done', summary: 'done one', checks: [] }, grant: { id: 'a-done' }, execution: { status: 'executed', result: { note: 'sent' } } },
      'a-new': { proposal: { id: 'a-new', department: 'sell', action_type: 'send', summary: 'send launch email', checks: [{ name: 'Lawful basis', passed: true, detail: 'soft opt-in' }] } },
      'a-reject': { proposal: { id: 'a-reject', summary: 'bad one' }, grant: { id: 'a-reject' }, execution: { status: 'rejected', reason: 'attestation invalid' } },
    });
    const out = await loadApprovals(venture, src);
    expect(out.map((a) => `${a.id}:${a.status}`)).toEqual(['a-done:unverified-action', 'a-reject:unverified-action', 'a-new:proposed']);
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
  const REPO = 'wealthcx01/arca';
  const venture = { id: 'arca', repos: [REPO] } as never;
  const sign = (id: string, sha: string, approver: string) => attestationFor(REPO, id, sha, approver, SECRET);
  const goodGrant = (id = 'a1', sha = 'sha-proposal', approver = 'ross@b.capital') =>
    ({ approver, proposal_sha: sha, attestation: sign(id, sha, approver), granted_at: '2026-07-30T11:00:00Z' });

  const source = (files: Record<string, unknown>): ApprovalSource => ({
    async listIds() { return ['a1']; },
    async read(_r, _i, file) {
      return files[file] === undefined ? null : { json: files[file], sha: 'sha-proposal' };
    },
  });

  it('shows an attested grant as granted, naming the human', async () => {
    const [a] = await loadApprovals(venture, source({ proposal: { summary: 'Send it' }, grant: goodGrant() }), undefined, SECRET);
    expect(a.status).toBe('granted');
    expect(a.grantProvenance).toBe('attested');
    expect(a.provenance?.text).toContain('ross@b.capital');
    expect(a.provenance?.text).toContain('30 July 2026');
  });

  it('does NOT show a lane-forged grant as granted', async () => {
    const [a] = await loadApprovals(venture, source({
      proposal: { summary: 'Send it' },
      grant: { approver: 'john@bruntsfield.capital', proposal_sha: 'sha-proposal', attestation: 'forged' },
    }), undefined, SECRET);
    expect(a.status).toBe('proposed');
    expect(a.grantProvenance).toBe('unattested');
    expect(a.provenance?.nextStep).toContain('Tell Bruntsfield');
  });

  it('will not report a completed action that no verifiable human approved', async () => {
    // Forging a grant gets a red warning, so DELETING one must not buy silence: a lane could
    // otherwise write proposal + execution directly and have the studio report a finished external
    // action naming nobody.
    const [a] = await loadApprovals(venture, source({
      proposal: {}, execution: { status: 'executed', reason: 'sent' },
    }), undefined, SECRET);
    expect(a.status).toBe('unverified-action');
  });

  it('reports a failed execution as failed when the grant is real', async () => {
    const [a] = await loadApprovals(venture, source({
      proposal: {}, grant: goodGrant(), execution: { status: 'failed', reason: 'smtp refused' },
    }), undefined, SECRET);
    expect(a.status).toBe('failed');
    expect(a.outcome).toBe('smtp refused');
  });

  it('IGNORES founder-visible fields a lane writes into grant.json or execution.json', async () => {
    // The criterion this branch exists for: display and attestation must describe the same artefact.
    // A fixture containing only a proposal cannot tell "read from the proposal" from "read from
    // anywhere, falling back to the proposal" — so the other files carry conflicting values.
    const [a] = await loadApprovals(venture, source({
      proposal: { summary: 'Reply to Jane', department: 'sell', ticket: 'ARCA-004', action_type: 'send' },
      grant: { ...goodGrant(), summary: 'Blast 4,000 purchased addresses', department: 'ops', ticket: 'X', action_type: 'deploy' },
      execution: { summary: 'something else entirely', status: 'executing' },
    }), undefined, SECRET);
    expect(a.summary).toBe('Reply to Jane');
    expect(a.department).toBe('sell');
    expect(a.ticket).toBe('ARCA-004');
    expect(a.actionType).toBe('send');
  });

  it('says it cannot verify when the studio has no secret — independent of the environment', async () => {
    // `loadApprovals(v, s, undefined, undefined)` does NOT pass undefined: a JS default parameter
    // fires, so the old test read process.env and went red the moment FOUNDRY_APPROVAL_SECRET was
    // set — which is exactly the next thing that happens to this studio.
    vi.stubEnv('FOUNDRY_APPROVAL_SECRET', '');
    const [a] = await loadApprovals(venture, source({ proposal: {}, grant: goodGrant() }));
    expect(a.grantProvenance).toBe('unattested');
    expect(a.provenance?.text).toContain('not set up to check approvals');
    vi.unstubAllEnvs();
  });

  it('reads the secret from the environment when none is passed', async () => {
    vi.stubEnv('FOUNDRY_APPROVAL_SECRET', SECRET);
    const [a] = await loadApprovals(venture, source({ proposal: {}, grant: goodGrant() }));
    expect(a.grantProvenance).toBe('attested');
    vi.unstubAllEnvs();
  });
});
