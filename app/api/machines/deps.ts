import 'server-only';
import { loadVentures } from '@/lib/ventures';
import { withVenture } from '@/lib/db';
import { GitHubClient } from '@/lib/github';
import { providerFromEnv } from '@/lib/machine-provider';
import type { MachineDeps, Reply } from '@/lib/machine-service';
import type { Querier } from '@/lib/machine-store';

/**
 * The real things the ticket-machine endpoints need (FB-239): the manifests, the studio's database,
 * GitHub, and the provider. Built per request from the studio's own environment — the provider token
 * exists here and nowhere a venture can reach.
 */
export function machineDeps(): MachineDeps {
  const env = process.env;
  return {
    env,
    ventures: loadVentures(),
    provider: providerFromEnv(env),
    withVenture: <T>(id: string, fn: (q: Querier) => Promise<T>) => withVenture(id, (c) => fn(c as unknown as Querier)),
    ticketExists: async (repo, path, ref) => (await new GitHubClient().getFileContent(repo, path, ref)) !== null,
    log: (line) => console.log(`[machines] ${line}`),
  };
}

export const reply = (r: Reply): Response => Response.json(r.body, { status: r.status });

/** Read a JSON body of at most `max` bytes, or null. A public endpoint does not read an unbounded body. */
export async function smallJson(req: Request, max = 256 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > max) return null;
  const text = await req.text().catch(() => '');
  if (!text || text.length > max) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** A database or provider fault, said plainly and without detail an outsider could use. */
export function failed(e: unknown): Response {
  console.error('[machines] request failed', { message: (e as Error)?.message });
  return Response.json({ created: false, reason: 'The studio could not handle this request just now. The next wake will try again.' }, { status: 500 });
}
