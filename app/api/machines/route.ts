import { requestMachine } from '@/lib/machine-service';
import { failed, machineDeps, reply, smallJson } from './deps';

/**
 * A venture's lane asks for a temporary machine for one of its own tickets (FB-239).
 *
 * Outside the sign-in gate (`middleware.ts`), because a lane has no session. So this is a public
 * endpoint: `requestMachine` checks the venture's own lane key before anything else, then checks the
 * repository is that venture's, the ticket exists there, the venture has a budget John approved, and
 * the month's spend leaves room. Only then is a machine made, and it is given that venture's
 * credentials and nobody else's.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    return reply(await requestMachine(machineDeps(), req.headers.get('authorization'), await smallJson(req, 16 * 1024)));
  } catch (e) {
    return failed(e);
  }
}
