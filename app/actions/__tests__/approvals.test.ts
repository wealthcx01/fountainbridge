import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The approve server action (FB-058) — the one click in this product that causes something
 * irreversible to happen to a real person.
 *
 * These tests could not exist before this ticket: `app/` was outside the vitest include, so a file
 * placed here ran zero tests and reported success. The D7 denial, the unconfigured-secret refusal
 * and the repo allowlist were all untested for that reason, and a test that never runs is worse than
 * no test because it reads as reassurance.
 *
 * Everything the action touches is mocked at the module boundary; what is under test is the ORDER
 * and the REFUSALS, which is where the security properties live.
 */

const auth = vi.fn();
const loadVentures = vi.fn();
const getFileWithSha = vi.fn();
const getFileContent = vi.fn();
const putFile = vi.fn();
// FB-071: the ActiveGraph append checks the record's ref exists before writing. Answering it here
// lets the happy path be tested; the test below asserts what happens when it does NOT answer.
const request = vi.fn();

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/github', () => ({
  GitHubClient: class {
    getFileWithSha = getFileWithSha;
    getFileContent = getFileContent;
    putFile = putFile;
    request = request;
  },
}));

const { approveExternalAction, refuseExternalAction } = await import('../approvals');
const { verifyGrant, verifyRefusal } = await import('@/lib/provenance');
const { attestationFor } = await import('@/lib/approval-attestation');

const VENTURE = {
  id: 'the-reset',
  name: 'THE RESET',
  repos: ['thereset-platform'],
  founderEmail: 'ross@bruntsfield.capital',
  departments: [
    { id: 'build', repo: 'thereset-platform' },
    { id: 'sell', repo: 'thereset-marketing' },
  ],
  approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'founder' }],
};

const PROPOSAL = { id: 'send-1', department: 'sell', summary: 'Send it', action_type: 'send' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FOUNDRY_APPROVAL_SECRET = 'test-secret';
  process.env.STUDIO_APPROVAL_GITHUB_TOKEN = 'test-token';
  process.env.STUDIO_ADMIN_EMAILS = 'john@bruntsfield.capital';
  auth.mockResolvedValue({ user: { email: 'ross@bruntsfield.capital' } });
  loadVentures.mockReturnValue([VENTURE]);
  getFileWithSha.mockResolvedValue({ text: JSON.stringify(PROPOSAL), sha: 'sha-current' });
  getFileContent.mockResolvedValue(null);
  putFile.mockResolvedValue(undefined);
  request.mockResolvedValue({ ref: 'refs/heads/foundry-activegraph' });
});

afterEach(() => {
  delete process.env.FOUNDRY_APPROVAL_SECRET;
  delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
});

