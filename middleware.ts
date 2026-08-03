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
    '/((?!api/auth/|api/health$|login$|login/|not-authorized$|not-authorized/|_next/static|_next/image|favicon.ico).*)',
  ],
};
