import { wakeAll } from '@/lib/cofounder-service';
import { cofounderDeps } from './deps';

/**
 * The cofounder's timer (FB-201): `POST /api/cofounder` with the wake key, once an hour.
 *
 * Each venture decides for itself whether it is due — its own settings say how often it wakes and
 * when it keeps quiet — so the timer can be simple and frequent. A venture that is switched off, or
 * is waiting on a person, costs one database read and nothing from GitHub.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const r = await wakeAll(cofounderDeps(), req.headers.get('authorization'));
    return Response.json(r.body, { status: r.status });
  } catch (e) {
    console.error('[cofounder] wake failed', { message: (e as Error)?.message });
    return Response.json({ woke: [], reason: 'The studio could not wake its cofounder just now. Nothing was changed; the next wake will try again.' }, { status: 500 });
  }
}
