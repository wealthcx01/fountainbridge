// FB-005 — session + Google-OAuth helpers (server-only).
//
// The studio authenticates with Google OAuth (D4/D6). Rather than pull in a full auth framework
// for the shell, the session is a small signed cookie carrying the verified Google email; the
// OAuth handshake lives in src/app/api/auth/*. A guarded dev-login (STUDIO_DEV_LOGIN=1) lets tests
// and local runs set a session without real Google credentials — it is inert in production.
//
// Access scoping keys off this email in src/lib/ventures.ts (server-side, never in the UI).

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "fb_session";

function secret(): string {
  return process.env.STUDIO_SESSION_SECRET ?? "dev-insecure-secret-change-me-please-32";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Build a signed session cookie value for an email. */
export function encodeSession(email: string): string {
  const payload = Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verify a cookie value and return the email, or null if missing/tampered. */
export function decodeSession(value: string | undefined | null): string | null {
  if (!value || !value.includes(".")) return null;
  const [payload, mac] = value.split(".", 2);
  const expected = sign(payload);
  // Constant-time compare to avoid signature-timing leaks.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

/** Whether the guarded dev-login route is enabled (tests / local only; never in prod). */
export function devLoginEnabled(): boolean {
  return process.env.STUDIO_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/auth/callback`;
}

/** Build the Google authorization URL for the sign-in redirect. */
export function googleAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: oauthRedirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchange an authorization code for tokens, then verify the id_token and return the email.
 * Verification uses Google's tokeninfo endpoint (no extra crypto deps) — it validates signature,
 * audience, and expiry server-side and returns the claims. */
export async function exchangeCodeForEmail(code: string, origin: string): Promise<string | null> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: oauthRedirectUri(origin),
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) return null;
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return null;

  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`,
  );
  if (!infoRes.ok) return null;
  const claims = (await infoRes.json()) as {
    email?: string;
    email_verified?: string | boolean;
    aud?: string;
  };
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID) return null;
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!claims.email || !verified) return null;
  return claims.email.trim().toLowerCase();
}
