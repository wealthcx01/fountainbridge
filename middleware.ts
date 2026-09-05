// Authentication gate (FB-005). Auth.js middleware redirects unauthenticated requests to the
// sign-in page (/login). Venture-scoping AUTHORIZATION happens per-page in server components
// (lib/authz over the manifests) — this only enforces "must be signed in". Public paths (the
// auth API, login, not-authorized, static assets) are excluded from the matcher.
//
// Built from the edge-safe base config, NOT auth.ts (FB-092): auth.ts pulls node:crypto via the
// password provider, which the edge bundle cannot carry. The middleware only validates the session
// JWT and applies `authorized` — it never needs a provider.
import NextAuth from 'next-auth';
import { baseConfig } from '@/auth.config';

export const { auth: middleware } = NextAuth(baseConfig);

// Exclusions are anchored to whole path segments so a look-alike path (e.g. /login-x) is still
// gated, not accidentally public. The `authorized` callback in auth.config.ts does the actual
// enforcement.
export const config = {
  matcher: [
    // `api/health$` (anchored — health has no subpaths) is excluded so Railway's healthcheck + the
    // uptime monitor get a 200, not a login redirect. Anchoring keeps a future `/api/health-x` gated.
    // FB-141: the installable shell is public, and has to be.
    //
    // A phone fetches the manifest and the icons to decide whether it can add the studio to a home
    // screen, and it does that WITHOUT a session — behind the gate they 302 to /login, the OS reads
    // HTML where it expected JSON, and the install silently fails or takes the wrong icon. `sw.js`
    // must also be served from the root to hold root scope.
    //
    // Safe to open, and only because of what they are: a name, two colours, three flat images, and a
    // service worker that caches nothing but those. There is no venture in any of them, and
    // `public/sw.js` explains at length why it must stay that way.
    //
    // Anchored per file, like `api/health$` above it — a prefix here would open anything that merely
    // began with the same letters.
    //
    // FB-163: `venture/<id>/office` is excluded, and it is the only exclusion here that is NOT
    // public.
    //
    // The office is embedded in a frame sandboxed WITHOUT `allow-same-origin`, because pixel-agents'
    // bundle is upstream code and code in the studio's own origin could call the studio's own server
    // actions — including the one that approves an external send. An opaque origin sends no cookie,
    // so the middleware would bounce every file the frame asks for to /login, which is exactly what
    // it did before this line existed.
    //
    // So the route handler does the gate instead, and does it on every request: a short-lived signed
    // token naming this venture, or a session that passes `canAccessVenture`. Nothing is open here —
    // the check moved, it did not go away. `app/venture/[id]/office/[[...path]]/route.ts` is where
    // it lives, and it is the first thing in the file.
    '/((?!api/auth/|api/health$|login$|login/|not-authorized$|not-authorized/|manifest.webmanifest$|sw.js$|icon-192.png$|icon-512.png$|apple-touch-icon.png$|venture/[^/]+/office$|venture/[^/]+/office/|_next/static|_next/image|favicon.ico).*)',
  ],
};
