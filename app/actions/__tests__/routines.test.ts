import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The routine decision action (FB-047).
 *
 * A routine is a standing instruction to an agent that runs unattended, so what matters here is the
 * ORDER of the checks and the REFUSALS — the same properties the approve action's tests pin, for
 * the same reason. Everything the action touches is mocked at the module boundary.
 */

const auth = vi.fn();
const loadVentures = vi.fn();
const getFileWithSha = vi.fn();
const putFile = vi.fn();

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/github', () => ({
  GitHubClient: class {
    getFileWithSha = getFileWithSha;
    putFile = putFile;
  },
}));

const { decideRoutine } = await import('../routines');

const VENTURE = {
  id: 'arca',
  name: 'ARCA',
  repos: ['arca'],
  departments: [],
  founderEmail: 'founder@bruntsfield.capital',
  approvalMatrix: [],
};

const PROPOSED = {
  id: 'weekly-signups',
  title: 'Each week, work the new sign-ups',
  standing_order: 'Read the new sign-ups and draft a follow-up for each.',
  cadence: 'weekly',
  criterion: 'Are there sign-ups since the last run?',
  proposed_by: 'arca',
  proposed_at: '2026-08-19T09:00:00Z',
};

const APPROVED = {
  ...PROPOSED,
  state: 'active',
  approved_at: '2026-08-19T10:00:00Z',
  approved_by: 'founder@bruntsfield.capital',
};

const stored = (record: unknown, sha = 'sha-1') => ({ text: JSON.stringify(record), sha });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STUDIO_APPROVAL_GITHUB_TOKEN = 'write-token';
  process.env.STUDIO_ADMIN_EMAILS = '';
  auth.mockResolvedValue({ user: { email: 'founder@bruntsfield.capital' } });
  loadVentures.mockReturnValue([VENTURE]);
  getFileWithSha.mockResolvedValue(stored(PROPOSED));
  putFile.mockResolvedValue('ok');
});

afterEach(() => {
  delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
});

describe('decideRoutine — who is asking', () => {
  it('refuses a signed-out visitor before reading anything', async () => {
    auth.mockResolvedValue(null);
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(getFileWithSha).not.toHaveBeenCalled();
  });

  it('refuses a venture that is not theirs', async () => {
    auth.mockResolvedValue({ user: { email: 'someone@else.com' } });
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('do not have access');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a repo the venture does not declare', async () => {
    const r = await decideRoutine('arca', 'weekly-signups', 'approve', 'somebody-elses-repo');
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('says plainly when the studio has no write access, rather than failing obscurely', async () => {
    delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('write access');
  });
});

describe('decideRoutine — deciding what the founder actually read', () => {
  it('refuses when the routine changed after the page loaded', async () => {
    getFileWithSha.mockResolvedValue(stored(PROPOSED, 'sha-now'));
    const r = await decideRoutine('arca', 'weekly-signups', 'approve', 'arca', 'sha-when-rendered');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('changed after the page loaded');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('proceeds when the sha still matches', async () => {
    getFileWithSha.mockResolvedValue(stored(PROPOSED, 'sha-1'));
    const r = await decideRoutine('arca', 'weekly-signups', 'approve', 'arca', 'sha-1');
    expect(r.ok).toBe(true);
  });

  it('passes the sha through, so the write cannot clobber a concurrent change', async () => {
    await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(putFile.mock.calls[0][2]).toMatchObject({ sha: 'sha-1' });
  });
});

describe('decideRoutine — the state machine, against what is true now', () => {
  it('records the approver, and only the studio can', async () => {
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(true);
    const written = JSON.parse(putFile.mock.calls[0][2].content);
    expect(written.state).toBe('active');
    expect(written.approved_by).toBe('founder@bruntsfield.capital');
    expect(written.approved_at).toEqual(expect.any(String));
  });

  it('will not approve something already decided', async () => {
    getFileWithSha.mockResolvedValue(stored(APPROVED));
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('already been decided');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('will not pause something that is not running', async () => {
    const r = await decideRoutine('arca', 'weekly-signups', 'pause');
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('pauses a running routine and keeps its approval', async () => {
    getFileWithSha.mockResolvedValue(stored(APPROVED));
    const r = await decideRoutine('arca', 'weekly-signups', 'pause');
    expect(r.ok).toBe(true);
    const written = JSON.parse(putFile.mock.calls[0][2].content);
    expect(written.state).toBe('paused');
    expect(written.approved_at).toBe('2026-08-19T10:00:00Z');
  });

  it('resumes a paused routine', async () => {
    getFileWithSha.mockResolvedValue(stored({ ...APPROVED, state: 'paused' }));
    const r = await decideRoutine('arca', 'weekly-signups', 'resume');
    expect(r.ok).toBe(true);
    expect(JSON.parse(putFile.mock.calls[0][2].content).state).toBe('active');
  });

  it('cannot be talked into turning on a routine nobody approved', async () => {
    // A record on the state ref claiming `paused` with no approval behind it. `fromStored` reads it
    // back as proposed, `resume` refuses it, and the action must not then report success — that is
    // the sequence that would let a lane reach `active` without a founder.
    getFileWithSha.mockResolvedValue(stored({ ...PROPOSED, state: 'paused' }));
    const r = await decideRoutine('arca', 'weekly-signups', 'resume');
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });
});

describe('decideRoutine — when things are missing or broken', () => {
  it('says so when the routine is gone', async () => {
    getFileWithSha.mockResolvedValue(null);
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('no longer exists');
  });

  it('says so when the record cannot be read', async () => {
    getFileWithSha.mockResolvedValue({ text: 'not json', sha: 'sha-1' });
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('does not claim success when the write fails', async () => {
    putFile.mockRejectedValue(new Error('403'));
    const r = await decideRoutine('arca', 'weekly-signups', 'approve');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Could not save');
  });
});
