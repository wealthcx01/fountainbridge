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
import { githubBudget, githubBlockedUntil } from '@/lib/github';
import { composerEndpoint, engineFault } from '@/lib/composer';
import { buildDocumentStore } from '@/lib/document-store';
import { probeRecordWritable } from '@/lib/activegraph-log';

export const dynamic = 'force-dynamic';

// Mirrors the composer route's constant (same env, same default) — the probe must exercise the
// agent the founder's messages actually go to, or it certifies a different door than the one in use.
const PROBE_AGENT = process.env.COMPOSER_AGENT_ID ?? 'agent_foundry_composer';

/**
 * Does the box actually ANSWER A MESSAGE with this key? Never throws — a probe that crashes the
 * report is useless.
 *
 * FB-095 turned this from `GET /models` into a real one-message completion. The composer failure it
 * missed: the agent's effective context budget was smaller than its own tool definitions, so every
 * founder message died with a raw engine error — while `/models` kept answering 200 and this probe
 * kept certifying the venture ready. "Ready" has to mean "a message round-trips"; anything less
 * re-opens the FB-087 gap one layer up.
 */
async function probeBox(host: string, key: string): Promise<{ reachable: boolean; detail: string }> {
  const endpoint = composerEndpoint(host);
  if (!endpoint) return { reachable: false, detail: 'no box' };
  try {
    const res = await fetch(`${endpoint}/api/agents/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      // One tiny turn, no stream. The agent may still think/tool-call, hence the longer timeout —
      // this only runs behind an explicit admin `?probe=1`, so the cost is deliberate.
      body: JSON.stringify({
        model: PROBE_AGENT,
        messages: [{ role: 'user', content: 'Readiness probe: reply with the single word "ready".' }],
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    });
    // 401 is the interesting one: the box is up and rejecting the studio's key, which looks
    // identical to "working" from every check that does not actually authenticate.
    if (res.status === 401) {
      return { reachable: false, detail: 'the box rejected the studio’s key — it is set but wrong, or was revoked' };
    }
    if (!res.ok) return { reachable: false, detail: `the box answered ${res.status}` };
    const body = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const content = body?.choices?.[0]?.message?.content ?? '';
    // The engine reports some failures as 200-with-an-error-reply (the FB-095 walkthrough failure).
    const fault = engineFault(content);
    if (fault) {
      return {
        reachable: false,
        // First line only, and bounded: enough to name the fault for an admin, never a page of it.
        detail: `the engine cannot accept a message: ${fault.slice(0, 200)}`,
      };
    }
    if (!content.trim()) return { reachable: false, detail: 'the engine answered a completion with nothing' };
    return { reachable: true, detail: 'a message round-trips' };
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

  // FB-083: the ceiling, where a monitor can reach it. The admin page shows the same two numbers to
  // a person; this is for whatever notices before a person is looking. Free — read from headers the
  // studio already received.
  const budget = { github: githubBudget(), blockedUntil: githubBlockedUntil()?.toISOString() ?? null };

  const report = readiness(ventures, process.env);
  if (new URL(req.url).searchParams.get('probe') !== '1') {
    return Response.json({ ...report, budget }, { status: report.ok ? 200 : 503 });
  }

  const [probed, record, documents] = await Promise.all([
    Promise.all(
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
    ),
    // FB-187: can the studio still write its own record of who agreed to what?
    //
    // Under `?probe=1` for the reason the box probe is: this is the check that catches a credential
    // that is SET but no longer permitted, and only a real write can catch it. The token this was
    // written about reported `permissions.push: true` while every write returned 403.
    //
    // It counts towards `ok`, so a studio that cannot keep its history reports 503 rather than
    // reporting itself ready. Before this, the only sign was a sentence shown to the founder at the
    // moment they decided — after the decision was already made.
    probeRecordWritable(process.env.STUDIO_APPROVAL_GITHUB_TOKEN),
    // FB-174: do a founder's documents have anywhere to live?
    //
    // A studio with no store still accepts documents — it keeps their text and says on the screen
    // that the original was not kept, which is honest. So this does NOT count towards `ok`: it is a
    // true statement about how the studio is set up, not a fault.
    //
    // What it does do is make the answer checkable from outside. Without it the only way to know
    // whether the store was really working in production would be to hand over a document and see,
    // which writes to a venture's repository — a poor way to test a thing.
    documentStoreState(),
  ]);
  const ok = probed.every((v) => v.ready) && record.ok;
  return Response.json({ ok, ventures: probed, record, documents, budget }, { status: ok ? 200 : 503 });
}

/**
 * Where documents go, and whether that actually works right now.
 *
 * `keeping: false` is a setup, not a failure — the deposit path says so on the screen. `detail` is
 * for an admin and names the store or the reason there is none.
 */
async function documentStoreState(): Promise<{ keeping: boolean; store: string | null; detail: string }> {
  let store;
  try {
    store = buildDocumentStore();
  } catch (e) {
    return { keeping: false, store: null, detail: (e as Error).message };
  }
  if (!store) {
    return { keeping: false, store: null, detail: 'No store configured, so originals are not kept — only their text.' };
  }
  // Reaching it, not merely building it. A store that is configured and unreachable is the failure
  // worth catching here, and it is exactly the shape FB-193 got wrong by checking the wrong half.
  try {
    await store.get('__readiness__', `__readiness__/${'0'.repeat(64)}`);
    return { keeping: true, store: store.name, detail: 'reachable' };
  } catch (e) {
    const why = (e as Error).message;
    // "no such document" IS the healthy answer: the store answered, and answered correctly, about a
    // document that does not exist.
    const answered = /no such document|another venture|could not return that document: 40/.test(why);
    return { keeping: answered, store: store.name, detail: answered ? 'reachable' : why };
  }
}
