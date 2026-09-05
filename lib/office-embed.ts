/**
 * The venture office, embedded read-only (FB-163, gap G6).
 *
 * ## What this is
 *
 * `pixel-agents` runs on the venture's own box, bound to `127.0.0.1`, watching the Claude sessions
 * the lane already writes under `~/.claude/projects/`. The design calls it the real plate:
 * *"Each character is 1 agent on Arca's machine; a raised hand is a wait on you. The studio embeds
 * it read-only."*
 *
 * ## How the studio reaches it, and why this shape
 *
 * The browser never talks to the box. It asks the STUDIO for the office, and the studio asks the
 * box, holding a shared secret the browser never sees. That keeps venture isolation on the studio's
 * session, server-side, which is where CLAUDE.md #6 puts it — an iframe pointed at a box hostname is
 * enforced by nothing.
 *
 * The office is served on a path of the hostname the composer already uses (`chat.<host>/office`)
 * rather than a subdomain of its own: no DNS record to add and no second certificate. Caddy refuses
 * anything on that path without the secret.
 *
 * ## The token in the page
 *
 * pixel-agents' own client builds its socket as `${proto}//${location.host}/ws?token=<the page's
 * ?token>`. So the studio serves the app under a venture path and mints a short-lived signed token
 * naming the venture; the socket arrives at the studio's own `/ws` and the token says which box to
 * open. Nothing about the box — host, port or secret — is in it.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** How long a minted office token is good for. Long enough to open a socket, short enough to be dull. */
export const OFFICE_TOKEN_TTL_MS = 10 * 60_000;

/**
 * The environment variable holding a venture's office host.
 *
 * The host is an env var rather than a derivation from the manifest, and that is deliberate: the
 * socket half of this lives in `server.js`, which is plain JavaScript started before Next and cannot
 * read a YAML manifest. Two sources for one hostname is how the HTTP half and the socket half come
 * to disagree — the assets load and the office never connects, with nothing failing loudly.
 *
 * So both halves read the same variable, and a venture without it has no office at all rather than
 * half of one.
 */
export function officeHostEnvName(ventureId: string): string {
  return `OFFICE_HOST_${ventureId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

/**
 * Where a venture's office lives.
 *
 * `chat.<host>/office` — a path on the hostname the composer already uses, so there is no DNS record
 * to add and no second certificate. Set per venture, because one box per venture (D1).
 */
export function officeEndpoint(
  ventureId: string,
  env: Record<string, string | undefined>,
): string | null {
  const host = env[officeHostEnvName(ventureId)]?.trim();
  return host ? `https://${host}/office` : null;
}

/**
 * The environment variable holding a venture's office secret.
 *
 * One per venture, for the reason `keyEnvName` gives about engine keys: a credential that could
 * reach two ventures would be a hole in the isolation the architecture rests on.
 */
export function officeSecretEnvName(ventureId: string): string {
  return `OFFICE_SECRET_${ventureId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

/** Is this venture's office wired up at all? A venture with no box has no office and says so. */
export function officeConfigured(
  ventureId: string,
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(officeEndpoint(ventureId, env)) && Boolean(env[officeSecretEnvName(ventureId)]?.trim());
}

/**
 * A capability to watch ONE venture's office, for a short while.
 *
 * Signed with the studio's own secret. It names the venture and expires; it carries nothing about
 * the box, and holding it lets a bearer watch — never write, because the socket proxy drops every
 * client message but the handshake.
 *
 * Minted only after the caller has passed `canAccessVenture`, so the signature is a statement the
 * studio is entitled to make.
 */
export function mintOfficeToken(ventureId: string, secret: string, now = Date.now()): string {
  const exp = now + OFFICE_TOKEN_TTL_MS;
  const body = `${ventureId}.${exp}`;
  return `${body}.${sign(body, secret)}`;
}

/** The venture a token is good for, or null. Never throws: a malformed token is simply not a token. */
export function readOfficeToken(
  token: string | null | undefined,
  secret: string | undefined,
  now = Date.now(),
): { ventureId: string } | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [ventureId, expRaw, mac] = parts;
  if (!ventureId || !/^\d+$/.test(expRaw)) return null;
  if (Number(expRaw) < now) return null;
  const expected = sign(`${ventureId}.${expRaw}`, secret);
  if (!equal(mac, expected)) return null;
  return { ventureId };
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * What the browser may say to the office, which is one thing.
 *
 * `clientMessageHandler.ts` accepts `closeAgent` from any connection and calls `dismiss` +
 * `removeAgent`: an untokened viewer can remove agents from the office and change its layout. Only
 * the hooks install is token-gated upstream, so "read-only" cannot be a setting — it has to be a
 * filter, and it has to be an allow-list.
 *
 * `webviewReady` is the handshake the app sends on connect and the only message it needs to render.
 */
export const OFFICE_ALLOWED_CLIENT_MESSAGES = new Set(['webviewReady']);

/** Is this frame one the studio will pass through to the box? */
export function officeMessageAllowed(raw: string): boolean {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return false; }
  if (!parsed || typeof parsed !== 'object') return false;
  const type = (parsed as { type?: unknown }).type;
  return typeof type === 'string' && OFFICE_ALLOWED_CLIENT_MESSAGES.has(type);
}
