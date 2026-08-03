/**
 * Auth.js (NextAuth v5) configuration (FB-005). Google OAuth is the Holy Corner vertical-login
 * pattern (D4); venture scoping keys off the signed-in email against `founder.workspace_email` in
 * the manifests (see lib/authz). Google is the primary provider; FB-092 adds an env-configured
 * email+password allowlist (lib/password-login) for accounts that cannot complete the Google flow.
 * Scoping is identical for both — authorization never depends on which door was used.
 *
 * Test login: when `E2E_TEST_LOGIN=1` AND `E2E_TEST_LOGIN_SECRET` is set, a credentials provider
 * signs in as an arbitrary email — but ONLY if the request carries the matching secret. This lets
 * Playwright drive the three authorization cases against a production build without a live Google
 * client, while a stray `E2E_TEST_LOGIN=1` in real prod is inert (no secret → provider refuses).
 * Real deployments (FB-009) set neither var.
 *
 * Auth mechanism decision (documented in the PR): Auth.js in-app now; Supabase remains the D6 data
 * layer (wired in FB-009). GitHub access is a separate server-side org token (lib/github), not the
 * user's OAuth — the studio reads git on the org's behalf, scoped per request by lib/authz.
 */

import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { baseConfig } from '@/auth.config';
import { authorizePassword, createThrottle, parsePasswordAccounts } from '@/lib/password-login';

const providers: NextAuthConfig['providers'] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
];

// FB-092: email + password for the env-configured allowlist (see lib/password-login for the rules
// and the reasoning). The provider only exists when at least one account is configured — an unset
// or empty STUDIO_PASSWORD_LOGINS leaves Google as the only real door, exactly as before.
const passwordConfig = parsePasswordAccounts(process.env.STUDIO_PASSWORD_LOGINS);
for (const pos of passwordConfig.malformed) {
  // Position only, never content — the likeliest malformation is a plaintext password pasted
  // where a hash belongs, and it must not end up in logs.
  console.warn(
    `[auth] STUDIO_PASSWORD_LOGINS entry ${pos} is malformed (expected email=scrypt:...) — ignored. ` +
      'Mint entries with scripts/mint-password-login.mjs.',
  );
}
export const passwordLoginEnabled = passwordConfig.accounts.size > 0;
if (passwordLoginEnabled) {
  const throttle = createThrottle();
  providers.push(
    Credentials({
      id: 'password',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: (creds) =>
        authorizePassword(creds?.email, creds?.password, passwordConfig.accounts, throttle),
    }),
  );
}

const e2eSecret = process.env.E2E_TEST_LOGIN_SECRET;
if (process.env.E2E_TEST_LOGIN === '1' && e2eSecret) {
  providers.push(
    Credentials({
      id: 'e2e',
      name: 'E2E Test Login',
      credentials: { email: { label: 'Email', type: 'text' }, secret: { type: 'text' } },
      authorize: (creds) => {
        const secret = typeof creds?.secret === 'string' ? creds.secret : '';
        // Constant target compare; the provider only exists when a secret is configured.
        if (!e2eSecret || secret !== e2eSecret) return null;
        const email = typeof creds?.email === 'string' ? creds.email.trim() : '';
        return email ? { id: email, email, name: 'E2E Test User' } : null;
      },
    }),
  );
}

// Gate behaviour and callbacks live in auth.config.ts (edge-safe, shared with the middleware);
// this file adds the providers, which may use Node-only modules (lib/password-login → node:crypto).
export const config: NextAuthConfig = {
  ...baseConfig,
  providers,
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
