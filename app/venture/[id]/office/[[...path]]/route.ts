import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import {
  officeEndpoint, officeSecretEnvName, readOfficeToken, rewriteOfficeCss, rewriteOfficeHtml,
} from '@/lib/office-embed';

/**
 * The venture office's own files, served through the studio (FB-163).
 *
 * The browser asks the studio; the studio asks the box, holding a secret the browser never sees.
 * That is what keeps venture isolation on the studio's session and server-side (CLAUDE.md #6): an
 * iframe pointed at a box hostname is enforced by nothing, and a credential in a URL is a credential
 * a founder can copy out of it (CLAUDE.md #8).
 *
 * This half is ordinary HTTP — the app's HTML, its JavaScript and its sprite sheets. The socket half
 * cannot live in a route handler at all, because Next's App Router does not support an upgrade; it
 * is in `server.js`, and the comment there says why that is not the blocker FB-163 recorded.
 *
 * Scoping is checked HERE, before anything is fetched, and again on the socket.
 */
export const dynamic = 'force-dynamic';

/** The office is a view. Nothing a browser sends is forwarded, so only reads are routed. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; path?: string[] }> },
) {
  const { id, path } = await params;

  // Two ways in, and the second one is the reason this works at all.
  //
  // The frame is sandboxed WITHOUT `allow-same-origin`, on purpose: pixel-agents' bundle is upstream
  // code, and code running in the studio's own origin could call the studio's own server actions —
  // including the one that approves an external send. So the frame gets an opaque origin.
  //
  // The cost is that its module fetches carry no cookie, so the session cannot authorise them. The
  // short-lived signed token in the page URL does instead: it names one venture, it expires, and the
  // studio only minted it for someone who had already passed the check below.
  const token = readOfficeToken(
    new URL(req.url).searchParams.get('token'),
    process.env.FOUNDRY_APPROVAL_SECRET,
  );

  if (token?.ventureId !== id) {
    const session = await auth();
    const email = session?.user?.email;
    if (!email) return new Response('Sign in first.', { status: 401 });

    const ventures = loadVentures();
    const access = authorizeVentures(email, ventures, parseAdminEmails(process.env.STUDIO_ADMIN_EMAILS));
    if (!ventures.some((v) => v.id === id) || !canAccessVenture(access, id)) {
      // Same refusal for "not yours" and "no such venture": the difference is a way to learn which
      // ventures exist by trying ids.
      return new Response('Not found.', { status: 404 });
    }
  }

  const boxBase = officeEndpoint(id, process.env);
  const secret = process.env[officeSecretEnvName(id)];
  if (!boxBase || !secret) {
    // Not an error. Most ventures have no box, and the desk shows the drawn plate for them.
    return new Response('This venture has no office yet.', { status: 404 });
  }

  // The path is rebuilt from the segments Next parsed, never taken from the raw URL: a path that
  // travelled through as text could climb out of `/office` on the box.
  const suffix = (path ?? []).filter((p) => p !== '..' && p !== '.').map(encodeURIComponent).join('/');
  const target = `${boxBase}/${suffix}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { 'X-Foundry-Office': secret },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Said plainly rather than as a blank frame: the desk falls back to the drawn plate when this
    // fails, and a founder is told which of the two they are looking at (CLAUDE.md #10).
    return new Response('The studio could not reach this venture’s office.', { status: 502 });
  }

  const type = upstream.headers.get('content-type');

  // The office's own HTML and CSS point at files by paths that mean something on the box and
  // nothing through the studio, and they carry no token — an opaque origin sends no cookie, so an
  // untokened file is refused. Both are rewritten on the way past. Everything else is passed
  // through untouched.
  const carry = new URL(req.url).searchParams.get('token') ?? '';

  // Both rewrites live in `lib/office-embed.ts`, with the reasons, so they can be tested without a
  // box to fetch from. The UI gate has no venture machine to reach and must not grow one.
  if (type?.includes('text/html')) {
    return new Response(rewriteOfficeHtml(await upstream.text(), id, carry), {
      status: upstream.status,
      headers: htmlHeaders(type),
    });
  }

  if (type?.includes('text/css')) {
    return new Response(rewriteOfficeCss(await upstream.text(), id, carry), {
      status: upstream.status,
      headers: assetHeaders(type),
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: assetHeaders(type),
  });
}

/** The response headers for everything that is not the office's own document. */
function assetHeaders(type: string | null): Headers {
  const headers = new Headers();
  if (type) headers.set('content-type', type);
  // The office is live: a cached sprite sheet is fine, a cached frame of the room is not.
  headers.set('cache-control', 'no-store');
  // It is framed by the studio and by nothing else.
  headers.set('content-security-policy', "frame-ancestors 'self'");
  headers.set('x-content-type-options', 'nosniff');
  // The frame has an opaque origin, so every file it pulls is a cross-origin fetch. The token on the
  // URL is what authorises it; this header only tells the browser the fetch may proceed, and it is
  // safe precisely because these requests carry no credentials to borrow.
  headers.set('access-control-allow-origin', '*');
  return headers;
}

/** The response headers for the office's own document. */
function htmlHeaders(type: string): Headers {
  const h = new Headers();
  h.set('content-type', type);
  // The office is live: a cached sprite sheet is fine, a cached frame of the room is not.
  h.set('cache-control', 'no-store');
  // Framed by the studio and by nothing else.
  h.set('content-security-policy', "frame-ancestors 'self'");
  h.set('x-content-type-options', 'nosniff');
  return h;
}
