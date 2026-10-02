'use server';

import { requireVenture } from '@/lib/venture-access';
import { withVenture, NoDatabaseError } from '@/lib/db';
import { rememberPhone, forgetPhone } from '@/lib/push-store';
import { isPushEndpoint, type PushTarget } from '@/lib/webpush';

/**
 * A founder's phone saying yes, or no, to the one push (FB-141).
 *
 * A server action is a public endpoint (the FB-127 lesson): anyone can call it with anything. So the
 * venture is checked against the session on the server, the subscription is checked to be the shape a
 * real browser produces, and its address must be a real push service — the studio is about to POST
 * to it. The row is written inside `withVenture`, so the database itself pins it to this venture.
 */
export type PushResult = { ok: true } | { ok: false; message: string };

const KEY = /^[A-Za-z0-9_-]{16,200}$/;

function asTarget(raw: unknown): PushTarget | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof s.endpoint !== 'string' || s.endpoint.length > 1000 || !isPushEndpoint(s.endpoint)) return null;
  const p256dh = s.keys?.p256dh;
  const auth = s.keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !KEY.test(p256dh) || !KEY.test(auth)) return null;
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

const NO_STORE = 'The studio has nowhere to keep this device yet, so it cannot send you notifications. Nothing was saved.';

export async function subscribeToPush(ventureId: string, subscription: unknown): Promise<PushResult> {
  const access = await requireVenture(ventureId);
  if (!access.ok) return { ok: false, message: access.error };
  const target = asTarget(subscription);
  if (!target) return { ok: false, message: 'Your browser gave the studio an address it does not recognise. Nothing was saved.' };
  try {
    await withVenture(ventureId, (q) => rememberPhone(q, access.email, target));
    return { ok: true };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { ok: false, message: NO_STORE };
    console.error('[push] could not save a subscription', { venture: ventureId, message: (e as Error).message });
    return { ok: false, message: 'The studio could not save this device just now. Try again in a minute.' };
  }
}

export async function unsubscribeFromPush(ventureId: string, endpoint: unknown): Promise<PushResult> {
  const access = await requireVenture(ventureId);
  if (!access.ok) return { ok: false, message: access.error };
  if (typeof endpoint !== 'string' || !isPushEndpoint(endpoint)) return { ok: true }; // nothing of ours to remove
  try {
    await withVenture(ventureId, (q) => forgetPhone(q, endpoint));
    return { ok: true };
  } catch (e) {
    if (e instanceof NoDatabaseError) return { ok: true };
    console.error('[push] could not remove a subscription', { venture: ventureId, message: (e as Error).message });
    return { ok: false, message: 'Notifications are off on this device, but the studio could not confirm it. Press again in a minute.' };
  }
}