describe('the proposal the founder saw is the proposal that gets signed', () => {
  it('refuses when the proposal changed between render and click', async () => {
    // The whole point of FB-058. Before this, the action re-read whatever was current and signed
    // that; verification noticed afterwards, which is not the same as it being impossible.
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-the-founder-read');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('changed after the page loaded');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('proceeds when the sha still matches, and records the story as it goes', async () => {
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
    expect(r.ok).toBe(true);

    // Three writes since FB-071: the grant the executor verifies, then the two signed events that
    // make up the history — who asked, and who agreed. The history goes to the STUDIO's repository,
    // never the venture's; the venture ref is the one the proposing lane can write, which is exactly
    // what made the first version of this record prove nothing.
    const paths = putFile.mock.calls.map((c) => `${c[0]} ${c[1]}`);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toContain('approvals/send-1/grant.json');
    expect(paths[1]).toContain('activegraph/the-reset/thereset-marketing/send-1/0001-approval.proposed.json');
    expect(paths[2]).toContain('activegraph/the-reset/thereset-marketing/send-1/0002-approval.granted.json');
    // The claim this whole ticket rests on: the history is NOT in the venture's repository.
    const [grantRepo, proposedRepo, grantedRepo] = putFile.mock.calls.map((c) => c[0]);
    // FB-094: the grant write is addressed by the FULL GitHub name — the bare manifest slug 404ed
    // on the real API, and the attestation it carried could never verify against the executor's
    // `owner/slug` REPO.
    expect(grantRepo).toBe('wealthcx01/thereset-marketing');
    expect(proposedRepo).toBe('wealthcx01/fountainbridge');
    expect(grantedRepo).toBe('wealthcx01/fountainbridge');
  });

  it('files the proposal under its department and action, so ActiveGraph can place it (FB-171)', async () => {
    await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
    const proposed = JSON.parse(putFile.mock.calls[1][2].content);
    expect(proposed.type).toBe('approval.proposed');
    expect(proposed.data).toEqual({
      proposal_sha: 'sha-current', summary: 'Send it', department: 'sell', action_type: 'send',
    });
  });

  it('under an enforcing gate, does not claim a grant with no record will still go out (FB-171)', async () => {
    process.env.ACTIVEGRAPH_GATE = 'enforce';
    try {
      request.mockRejectedValue(new Error('403 Resource not accessible by personal access token'));
      const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
      expect(r.message).toContain('nothing goes out until it is there');
      expect(r.message).not.toContain('nothing else is affected');
    } finally {
      delete process.env.ACTIVEGRAPH_GATE;
    }
  });

  it('still works for a card rendered before this shipped, which has no sha to send', async () => {
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing');
    expect(r.ok).toBe(true);
  });

  it('approves anyway when the history cannot be written, and says so', async () => {
    // The approval is real — the grant is written and the executor verifies it — but the record is
    // incomplete, and the founder is told. FB-051's version reported success while its audit write
    // had silently failed, which is the same class of lie as the composer saying it filed a ticket
    // it had not filed.
    request.mockRejectedValue(new Error('403 Resource not accessible by personal access token'));
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
    expect(r.ok).toBe(true);
    expect(r.message).toContain('could not write it to the history');
    // The grant still landed, and nothing was written to the VENTURE's ref as a fallback — that ref
    // is the one the lane can write, which is exactly what made the first version worthless.
    expect(putFile).toHaveBeenCalledOnce();
    expect(putFile.mock.calls[0][1]).toContain('approvals/send-1/grant.json');
  });
});

describe('who may approve (D7)', () => {
  it('lets the venture founder approve their own product-visible send', async () => {
    expect((await approveExternalAction('the-reset', 'send-1', 'thereset-marketing')).ok).toBe(true);
  });

  it('refuses a signed-in user who is not the approver for this change class', async () => {
    loadVentures.mockReturnValue([{ ...VENTURE, approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'bruntsfield' }] }]);
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('bruntsfield');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a founder reaching for a venture that is not theirs', async () => {
    // Server-side isolation (non-negotiable 6) applies to the write path too, not just the read.
    auth.mockResolvedValue({ user: { email: 'someone@bruntsfield.capital' } });
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('do not have access');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses when nobody is signed in', async () => {
    auth.mockResolvedValue(null);
    expect((await approveExternalAction('the-reset', 'send-1')).ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });
});

