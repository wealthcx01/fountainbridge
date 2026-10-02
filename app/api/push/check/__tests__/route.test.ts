import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The push timer's door (FB-141). It is outside the sign-in gate, so its own check is the only one.
 */
const loadVentures = vi.fn();
const loadVentureAttention = vi.fn();
const withVenture = vi.fn();
const checkQueue = vi.fn();
const ventureApprovals = vi.fn();

vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/attention', () => ({ loadVentureAttention: (...a: unknown[]) => loadVentureAttention(...a) }));
vi.mock('@/lib/db', () => ({ withVenture: (id: string, fn: (q: unknown) => unknown) => withVenture(id, fn) }));
vi.mock('@/lib/venture-reads', () => ({ ventureApprovals: (...a: unknown[]) => ventureApprovals(...a) }));
vi.mock('@/lib/push-send', () => ({ checkQueue: (...a: unknown[]) => checkQueue(...a) }));

const { POST } = await import('../route');

const SECRET = 'a-long-enough-test-secret';
const req = (auth?: string) => new Request('http://studio/api/push/check', {
  method: 'POST', headers: auth ? { authorization: auth } : {},
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.PUSH_CHECK_SECRET = SECRET;
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  loadVentures.mockReturnValue([{ id: 'arca', name: 'ARCA' }]);
  withVenture.mockImplementation(async (_id, fn) => fn({}));
  checkQueue.mockResolvedValue({ sent: 0 });
  ventureApprovals.mockResolvedValue([]);
});
afterEach(() => {
  delete process.env.PUSH_CHECK_SECRET;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe('who may ring the bell', () => {
  it('refuses a missing or wrong secret, before reading anything', async () => {
    for (const a of [undefined, 'Bearer nope', `Bearer ${SECRET}x`, SECRET]) {
      expect((await POST(req(a))).status).toBe(401);
    }
    expect(loadVentures).not.toHaveBeenCalled();
  });

  it('refuses everyone when no secret is configured, rather than letting everyone in', async () => {
    delete process.env.PUSH_CHECK_SECRET;
    expect((await POST(req('Bearer '))).status).toBe(401);
    expect((await POST(req('Bearer undefined'))).status).toBe(401);
  });

  it('says so loudly when there are no keys to sign with', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const r = await POST(req(`Bearer ${SECRET}`));
    expect(r.status).toBe(503);
  });
});

describe('what it counts', () => {
  it('passes the badge’s number — open work plus sends waiting on the founder — scoped to that venture', async () => {
    // FB-149: the rail's badge counts both. A founder whose only waiting item is a send must still
    // be buzzed when it arrives, and the buzz must count what the badge counts.
    loadVentureAttention.mockResolvedValue({ approvals: [{}, {}, {}], errors: [] });
    ventureApprovals.mockResolvedValue([
      { status: 'proposed' }, { status: 'failed' }, { status: 'executed' }, { status: 'rejected' },
    ]);
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(200);
    expect(withVenture.mock.calls[0][0]).toBe('arca');
    expect(checkQueue.mock.calls[0][2]).toBe(5);
  });

  it('passes "unknown", not zero, when the queue could not be read', async () => {
    loadVentureAttention.mockResolvedValue({ approvals: [], errors: ['arca: GitHub said 502'] });
    await POST(req(`Bearer ${SECRET}`));
    expect(checkQueue.mock.calls[0][2]).toBeNull();
  });

  it('passes "unknown", not zero, when the sends could not be read', async () => {
    loadVentureAttention.mockResolvedValue({ approvals: [{}], errors: [] });
    ventureApprovals.mockRejectedValue(new Error('GitHub said 502'));
    await POST(req(`Bearer ${SECRET}`));
    expect(checkQueue.mock.calls[0][2]).toBeNull();
  });

  it('when exactly one thing waits, names it so the push can open it (FB-179)', async () => {
    loadVentureAttention.mockResolvedValue({
      approvals: [{ repo: 'arca', number: 93, title: 'build: ARCA-061', linkedTicketId: 'ARCA-061' }], errors: [],
    });
    await POST(req(`Bearer ${SECRET}`));
    expect(checkQueue.mock.calls[0][4]).toEqual({
      // The work page, not a ticket address: `ARCA-061` from a branch name may not be the id the
      // ticket was filed under (ARCA files it as `ARCA-61`).
      sole: { kind: 'work', repo: 'arca', number: 93, title: 'build: ARCA-061', ticketId: null },
    });

    checkQueue.mockClear();
    loadVentureAttention.mockResolvedValue({ approvals: [], errors: [] });
    ventureApprovals.mockResolvedValue([{ status: 'executed', repo: 'r', id: 'old' }, { status: 'proposed', repo: 'arca-marketing', id: 'investor-email-oct' }]);
    await POST(req(`Bearer ${SECRET}`));
    expect(checkQueue.mock.calls[0][4]).toEqual({ sole: { kind: 'send', repo: 'arca-marketing', id: 'investor-email-oct' } });
  });

  it('when several wait, names none of them', async () => {
    loadVentureAttention.mockResolvedValue({ approvals: [{ repo: 'arca', number: 1 }, { repo: 'arca', number: 2 }], errors: [] });
    await POST(req(`Bearer ${SECRET}`));
    expect(checkQueue.mock.calls[0][4]).toEqual({ sole: null });
  });
});
