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

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/github', () => ({
  GitHubClient: class {
    getFileWithSha = getFileWithSha;
    getFileContent = getFileContent;
    putFile = putFile;
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

  it('proceeds when the sha still matches', async () => {
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing', 'sha-current');
    expect(r.ok).toBe(true);
    expect(putFile).toHaveBeenCalledOnce();
  });

  it('still works for a card rendered before this shipped, which has no sha to send', async () => {
    const r = await approveExternalAction('the-reset', 'send-1', 'thereset-marketing');
    expect(r.ok).toBe(true);
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
    expect(putFile.mock.calls[0][0]).toBe('thereset-marketing');
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
