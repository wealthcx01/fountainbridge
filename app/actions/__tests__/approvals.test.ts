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

const { approveExternalAction } = await import('../approvals');

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

  it('refuses when the proposal no longer exists', async () => {
    getFileWithSha.mockResolvedValue(null);
    expect((await approveExternalAction('the-reset', 'send-1', 'thereset-marketing')).ok).toBe(false);
  });
});
