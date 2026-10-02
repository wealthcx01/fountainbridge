import { startRun } from '@/lib/machine-service';
import { failed, machineDeps, reply, smallJson } from '../../deps';

/**
 * A ticket machine collects its work, once (FB-239): `POST /api/machines/<run>/start` with
 * `{ "venture": "<id>" }` and the run's own token. The answer carries this venture's credentials,
 * which is why the token is good for exactly one collection and names exactly one venture and run.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ run: string }> }): Promise<Response> {
  const { run } = await params;
  const body = (await smallJson(req, 4 * 1024)) as { venture?: unknown } | null;
  try {
    return reply(await startRun(machineDeps(), req.headers.get('authorization'), String(body?.venture ?? ''), run));
  } catch (e) {
    return failed(e);
  }
}
