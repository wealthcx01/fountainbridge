import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A phone saying yes or no to the one push (FB-141).
 *
 * A server action is a public endpoint (FB-127): anyone can call it with any venture id and any
 * object. These pin the refusals — another venture, no session, an address that is not a push
 * service — and that a refusal writes nothing.
 */
const auth = vi.fn();
const loadVentures = vi.fn();
const withVenture = vi.fn();
const rememberPhone = vi.fn();
const forgetPhone = vi.fn();

class NoDatabaseError extends Error {}
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/db', () => ({ withVenture: (id: string, fn: (q: unknown) => unknown) => withVenture(id, fn), NoDatabaseError }));
vi.mock('@/lib/push-store', () => ({
  rememberPhone: (...a: unknown[]) => rememberPhone(...a),
  forgetPhone: (...a: unknown[]) => forgetPhone(...a),
}));

const { subscribeToPush, unsubscribeFromPush } = await import('../push');

const ARCA = { id: 'arca', name: 'ARCA', repos: ['arca'], departments: [], founderEmail: 'founder@bruntsfield.capital', approvalMatrix: [] };
const RESET = { id: 'the-reset', name: 'The Reset', repos: ['the-reset'], departments: [], founderEmail: 'ross@bruntsfield.capital', approvalMatrix: [] };

/** What Chrome's `PushSubscription.toJSON()` really returns. */
const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/dXk3abc:APA91bH',
  expirationTime: null,
  keys: {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STUDIO_ADMIN_EMAILS;
  loadVentures.mockReturnValue([ARCA, RESET]);
  auth.mockResolvedValue({ user: { email: 'founder@bruntsfield.capital' } });
  withVenture.mockImplementation(async (_id: string, fn: (q: unknown) => unknown) => fn({}));
});

describe('saying yes', () => {
  it('keeps the phone under the founder’s own venture', async () => {
    expect(await subscribeToPush('arca', SUB)).toEqual({ ok: true });
    expect(withVenture.mock.calls[0][0]).toBe('arca');
    expect(rememberPhone.mock.calls[0][1]).toBe('founder@bruntsfield.capital');
    expect(rememberPhone.mock.calls[0][2]).toEqual({ endpoint: SUB.endpoint, keys: SUB.keys });
  });

  it('refuses another founder’s venture, and writes nothing', async () => {
    const r = await subscribeToPush('the-reset', SUB);
    expect(r.ok).toBe(false);
    expect(withVenture).not.toHaveBeenCalled();
  });

  it('refuses without a session', async () => {
    auth.mockResolvedValue(null);
    expect((await subscribeToPush('arca', SUB)).ok).toBe(false);
    expect(withVenture).not.toHaveBeenCalled();
  });

  it('refuses an address that is not a real push service — the server is about to post to it', async () => {
    for (const endpoint of ['https://169.254.169.254/latest', 'http://fcm.googleapis.com/x', 'https://evil.test/x']) {
      expect((await subscribeToPush('arca', { ...SUB, endpoint })).ok, endpoint).toBe(false);
    }
    expect((await subscribeToPush('arca', { ...SUB, keys: { p256dh: 'x', auth: SUB.keys.auth } })).ok).toBe(false);
    expect((await subscribeToPush('arca', 'not an object')).ok).toBe(false);
    expect(withVenture).not.toHaveBeenCalled();
  });

  it('says plainly when the studio has nowhere to keep the phone', async () => {
    withVenture.mockRejectedValue(new NoDatabaseError('no DATABASE_URL'));
    const r = await subscribeToPush('arca', SUB);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/nowhere to keep this device/) });
  });
});

describe('turning it off', () => {
  it('forgets the phone under this venture only', async () => {
    expect(await unsubscribeFromPush('arca', SUB.endpoint)).toEqual({ ok: true });
    expect(withVenture.mock.calls[0][0]).toBe('arca');
    expect(forgetPhone.mock.calls[0][1]).toBe(SUB.endpoint);
  });

  it('cannot be used to remove a phone from another founder’s venture', async () => {
    expect((await unsubscribeFromPush('the-reset', SUB.endpoint)).ok).toBe(false);
    expect(withVenture).not.toHaveBeenCalled();
  });
});
