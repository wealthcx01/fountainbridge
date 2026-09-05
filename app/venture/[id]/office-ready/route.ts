import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { officeEndpoint, officeSecretEnvName, probeOfficeSocket } from '@/lib/office-embed';

/**
 * Is this venture's office worth drawing? (FB-193)
 *
 * The desk asks before it replaces FB-139's drawn plate with a live frame. It used to ask for one
 * HTTP file from the box, which answered 200 on a day when the socket was dying five milliseconds
 * after every handshake — so a founder got a frame that said "Loading…" for ever, and every
 * automated check stayed green because the thing being watched was not the thing that mattered.
 *
 * This asks the question the frame actually depends on: open the office socket from the studio, the
 * way the frame will be proxied, and wait for the office to say something.
 *
 * The reason is logged and never returned. A founder gets "the office is not reachable" and the
 * drawn plate; the studio's log gets the sentence that says why.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // The session, always. Unlike the office's own files this is not fetched by a sandboxed frame, so
  // there is no opaque origin and no reason to accept a token instead of the real check.
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return Response.json({ ready: false }, { status: 401 });

  const ventures = loadVentures();
  const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
  if (!ventures.some((v) => v.id === id) || !canAccessVenture(access, id)) {
    return Response.json({ ready: false }, { status: 404 });
  }

  const base = officeEndpoint(id, process.env);
  const secret = process.env[officeSecretEnvName(id)];
  if (!base || !secret) {
    // Most ventures have no box. Not an error, and the plate is the right answer.
    return Response.json({ ready: false, reason: 'no office' });
  }

  // Imported here rather than at the top: `ws` is a Node module and this is the only route that
  // needs it, so nothing else has to care that it exists.
  const { WebSocket } = await import('ws');
  const probe = await probeOfficeSocket(base, secret, WebSocket as never);

  if (!probe.ok) {
    console.error('[office] the office socket did not hold, so the desk will draw the plate', {
      venture: id, detail: probe.detail,
    });
  }

  return Response.json({ ready: probe.ok });
}