describe('the repo the approval lives in', () => {
  it('refuses a repo this venture does not declare', async () => {
    // Client-supplied. Taking its word would write a founder's approval into a repository nobody
    // scoped them to — the attestation binds the repo, so the executor would be safe, but the
    // studio would still have written into someone else's tree.
    const r = await approveExternalAction('the-reset', 'send-1', 'wealthcx01/arca');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('not in one of this venture');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('accepts a department repo, not only the first one', async () => {
    expect((await approveExternalAction('the-reset', 'send-1', 'thereset-marketing')).ok).toBe(true);
    expect(putFile.mock.calls[0][0]).toBe('wealthcx01/thereset-marketing'); // FB-094: GitHub-addressable
  });
});

describe('failing closed', () => {
  it('refuses with no signing secret, rather than writing an unverifiable grant', async () => {
    delete process.env.FOUNDRY_APPROVAL_SECRET;
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('not set up');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses with no write token', async () => {
    delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
    expect((await approveExternalAction('the-reset', 'send-1', 'thereset-marketing')).ok).toBe(false);
  });

  it('refuses an approval id that could escape its directory', async () => {
    const r = await approveExternalAction('the-reset', '../../etc/passwd', 'thereset-marketing');
    expect(r.ok).toBe(false);
    expect(getFileWithSha).not.toHaveBeenCalled();
  });

  it('refuses to re-approve something already actioned', async () => {
    getFileContent.mockImplementation(async (_r: string, path: string) =>
      path.endsWith('execution.json') ? '{"status":"executed"}' : null);
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('already been actioned');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('never approves a send that was refused — the old-tab case the review found', async () => {
    // Refuse for real, then hand back the exact refusal that was written, as GitHub would.
    await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', 'Not this week.');
    const refusal = putFile.mock.calls.find((c) => String(c[1]).endsWith('approvals/send-1/refusal.json'))![2].content;
    putFile.mockClear();
    getFileContent.mockImplementation(async (_r: string, path: string) => (path.endsWith('refusal.json') ? refusal : null));

    // The same proposal, unchanged, approved from a tab that still shows the button.
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('refused by ross@bruntsfield.capital');
    // Nothing signed: no grant means the executor can never send it.
    expect(putFile.mock.calls.some((c) => String(c[1]).endsWith('grant.json')), 'a grant was written over a refusal').toBe(false);
  });

  it('a refusal nobody signed does not block the founder (a lane could write one)', async () => {
    getFileContent.mockImplementation(async (_r: string, path: string) =>
      path.endsWith('refusal.json') ? JSON.stringify({ refused_by: 'ross@bruntsfield.capital', proposal_sha: 'sha-current', attestation: 'forged', note: 'no' }) : null);
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
    expect(r.ok).toBe(true);
  });

  it('a refusal of an earlier version does not block approving the new one', async () => {
    await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', 'Not this week.');
    const refusal = putFile.mock.calls.find((c) => String(c[1]).endsWith('approvals/send-1/refusal.json'))![2].content;
    getFileContent.mockImplementation(async (_r: string, path: string) => (path.endsWith('refusal.json') ? refusal : null));
    getFileWithSha.mockResolvedValue({ text: JSON.stringify(PROPOSAL), sha: 'sha-rewritten' });
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-rewritten');
    expect(r.ok).toBe(true);
  });

  it('refuses when the proposal no longer exists', async () => {
    getFileWithSha.mockResolvedValue(null);
    expect((await approveExternalAction('the-reset', 'send-1', 'thereset-marketing')).ok).toBe(false);
  });
});

/**
 * Refusing a send (FB-183) — the other half of deciding on the send's own page.
 *
 * The refuse button had shipped with no test at all, so "a send can be refused from its own page"
 * was a claim nobody had checked. These hold the properties that matter: the refusal written is one
 * the studio will later READ as a refusal; it is never written over a send that has already gone;
 * and only the person who may decide may refuse.
 */
describe('refusing a send', () => {
  const WHY = 'Not this week — the list is not clean yet.';

  it('writes a refusal the studio will read back as a real, signed refusal', async () => {
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', WHY);
    expect(r.ok).toBe(true);
    const write = putFile.mock.calls.find((c) => String(c[1]).endsWith('approvals/send-1/refusal.json'));
    expect(write, 'no refusal file was written').toBeDefined();
    expect(write![0]).toBe('wealthcx01/thereset-marketing');
    const written = JSON.parse(write![2].content);
    // The round trip: the reader that decides whether a send is closed accepts what was written.
    const read = verifyRefusal('wealthcx01/thereset-marketing', 'send-1', 'sha-current', written, 'test-secret');
    expect(read?.refusedBy).toBe('ross@bruntsfield.capital');
    expect(read?.note).toBe(WHY);
    // And the history records it as a rejection by a human, on the studio's own repository.
    const history = putFile.mock.calls.map((c) => `${c[0]} ${c[1]}`).filter((p) => p.includes('activegraph/'));
    expect(history.some((p) => p.startsWith('wealthcx01/fountainbridge ') && p.endsWith('approval.rejected.json'))).toBe(true);
  });

  it('asks for a reason, because the team has to know what to change', async () => {
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', '  ');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Say why');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('does not refuse a proposal that changed after the founder read it', async () => {
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-the-founder-read', WHY);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('changed after the page loaded');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('never writes a refusal over a send that has already gone out', async () => {
    getFileContent.mockImplementation(async (_r: string, path: string) =>
      path.endsWith('execution.json') ? '{"status":"executed"}' : null);
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', WHY);
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('does not refuse what a named person already approved', async () => {
    const grant = {
      id: 'send-1', repo: 'wealthcx01/thereset-marketing', decision: 'granted',
      approver: 'ross@bruntsfield.capital', proposal_sha: 'sha-current',
      attestation: attestationFor('wealthcx01/thereset-marketing', 'send-1', 'sha-current', 'ross@bruntsfield.capital', 'test-secret'),
    };
    getFileContent.mockImplementation(async (_r: string, path: string) =>
      path.endsWith('grant.json') ? JSON.stringify(grant) : null);
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', WHY);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('already approved by ross@bruntsfield.capital');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('can refuse a send whose approval nobody can vouch for — that is when refusing matters most', async () => {
    // A grant.json the studio cannot verify is not an approval. The founder must still be able to
    // say no to it, or a forged grant would lock them out of their own decision.
    getFileContent.mockImplementation(async (_r: string, path: string) =>
      path.endsWith('grant.json')
        ? JSON.stringify({ approver: 'ross@bruntsfield.capital', attestation: 'forged', proposal_sha: 'sha-current' })
        : null);
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', WHY);
    expect(r.ok).toBe(true);
  });

  it('refuses someone who is not this decision’s approver (D7)', async () => {
    loadVentures.mockReturnValue([{ ...VENTURE, approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'bruntsfield' }] }]);
    const r = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', WHY);
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });
});

/**
 * FB-271: "both must approve" means both.
 *
 * Before this ticket a dual decision — a send, a payment, a secret — was granted by whichever of the
 * founder or Bruntsfield clicked first. The executor sends on a grant it can verify, so one person
 * alone could send. These tests drive the real action against a small in-memory GitHub, so a file
 * written by one click is the file the next click reads, as on the real approvals ref.
 */
describe('a dual decision needs the founder and Bruntsfield (FB-271)', () => {
  const FOUNDER = 'ross@bruntsfield.capital';
  const ADMIN = 'john@bruntsfield.capital';
  const OTHER_ADMIN = 'second.admin@bruntsfield.capital';
  const REPO = 'wealthcx01/thereset-marketing';
  const DUAL = {
    ...VENTURE,
    founderName: 'Ross',
    approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'dual' }],
  };

  // The approvals ref and the studio's record, as one map: `repo:path` → { text, sha }.
  let files: Map<string, { text: string; sha: string }>;
  let blob = 0;
  const key = (repo: string, path: string) => `${repo}:${path}`;
  const read = (path: string) => files.get(key(REPO, path))?.text ?? null;
  const grantWritten = () => putFile.mock.calls.some((c) => c[0] === REPO && String(c[1]).endsWith('grant.json'));
  const as = (email: string) => auth.mockResolvedValue({ user: { email } });
  const approve = () => approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');

  beforeEach(() => {
    files = new Map();
    files.set(key(REPO, 'approvals/send-1/proposal.json'), { text: JSON.stringify(PROPOSAL), sha: 'sha-current' });
    process.env.STUDIO_ADMIN_EMAILS = `${ADMIN},${OTHER_ADMIN}`;
    loadVentures.mockReturnValue([DUAL]);
    getFileWithSha.mockImplementation(async (repo: string, path: string) => files.get(key(repo, path)) ?? null);
    getFileContent.mockImplementation(async (repo: string, path: string) => files.get(key(repo, path))?.text ?? null);
    putFile.mockImplementation(async (repo: string, path: string, p: { content: string; sha?: string }) => {
      const k = key(repo, path);
      // GitHub refuses to replace a file unless you name the version you are replacing.
      if (files.has(k) && p.sha !== files.get(k)!.sha) throw new Error('422 sha does not match');
      files.set(k, { text: p.content, sha: `blob-${++blob}` });
      return files.get(k)!.sha;
    });
  });

  afterEach(() => {
    process.env.STUDIO_ADMIN_EMAILS = 'john@bruntsfield.capital';
  });

  it('the founder alone does not produce a grant, and is told Bruntsfield must approve too', async () => {
    as(FOUNDER);
    const r = await approve();
    expect(r.ok).toBe(true);
    expect(r.waiting).toBe(true);
    expect(r.message).toBe('Approved by you. Waiting for Bruntsfield to approve it too. Nothing goes out until they do.');
    expect(grantWritten(), 'one person produced a grant the executor would send on').toBe(false);
    expect(JSON.parse(read('approvals/send-1/first-approval.json')!)).toMatchObject({
      approver: FOUNDER, proposal_sha: 'sha-current', decision: 'first-approval',
    });
  });

  it('Bruntsfield alone does not produce a grant, and is told the founder must approve too', async () => {
    as(ADMIN);
    const r = await approve();
    expect(r.ok).toBe(true);
    expect(r.message).toBe('Approved by you. Waiting for Ross, the founder, to approve it too. Nothing goes out until they do.');
    expect(grantWritten()).toBe(false);
  });

  it('someone who is both the founder and an admin counts once, not twice', async () => {
    // One address in both roles is one person. They fill one half, and a second click from them
    // must not fill the other.
    loadVentures.mockReturnValue([{ ...DUAL, founderEmail: ADMIN }]);
    as(ADMIN);
    const first = await approve();
    expect(first.message).toContain('Waiting for someone else at Bruntsfield');
    const again = await approve();
    expect(again.ok).toBe(false);
    expect(grantWritten()).toBe(false);
    // A different admin completes it.
    as(OTHER_ADMIN);
    expect((await approve()).ok).toBe(true);
    expect(grantWritten()).toBe(true);
  });

  it('the same person approving twice does not produce a grant', async () => {
    as(FOUNDER);
    await approve();
    const r = await approve();
    expect(r.ok).toBe(false);
    expect(r.message).toBe('You have already approved this. It is waiting for Bruntsfield to approve it too. Nothing goes out until they do.');
    expect(grantWritten()).toBe(false);
  });

  it('two people from Bruntsfield are still only one side', async () => {
    as(ADMIN);
    await approve();
    as(OTHER_ADMIN);
    const r = await approve();
    expect(r.ok).toBe(false);
    expect(r.message).toBe(`${ADMIN} has already approved this for Bruntsfield. It now needs Ross, the founder, to approve it.`);
    expect(grantWritten()).toBe(false);
  });

  for (const [firstWho, secondWho] of [[FOUNDER, ADMIN], [ADMIN, FOUNDER]]) {
    it(`grants once both have approved: ${firstWho} first, then ${secondWho}`, async () => {
      as(firstWho);
      await approve();
      as(secondWho);
      const r = await approve();
      expect(r.ok).toBe(true);
      expect(r.waiting).toBeUndefined();
      expect(r.message).toContain(`Approved by you and ${firstWho}.`);

      // The grant is the one the executor already knows how to check: unchanged format, signed for
      // the second approver, and it verifies.
      const grant = JSON.parse(read('approvals/send-1/grant.json')!);
      expect(verifyGrant(REPO, 'send-1', 'sha-current', grant, 'test-secret')).toMatchObject({
        provenance: 'attested', approver: secondWho,
      });
      expect(grant.first_approver).toBe(firstWho);
      // And the signed record names both people.
      const granted = [...files.entries()].find(([k]) => k.endsWith('approval.granted.json'));
      expect(granted, 'no approval.granted event was written').toBeDefined();
      const event = JSON.parse(granted![1].text);
      expect(event.actor.id).toBe(secondWho);
      expect(event.data.first_approver).toBe(firstWho);
    });
  }

  it('a first approval a lane wrote (no real signature) does not count as half', async () => {
    files.set(key(REPO, 'approvals/send-1/first-approval.json'), {
      sha: 'blob-lane',
      text: JSON.stringify({
        approver: FOUNDER, proposal_sha: 'sha-current', approved_at: '2026-10-28T09:00:00Z', attestation: 'f'.repeat(64),
      }),
    });
    as(ADMIN);
    const r = await approve();
    expect(r.waiting).toBe(true);
    expect(grantWritten()).toBe(false);
    // The forged file was replaced with Bruntsfield's real first half.
    expect(JSON.parse(read('approvals/send-1/first-approval.json')!).approver).toBe(ADMIN);
  });

  it('a first approval renamed to grant.json does not verify as a grant, here or in the executor', async () => {
    as(FOUNDER);
    await approve();
    const half = JSON.parse(read('approvals/send-1/first-approval.json')!);
    // The studio's own check.
    expect(verifyGrant(REPO, 'send-1', 'sha-current', half, 'test-secret').provenance).toBe('unattested');
    // The executor's formula, recomputed exactly as executor.mjs does.
    const { createHmac } = await import('node:crypto');
    // @ts-expect-error — the executor is untyped .mjs, loaded as-is so this checks the real formula
    const { expectedAttestation } = await import('../../../deploy/executor/executor-lib.mjs');
    expect(expectedAttestation(createHmac, 'test-secret', REPO, 'send-1', 'sha-current', half.approver)).not.toBe(half.attestation);
    // And the studio does not treat it as "already approved" either: Bruntsfield can still decide.
    files.set(key(REPO, 'approvals/send-1/grant.json'), { text: JSON.stringify(half), sha: 'blob-renamed' });
    files.delete(key(REPO, 'approvals/send-1/first-approval.json'));
    as(ADMIN);
    const r = await approve();
    expect(r.waiting).toBe(true);
  });

  it('a changed proposal voids the first approval: both approve the version that goes out', async () => {
    as(FOUNDER);
    await approve();
    files.set(key(REPO, 'approvals/send-1/proposal.json'), { text: JSON.stringify(PROPOSAL), sha: 'sha-rewritten' });
    as(ADMIN);
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-rewritten');
    expect(r.waiting).toBe(true);
    expect(grantWritten()).toBe(false);
  });

  it('one "no" is enough: either side may refuse alone, and that closes it', async () => {
    as(FOUNDER);
    await approve();
    as(ADMIN);
    const refused = await refuseExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current', 'Not this list.');
    expect(refused.ok).toBe(true);
    as(FOUNDER);
    const r = await approve();
    expect(r.ok).toBe(false);
    expect(r.message).toContain(`refused by ${ADMIN}`);
    expect(grantWritten()).toBe(false);
  });

  it('a Bruntsfield-only decision is still granted by one admin, as before', async () => {
    loadVentures.mockReturnValue([{ ...DUAL, approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'bruntsfield' }] }]);
    as(ADMIN);
    const r = await approve();
    expect(r.ok).toBe(true);
    expect(r.waiting).toBeUndefined();
    expect(grantWritten()).toBe(true);
    expect(read('approvals/send-1/first-approval.json')).toBeNull();
  });

  it('a founder-only decision is still granted by the founder alone, as before', async () => {
    loadVentures.mockReturnValue([{ ...DUAL, approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'founder' }] }]);
    as(FOUNDER);
    const r = await approve();
    expect(r.ok).toBe(true);
    expect(grantWritten()).toBe(true);
  });
});
