import { auth } from '@/auth';
import { loadVentures } from '@/lib/ventures';
import { authorizeVentures, canAccessVenture, parseAdminEmails } from '@/lib/authz';
import { officeEndpoint, officeSecretEnvName, readOfficeToken } from '@/lib/office-embed';

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

  const base = officeEndpoint(id, process.env);
  const secret = process.env[officeSecretEnvName(id)];
  if (!base || !secret) {
    // Not an error. Most ventures have no box, and the desk shows the drawn plate for them.
    return new Response('This venture has no office yet.', { status: 404 });
  }

  // The path is rebuilt from the segments Next parsed, never taken from the raw URL: a path that
  // travelled through as text could climb out of `/office` on the box.
  const suffix = (path ?? []).filter((p) => p !== '..' && p !== '.').map(encodeURIComponent).join('/');
  const target = `${base}/${suffix}`;

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

  // The app's own HTML asks for `./assets/…`, which resolves against the URL the browser is on. The
  // browser is on `/venture/<id>/office` with no trailing slash — Next redirects that slash away —
  // so a relative asset would resolve one level too high and 404.
  //
  // A `<base>` fixes it in one place and makes the base explicit rather than a consequence of how
  // the path happened to be spelled. Only the document is touched; every other file is passed
  // through untouched.
  if (type?.includes('text/html')) {
    const html = await upstream.text();
    const base = `/venture/${encodeURIComponent(id)}/office/`;
    const carry = new URL(req.url).searchParams.get('token') ?? '';
    // The app's own files must carry the token too, for the same reason the document did: an opaque
    // origin sends no cookie. Two references, rewritten explicitly rather than by serving the whole
    // frame from a cookie-less path — so the change is visible here and nowhere else.
    const based = html
      .replace(/(src|href)="\.\/assets\/([^"]+)"/g,
        (_m, attr: string, file: string) => `${attr}="${base}assets/${file}?token=${encodeURIComponent(carry)}"`);
    return new Response(based, { status: upstream.status, headers: htmlHeaders(type) });
  }

  const headers = new Headers();
  if (type) headers.set('content-type', type);
  // The office is live: a cached sprite sheet is fine, a cached frame of the room is not.
  headers.set('cache-control', 'no-store');
  // It is framed by the studio and by nothing else.
  headers.set('content-security-policy', "frame-ancestors 'self'");
  headers.set('x-content-type-options', 'nosniff');
  // The frame has an opaque origin, so every file it pulls is a cross-origin module fetch. The token
  // on the URL is what authorises it; this header only tells the browser the fetch may proceed, and
  // it is safe precisely because these requests carry no credentials to borrow.
  headers.set('access-control-allow-origin', '*');

  return new Response(upstream.body, { status: upstream.status, headers });
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
