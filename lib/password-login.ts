/**
 * Email + password sign-in for the studio (FB-092).
 *
 * Google OAuth stays the primary door (D4). This is the second one: a small, env-configured
 * allowlist of accounts that may sign in with a password — needed because some Workspace accounts
 * (e.g. ARCA's founder walkthrough account) cannot complete the Google flow. It is NOT self-serve
 * auth: there is no signup, no password reset, no user table. An account exists exactly when an
 * admin put `email=hash` into `STUDIO_PASSWORD_LOGINS` on the deployment.
 *
 * Hardening rules, in one place so they are testable:
 *  - Only scrypt hashes live in the env; the studio never sees or stores a plaintext password.
 *    Mint entries with `node scripts/mint-password-login.mjs <email>`.
 *  - Verification is constant-time (crypto.timingSafeEqual) and burns the same scrypt work for an
 *    unknown email as for a known one, so response timing does not reveal which emails exist.
 *  - Failures throttle per email: after MAX_FAILS wrong passwords the account is refused for
 *    WINDOW_MS regardless of what is typed. In-memory is enough — the studio is one long-running
 *    server (the D6 Railway amendment), and the lockout protects against online guessing, not a
 *    stolen hash.
 *  - A malformed env entry is skipped with a loud warning that names its position, never its
 *    content (the most likely typo is pasting a plaintext password where a hash belongs).
 *
 * What signing in grants: only an identity. Venture scoping is lib/authz on every request, exactly
 * as for Google — a password account sees a venture only if a manifest names it as founder, or an
 * admin list names it as admin (CLAUDE.md #6).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// scrypt parameters (OWASP-recommended interactive-login cost). Encoded into every hash so they
// can be raised later without invalidating existing entries.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

// Upper bounds when verifying, so a corrupted env value cannot make the server allocate
// gigabytes. Well above anything we would legitimately configure.
const MAX_N = 1 << 17;
const MAX_R = 16;
const MAX_P = 4;

export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/** Hash a password into the storable `scrypt:N:r:p:salt:hash` form (base64url, no separators). */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

/** Constant-time verify. Returns false — never throws — for garbage input or a malformed hash. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split(':');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    if (N < 2 || N > MAX_N || (N & (N - 1)) !== 0 || r < 1 || r > MAX_R || p < 1 || p > MAX_P) {
      return false;
    }
    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(hashRaw, 'base64url');
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface ParsedAccounts {
  /** normalized email → stored hash */
  accounts: Map<string, string>;
  /** 1-based positions of entries that could not be parsed (content deliberately not echoed). */
  malformed: number[];
}

/**
 * Parse `STUDIO_PASSWORD_LOGINS`: `email=hash` entries separated by commas and/or whitespace.
 * A malformed entry is reported by position only — it may be a plaintext password typed by
 * mistake, and an error message is the last place a credential should ever surface.
 */
export function parsePasswordAccounts(raw: string | undefined): ParsedAccounts {
  const accounts = new Map<string, string>();
  const malformed: number[] = [];
  if (!raw) return { accounts, malformed };
  const entries = raw.split(/[,\s]+/).filter(Boolean);
  entries.forEach((entry, i) => {
    const eq = entry.indexOf('=');
    const email = eq > 0 ? entry.slice(0, eq).trim().toLowerCase() : '';
    const hash = eq > 0 ? entry.slice(eq + 1).trim() : '';
    if (!email.includes('@') || !hash.startsWith('scrypt:')) {
      malformed.push(i + 1);
      return;
    }
    accounts.set(email, hash);
  });
  return { accounts, malformed };
}

export interface Throttle {
  /** True when this email has exhausted its attempts and the window has not yet passed. */
  isBlocked(email: string): boolean;
  recordFailure(email: string): void;
  recordSuccess(email: string): void;
}

/** Per-email failure throttle. `now` is injectable for tests. */
export function createThrottle(now: () => number = Date.now): Throttle {
  const fails = new Map<string, { count: number; firstAt: number }>();
  const key = (email: string) => email.trim().toLowerCase();
  return {
    isBlocked(email) {
      const rec = fails.get(key(email));
      if (!rec) return false;
      if (now() - rec.firstAt > WINDOW_MS) {
        fails.delete(key(email));
        return false;
      }
      return rec.count >= MAX_FAILS;
    },
    recordFailure(email) {
      const k = key(email);
      const rec = fails.get(k);
      if (!rec || now() - rec.firstAt > WINDOW_MS) {
        fails.set(k, { count: 1, firstAt: now() });
      } else {
        rec.count += 1;
      }
    },
    recordSuccess(email) {
      fails.delete(key(email));
    },
  };
}

// Burned for unknown emails so "no such account" costs the same scrypt work as "wrong password".
// The password compared against it is random per boot; this can never verify.
const DECOY_HASH = hashPassword(randomBytes(24).toString('base64url'));

/**
 * The authorize decision, pure enough to test: null on any failure (Auth.js turns that into a
 * generic sign-in error — the caller never learns WHICH check failed), the identity on success.
 */
export function authorizePassword(
  emailRaw: unknown,
  passwordRaw: unknown,
  accounts: Map<string, string>,
  throttle: Throttle,
): { id: string; email: string } | null {
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';
  if (!email || !password) return null;
  if (throttle.isBlocked(email)) return null;
  const stored = accounts.get(email);
  if (!stored) {
    // Same work, same outcome shape as a wrong password — and a miss still counts against the
    // throttle so an attacker cannot probe unknown emails for free.
    verifyPassword(password, DECOY_HASH);
    throttle.recordFailure(email);
    return null;
  }
  if (!verifyPassword(password, stored)) {
    throttle.recordFailure(email);
    return null;
  }
  throttle.recordSuccess(email);
  return { id: email, email };
}
