import { after } from 'next/server';
import { finishRun, removeAfterFinish } from '@/lib/machine-service';
import { failed, machineDeps, reply, smallJson } from '../../deps';

/**
 * A ticket machine says how the run ended (FB-239), with the run's own token. The studio records it,
 * answers, and then removes the machine — after answering, because removing it ends the very
 * connection the machine is waiting on.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ run: string }> }): Promise<Response> {
  const { run } = await params;
  const body = (await smallJson(req)) as { venture?: unknown } | null;
  const venture = String(body?.venture ?? '');
  try {
    const deps = machineDeps();
    const r = await finishRun(deps, req.headers.get('authorization'), venture, run, body);
    if (r.status === 200) {
      after(() => removeAfterFinish(deps, venture, run).catch((e) => console.error('[machines] removal after finish failed', { message: (e as Error).message })));
    }
    return reply(r);
  } catch (e) {
    return failed(e);
  }
}
