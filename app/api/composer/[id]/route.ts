import { readFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { composerEndpoint, composerKeyEnvName } from '@/lib/composer';

/**
 * The composer's engine, reached from inside the studio (FB-065).
 *
 * The founder's browser talks to the studio; the studio talks to the venture's box. It is a proxy
 * rather than a direct call for one reason that is not negotiable: the engine key would otherwise
 * have to reach the browser, and a key in a browser is a key anyone with the venture's studio access
 * can lift and use against the box directly, forever.
 *
 * Authorization happens HERE, server-side, before a byte reaches the box (CLAUDE.md #6). The key is
 * looked up per venture, so a session scoped to one venture cannot address another's engine even by
 * editing the URL — the wrong venture's key simply does not exist in this process.
 *
 * Nothing is stored. The conversation lives on the venture's box and in the founder's browser; the
 * studio only carries it between them (D1).
 */

export const runtime = 'nodejs';
// The reply streams for a minute or more when the composer is using tools; a buffered response
// would show the founder nothing at all until it finished.
export const dynamic = 'force-dynamic';

interface Body {
  messages?: Array<{ role: string; content: string }>;
  agent?: string;
}

const DEFAULT_AGENT = process.env.COMPOSER_AGENT_ID ?? 'agent_foundry_composer';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  const venture = ventures.find((v) => v.id === id);
  if (!venture || !canAccessVenture(access, id)) {
    // Same answer for "not yours" and "no such venture": the difference would tell a founder which
    // other ventures exist.
    return NextResponse.json({ error: 'You do not have access to this venture.' }, { status: 403 });
  }

  // Fixture seam, on the same terms as every other read model (tickets, PRs, work): gated on the
  // one well-known test switch, never on the variable alone. This surface reaches a founder's real
  // venture engine, so a stray environment variable must not be able to substitute a script for it.
  if (process.env.COMPOSER_FIXTURE && process.env.E2E_TEST_LOGIN === '1') {
    return new Response(readFileSync(process.env.COMPOSER_FIXTURE, 'utf8'), {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }

  const endpoint = composerEndpoint(venture.vpsHost);
  if (!endpoint) {
    return NextResponse.json(
      { error: 'This venture does not have a box yet, so there is nothing to talk to.' },
      { status: 503 },
    );
  }

  const key = process.env[composerKeyEnvName(id)];
  if (!key) {
    return NextResponse.json(
      {
        error: 'The composer is not connected to this venture yet.',
        detail: `An admin needs to run deploy/librechat/enable-agents-api.sh on the box and set ${composerKeyEnvName(id)} on the studio.`,
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'That message could not be read.' }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content !== '')
    .map((m) => ({ role: m.role, content: m.content }));
  if (messages.length === 0) {
    return NextResponse.json({ error: 'There was nothing to send.' }, { status: 400 });
  }

  // The agent is fixed server-side. Taking it from the request would let a signed-in founder address
  // any agent on the box, including ones they were never given.
  const upstream = await fetch(`${endpoint}/api/agents/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: DEFAULT_AGENT, messages, stream: true }),
    // A composer turn that searches the brain and drafts a ticket runs well past a default timeout.
    signal: AbortSignal.timeout(300_000),
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    const status = upstream?.status ?? 502;
    // Never pass the box's error body through: it can carry internal detail, and a founder cannot
    // act on it anyway.
    return NextResponse.json(
      {
        error: status === 401 || status === 403
          ? 'The studio was refused by your venture’s composer. An admin needs to renew its key.'
          : 'Your venture’s composer could not be reached. It may be restarting — try again in a minute.',
      },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Railway sits in front of this; without it the proxy buffers the stream and the founder
      // watches a spinner until the whole reply is done.
      'X-Accel-Buffering': 'no',
    },
  });
}
