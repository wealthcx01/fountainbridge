import { reapAll } from '@/lib/machine-service';
import { failed, machineDeps, reply } from '../deps';

/**
 * The clean-up timer (FB-239): `POST /api/machines/reap` with the reap key, every ten minutes.
 * Removes every ticket machine that has ended or is past its deadline, across every venture, and
 * anything the provider holds that no record accounts for.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    return reply(await reapAll(machineDeps(), req.headers.get('authorization')));
  } catch (e) {
    return failed(e);
  }
}
