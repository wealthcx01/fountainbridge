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

/**
 * How long a minted office token is good for, and the step it is rounded to.
 *
 * The step is not decoration. The token goes in the iframe's URL, so a token that changes changes
 * the `src`, and a changed `src` reloads the frame — which closes the office socket and redraws the
 * room from nothing. The desk re-renders itself once a minute while a venture is working
 * (`WhileWorking`), and every one of those renders used to mint a token with a new expiry in it. So
 * the founder's office reset every sixty seconds, measured: the socket closed at 60.8s and opened
 * again at 60.9s, on a page nobody had touched.
 *
 * Measuring the expiry from the START of the half hour the render happens in, rather than from the
 * instant of the render, makes the minted string identical for every render inside that half hour,
 * so the frame is left alone. A token is therefore good for between thirty and sixty minutes rather
 * than exactly ten — a longer life for a capability that only ever buys a read of one venture's
 * office, and cannot write anything (`OFFICE_ALLOWED_CLIENT_MESSAGES`).
 */
export const OFFICE_TOKEN_TTL_MS = 30 * 60_000;
export const OFFICE_TOKEN_STEP_MS = 30 * 60_000;

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
  // Every render inside the same half hour mints the same string, because the expiry is measured
  // from the start of that half hour rather than from the instant of the render. See the note on
  // OFFICE_TOKEN_STEP_MS: this is what stops the office reloading under the founder.
  const exp = Math.floor(now / OFFICE_TOKEN_STEP_MS) * OFFICE_TOKEN_STEP_MS + OFFICE_TOKEN_STEP_MS + OFFICE_TOKEN_TTL_MS;
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

/**
 * Where the founder's browser watches this venture's office (FB-198).
 *
 * The browser goes straight to the venture's box. It used to go through the studio, and that cannot
 * work: Railway's edge will not carry a WebSocket for the studio — measured at ~75ms to a cut, with
 * the box disconnected, from two continents (FB-197).
 *
 * Taking the studio out of the live path does not take the studio out of the decision. The ticket in
 * this URL is signed with the venture's office secret and issued only to someone who has already
 * passed `canAccessVenture`, so which venture a person may watch is still settled here, server-side
 * (CLAUDE.md #6). The box's gate only checks that the studio said so, and refuses everything a
 * browser might try to send back (`deploy/office/office-gate-lib.mjs`).
 *
 * The ticket is signed with the venture's OWN office secret and never with the studio's approval
 * secret: a venture box that was broken into must not be able to forge a grant (CLAUDE.md #4).
 */
export function officeWatchUrl(
  ventureId: string,
  env: Record<string, string | undefined>,
  now = Date.now(),
): string | null {
  const base = officeEndpoint(ventureId, env);
  const secret = env[officeSecretEnvName(ventureId)]?.trim();
  if (!base || !secret) return null;
  const ticket = mintOfficeToken(ventureId, secret, now);
  return `${base}/?token=${encodeURIComponent(ticket)}`;
}

/**
 * The office's live socket, for the browser's own check that there is anything to watch.
 *
 * The path is `/ws` at the host's root because the office's client builds it that way from the
 * page's address, and it cannot be moved without patching their bundle.
 *
 * The desk asks this question from the BROWSER rather than from the studio, and that is the whole
 * lesson of FB-193: the studio's own check answered "ready" on a day when the office was unusable,
 * because it proved the studio could reach the box and said nothing about whether a founder could.
 * Only the browser knows the leg that matters.
 */
export function officeSocketUrl(
  ventureId: string,
  env: Record<string, string | undefined>,
  now = Date.now(),
): string | null {
  const host = env[officeHostEnvName(ventureId)]?.trim();
  const secret = env[officeSecretEnvName(ventureId)]?.trim();
  if (!host || !secret) return null;
  return `wss://${host}/ws?token=${encodeURIComponent(mintOfficeToken(ventureId, secret, now))}`;
}
