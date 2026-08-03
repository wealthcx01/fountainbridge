/**
 * Is the running studio wired to its ventures? (FB-087)
 *
 * `/api/health` stays public and deliberately dumb — Railway's healthcheck pings it, and a studio
 * that reported itself unhealthy because a venture's box was down would refuse to deploy over a
 * fault it is not responsible for. Liveness and readiness are different questions.
 *
 * This route answers the second one, and it is **admin-only**. The information is mild — venture ids
 * and hosts are already in a public repository — but "which of these is misconfigured" is a map of
 * where to push, and it is not something a founder needs. Never the key itself: `keySet` is a
 * boolean (see lib/readiness).
 *
 * `?probe=1` additionally asks each venture's box whether it answers, which is the only way to catch
 * a key that is set but wrong — the failure this whole ticket exists because of was one variable
 * away from that. Off by default: it makes N network calls and the config check is what usually
 * matters.
 */
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, parseAdminEmails } from '@/lib/authz';
import { readiness, keyEnvName } from '@/lib/readiness';
import { composerEndpoint } from '@/lib/composer';

export const dynamic = 'force-dynamic';

/** Does the box answer with this key? Never throws — a probe that crashes the report is useless. */
async function probeBox(host: string, key: string): Promise<{ reachable: boolean; detail: string }> {
  const endpoint = composerEndpoint(host);
  if (!endpoint) return { reachable: false, detail: 'no box' };
  try {
    const res = await fetch(`${endpoint}/api/agents/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (res.ok) return { reachable: true, detail: 'answers' };
    // 401 is the interesting one: the box is up and rejecting the studio's key, which looks
    // identical to "working" from every check that does not actually authenticate.
    return {
      reachable: false,
      detail: res.status === 401
        ? 'the box rejected the studio’s key — it is set but wrong, or was revoked'
        : `the box answered ${res.status}`,
    };
  } catch (e) {
    return { reachable: false, detail: e instanceof Error ? e.message : 'unreachable' };
  }
}

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  const ventures = loadVentures();
  const access = email
    ? authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS))
    : null;
  // Non-admins get 403. Signed-out callers never reach this line at all — the auth middleware
  // redirects them to /login first, so an anonymous request gets the sign-in page rather than JSON.
  // Verified against a production build, after an earlier version of this comment claimed a 403 that
  // the middleware makes unreachable. Both paths refuse; only one of them is this one.
  //
  // The `email` branch is still not dead code: it is the guarantee this route holds on its own, so a
  // future middleware change cannot silently turn it into an open endpoint.
  if (!access?.isAdmin) {
    return Response.json({ error: 'admin only' }, { status: 403 });
  }

  const report = readiness(ventures, process.env);
  if (new URL(req.url).searchParams.get('probe') !== '1') {
    return Response.json(report, { status: report.ok ? 200 : 503 });
  }

  const probed = await Promise.all(
    report.ventures.map(async (v) => {
      if (!v.host || !v.keySet) return { ...v, probe: null };
      const probe = await probeBox(v.host, process.env[keyEnvName(v.id)] ?? '');
      return {
        ...v,
        probe,
        ready: v.ready && probe.reachable,
        problem: probe.reachable ? v.problem : `${v.id}: ${probe.detail}`,
      };
    }),
  );
  const ok = probed.every((v) => v.ready);
  return Response.json({ ok, ventures: probed }, { status: ok ? 200 : 503 });
}
