import { timingSafeEqual } from 'node:crypto';
import { loadVentures } from '@/lib/ventures';
import { loadVentureAttention } from '@/lib/attention';
import { ventureApprovals } from '@/lib/venture-reads';
import { needsYouCount } from '@/lib/needs-you';
import { withVenture } from '@/lib/db';
import { checkQueue } from '@/lib/push-send';
import { vapidFromEnv } from '@/lib/webpush';

/**
 * The heartbeat that turns "a founder became the blocker" into a buzz (FB-141).
 *
 * The studio only does work when somebody asks it to, and a founder who is the blocker is by
 * definition not looking. So something outside has to ask, on a timer: a scheduled job POSTs here
 * every few minutes with `Authorization: Bearer $PUSH_CHECK_SECRET`. For each venture this reads the
 * queue — the same number the rail's badge shows (`needsYouCount`, FB-149: open work plus the sends
 * waiting on the founder) — compares it with last time, and pushes on the one transition the design
 * allows.
 *
 * Excluded from the sign-in gate in `middleware.ts` because a timer has no session; this checks its
 * own secret first, before anything else, and answers 401 with nothing in it otherwise.
 *
 * What it returns names counts and venture ids and nothing about any work — the same rule as the push.
 */
export const dynamic = 'force-dynamic';

function authorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function POST(req: Request): Promise<Response> {
  if (!authorised(req.headers.get('authorization'), process.env.PUSH_CHECK_SECRET?.trim())) {
    return Response.json({ error: 'not authorised' }, { status: 401 });
  }
  const keys = vapidFromEnv();
  if (!keys) {
    // Loud, not silent (CLAUDE.md #10): a timer that runs happily against a studio with no keys is a
    // founder who believes their phone will buzz and it never does.
    return Response.json({ error: 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set, so no push can be sent.' }, { status: 503 });
  }

  const results: Record<string, unknown> = {};
  for (const venture of loadVentures()) {
    try {
      const waiting = await waitingNow(venture);
      const r = await withVenture(venture.id, (q) => checkQueue(q, venture, waiting, keys));
      results[venture.id] = r;
    } catch (e) {
      console.error('[push] check failed', { venture: venture.id, message: (e as Error).message });
      results[venture.id] = { error: 'could not check this venture' };
    }
  }
  return Response.json({ checked: results });
}

/**
 * The badge's number for one venture, read fresh — or `null` when any part of it could not be read.
 *
 * `refresh`: the cached queue can be two minutes old, and a timer asking every few minutes would
 * otherwise read its own stale answer half the time. A queue the studio could not fully read is not a
 * number; see `checkQueue` for why it must never be treated as zero.
 */
async function waitingNow(venture: Parameters<typeof loadVentureAttention>[0]): Promise<number | null> {
  try {
    const [attention, approvals] = await Promise.all([
      loadVentureAttention(venture, { refresh: true }),
      ventureApprovals(venture),
    ]);
    if (attention.errors.length > 0) return null;
    return needsYouCount(attention.approvals.length, approvals);
  } catch {
    return null;
  }
}
