import { runStatus } from '@/lib/machine-service';
import { failed, machineDeps, reply } from '../deps';

/**
 * A lane asks how its machine is getting on: `GET /api/machines/<run>?venture=<id>` with its lane
 * key (FB-239). Answering also removes the machine once the run has ended, and fails a run that is
 * past its deadline or whose machine has stopped without a word.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ run: string }> }): Promise<Response> {
  const { run } = await params;
  const venture = new URL(req.url).searchParams.get('venture') ?? '';
  try {
    return reply(await runStatus(machineDeps(), req.headers.get('authorization'), venture, run));
  } catch (e) {
    return failed(e);
  }
}
