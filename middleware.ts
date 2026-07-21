// Authentication gate (FB-005). Auth.js middleware redirects unauthenticated requests to the
// sign-in page (/login). Venture-scoping AUTHORIZATION happens per-page in server components
// (lib/authz over the manifests) — this only enforces "must be signed in". Public paths (the
// auth API, login, not-authorized, static assets) are excluded from the matcher.
export { auth as middleware } from '@/auth';

// Exclusions are anchored to whole path segments so a look-alike path (e.g. /login-x) is still
// gated, not accidentally public. The `authorized` callback in auth.ts does the actual enforcement.
export const config = {
  matcher: [
    '/((?!api/auth|login$|login/|not-authorized$|not-authorized/|_next/static|_next/image|favicon.ico).*)',
  ],
};
