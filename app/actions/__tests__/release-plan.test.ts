import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Releasing a plan the lane stopped to show the founder (FB-122).
 *
 * Before this, nothing anywhere could release a held ticket: the hold marker was written by the lane
 * and no code deleted it. ARCA-054 sat behind that for a week and was eventually done by hand.
 *
 * What is under test is the REFUSALS and their order, which is where the properties live. The write
 * itself is one `putFile`; who is allowed to reach it is the whole question.
 */

const auth = vi.fn();
const loadVentures = vi.fn();
const putFile = vi.fn();
const request = vi.fn();
const getFileContent = vi.fn();

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/github', () => ({
  GitHubClient: class {
    putFile = putFile;
    request = request;
    getFileContent = getFileContent;
  },
}));

const { releasePlan } = await import('../release-plan');

const VENTURE = {
  id: 'arca',
  name: 'ARCA',
  repos: ['arca', 'arca-marketing'],
  founderEmail: 'arca.founder@bruntsfield.capital',
  departments: [
    { id: 'build', repo: 'arca' },
    { id: 'sell', repo: 'arca-marketing' },
  ],
  approvalMatrix: [{ changeClass: 'high-blast-radius', approver: 'founder' }],
};

const TICKET = 'ARCA-054-settings-pricing-keys-route-shadowed';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FOUNDRY_APPROVAL_SECRET = 'test-secret';
  process.env.STUDIO_APPROVAL_GITHUB_TOKEN = 'test-token';
  process.env.STUDIO_ADMIN_EMAILS = 'john.gallagher@wealthcx.com';
  auth.mockResolvedValue({ user: { email: VENTURE.founderEmail } });
  loadVentures.mockReturnValue([VENTURE]);
  putFile.mockResolvedValue(undefined);
  // The ActiveGraph append checks its ref exists before writing; answering keeps the happy path whole.
  request.mockResolvedValue({ object: { sha: 'deadbeef' } });
  getFileContent.mockResolvedValue(null); // no event at this position yet
});

afterEach(() => {
  delete process.env.FOUNDRY_APPROVAL_SECRET;
  delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  delete process.env.STUDIO_ADMIN_EMAILS;
});

describe('who may release a held plan', () => {
  it('lets the founder release their own venture’s work', async () => {
    const r = await releasePlan('arca', 'arca', TICKET);
    expect(r.ok).toBe(true);
    // Two writes, and the order matters: the marker the lane reads first, then the signed event.
    // The lane must be able to proceed even if the history write is the thing that fails.
    expect(putFile).toHaveBeenCalledTimes(2);
    const [repo, path] = putFile.mock.calls[0];
    expect(repo).toContain('arca');
    // The path is the lane's contract. If this changes, the lane stops seeing releases and says
    // nothing about it, so it is asserted rather than left to a comment.
    expect(path).toBe(`approvals/plan-${TICKET}.json`);
  });

  it('writes it to the state ref the lane reads, not to a branch', async () => {
    await releasePlan('arca', 'arca', TICKET);
    expect(putFile.mock.calls[0][2]).toMatchObject({ branch: 'foundry-state' });
  });

  it('refuses someone who is not signed in', async () => {
    auth.mockResolvedValue(null);
    const r = await releasePlan('arca', 'arca', TICKET);
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a venture the signed-in user cannot reach', async () => {
    auth.mockResolvedValue({ user: { email: 'someone.else@bruntsfield.capital' } });
    const r = await releasePlan('arca', 'arca', TICKET);
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a repo this venture does not declare, even for the founder', async () => {
    // Taking the client's word here would write a founder's release into a repository nobody scoped
    // them to. Same reasoning as the external-action gate.
    const r = await releasePlan('arca', 'some-other-repo', TICKET);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('repositories');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a ticket slug that is not one', async () => {
    const r = await releasePlan('arca', 'arca', '../../etc/passwd');
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses when the studio has no write token, rather than failing silently', async () => {
    delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
    const r = await releasePlan('arca', 'arca', TICKET);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not set up/i);
  });

  it('tells the founder plainly when GitHub refused the write', async () => {
    putFile.mockRejectedValue(new Error('403'));
    const r = await releasePlan('arca', 'arca', TICKET);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/could not record/i);
  });
});

describe('what the release says about itself', () => {
  it('records who released it and when', async () => {
    await releasePlan('arca', 'arca', TICKET);
    const body = JSON.parse(putFile.mock.calls[0][2].content);
    expect(body).toMatchObject({ ticket: TICKET, approver: VENTURE.founderEmail });
    expect(typeof body.released_at).toBe('string');
  });

  it('says in the file that it is not evidence anyone approved anything', async () => {
    // The one artefact someone will find later and have to judge. A marker on a ref the lane can
    // write is not proof of a human decision, and the file has to say so or it will be read as one.
    await releasePlan('arca', 'arca', TICKET);
    const body = JSON.parse(putFile.mock.calls[0][2].content);
    expect(body.note).toMatch(/unsigned/i);
    expect(body.note).toMatch(/FB-122/);
  });

  it('still releases when the signed history cannot be written, and says so', async () => {
    // The release is already real at that point. Telling the founder their click did nothing would
    // be the lie; telling them the record is thinner than usual is the truth.
    request.mockRejectedValue(new Error('no ref'));
    const r = await releasePlan('arca', 'arca', TICKET);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/history/i);
  });

  it('is harmless to release twice, and does not report a history failure that is not one', async () => {
    const a = await releasePlan('arca', 'arca', TICKET);
    // Second time round the event position is already taken — which means it was already released,
    // not that anything went wrong. Reporting that as "the studio could not write the history" would
    // send a founder looking for a fault that does not exist.
    getFileContent.mockResolvedValue('{"seq":1}');
    const b = await releasePlan('arca', 'arca', TICKET);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.message).not.toMatch(/could not write/i);
    // Same path, so the second write replaces the first rather than accumulating markers the lane
    // would have to choose between.
    const markerPaths = putFile.mock.calls
      .map((c) => c[1] as string)
      .filter((p) => p.startsWith('approvals/plan-'));
    expect(new Set(markerPaths).size).toBe(1);
  });
});
