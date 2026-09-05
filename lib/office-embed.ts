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
 * The studio's own stylesheet, added to the office's document.
 *
 * pixel-agents is an editor extension, and its interface says so: a Layout button, a Settings
 * button, a "what's new" card for the version it just updated to, and a version number in the
 * corner. In an editor those are right. On a founder's desk they are wrong twice over — they are
 * addressed to whoever installed the extension, and the studio drops every client message but the
 * handshake, so pressing Layout or Settings does nothing at all. A control that does nothing is
 * worse than no control.
 *
 * The zoom buttons go too, for a different reason. They work — they are the founder's own view and
 * say nothing to the box — but the studio shows the office through a window that clips the empty
 * space above the room, and zooming moves the room out from under that window. A control that makes
 * the picture worse is not worth the two buttons.
 *
 * These are position classes because the bundle offers nothing better: no ids, no data attributes,
 * Tailwind utilities only. That is exactly as brittle as it looks, so it is pinned two ways — the
 * office version is fixed on the box, and `officeChromeHidden` below is what a test asserts against.
 * A version bump that moves a button is a deliberate act that has to re-check this list.
 */
export const OFFICE_CHROME_HIDDEN = [
  '.absolute.top-8.left-8',        // zoom
  '.absolute.bottom-10.left-10',   // Layout and Settings
  '.absolute.bottom-42.right-28',  // "Updated to v1.4! / See what's new"
  '.absolute.bottom-8.right-28',   // the version watermark
] as const;

/** The `<style>` block the studio adds to the office document. */
export function officeChromeStyle(): string {
  return `<style data-foundry="office-chrome">${OFFICE_CHROME_HIDDEN.join(',')}{display:none !important}</style>`;
}

/** An office file, addressed through the studio and carrying the token that authorises it. */
export function officeAssetUrl(ventureId: string, file: string, token: string): string {
  const clean = file.replace(/^(\.\.?\/)+/, '');
  return `/venture/${encodeURIComponent(ventureId)}/office/${clean}?token=${encodeURIComponent(token)}`;
}

/**
 * The office's document, addressed through the studio.
 *
 * Root-relative references are rewritten FIRST, on purpose. The relative rewrite produces
 * root-relative URLs of its own, and running it the other way round rewrote its own output: every
 * asset came out addressed `/venture/arca/office/venture/arca/office/assets/…` and the frame loaded
 * nothing at all.
 *
 * `/vite.svg` is the app's favicon, written from the site root. Through the studio that root is the
 * studio's, so it 404s on every load; a frame has no tab to put an icon in anyway, and it is pointed
 * at the office's own copy rather than left as a failing request.
 */
export function rewriteOfficeHtml(html: string, ventureId: string, token: string): string {
  return html
    .replace(/(src|href)="\/([^"/][^"]*)"/g,
      (_m, attr: string, file: string) => `${attr}="${officeAssetUrl(ventureId, file, token)}"`)
    .replace(/(src|href)="\.\/assets\/([^"]+)"/g,
      (_m, attr: string, file: string) => `${attr}="${officeAssetUrl(ventureId, `assets/${file}`, token)}"`)
    .replace('</head>', `${officeChromeStyle()}</head>`);
}

/**
 * The office's stylesheet, addressed through the studio.
 *
 * The stylesheet reaches for the office's own font with a relative `url(...)`. That resolves against
 * the stylesheet's address, inside `/office/assets/`, so the browser asks the studio for it — with
 * no token, because a `url()` in CSS carries only what is written in it.
 *
 * Untokened, the office route falls through to the session check, the frame has no cookie to offer,
 * and the answer is 401. The browser reports that as a CORS failure, which is true and unhelpful: a
 * 401 carries no `access-control-allow-origin`. The office then drew its whole interface in the
 * browser's fallback sans-serif and looked broken, while every automated check stayed green.
 */
export function rewriteOfficeCss(css: string, ventureId: string, token: string): string {
  return css.replace(
    /url\(\s*['"]?(?!data:|https?:|\/\/)([^)'"]+?)['"]?\s*\)/g,
    (_m, ref: string) => `url("${officeAssetUrl(ventureId, ref, token)}")`,
  );
}

/** What a socket probe found. `detail` is for the studio's log, never for a founder. */
export type OfficeSocketProbe = { ok: boolean; detail: string };

/**
 * Open the office socket the way the browser's frame will, and see whether it holds.
 *
 * FB-193. The desk used to decide whether to draw the office by asking the box for one HTTP file.
 * That answered 200 while the socket was dying five milliseconds after every handshake, so a founder
 * on production got a frame that said "Loading…" for ever — strictly worse than the drawn plate it
 * replaced, and every automated check stayed green because the probe it was watching passed.
 *
 * A view is only worth drawing if the thing it views can be reached. So the studio makes the
 * connection itself, from the same place the browser's frame will be proxied from, waits for the
 * office to actually say something, and reports what happened. One real message is the bar: a
 * handshake proves the door opens, not that anything is behind it.
 */
export async function probeOfficeSocket(
  base: string,
  secret: string,
  WebSocketImpl: new (url: string, opts: Record<string, unknown>) => {
    on(event: string, cb: (...args: unknown[]) => void): void;
    send(data: string): void;
    close(): void;
  },
  timeoutMs = 8_000,
): Promise<OfficeSocketProbe> {
  const url = `${base.replace(/^https:/, 'wss:')}/ws`;
  return new Promise<OfficeSocketProbe>((resolve) => {
    let done = false;
    const finish = (ok: boolean, detail: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already gone */ }
      resolve({ ok, detail });
    };
    const timer = setTimeout(() => finish(false, `no message within ${timeoutMs}ms`), timeoutMs);

    const ws = new WebSocketImpl(url, {
      headers: { 'X-Foundry-Office': secret },
      handshakeTimeout: Math.min(timeoutMs, 5_000),
    });

    // The office waits to be asked. It says nothing at all until the handshake arrives, and then
    // sends everything at once — measured against the real box: `webviewReady` at 45ms, the first
    // answer at 47ms. A probe that only listened sat there for the full timeout on a working office,
    // which is how this was found.
    //
    // `webviewReady` is the one message the studio ever forwards from a browser
    // (OFFICE_ALLOWED_CLIENT_MESSAGES), so the probe says exactly what a frame would say and nothing
    // a frame could not.
    ws.on('open', () => ws.send(JSON.stringify({ type: 'webviewReady' })));
    ws.on('message', () => finish(true, 'the office answered'));
    ws.on('error', (err: unknown) => finish(false, (err as Error)?.message ?? 'socket error'));
    ws.on('close', () => finish(false, 'closed before the office said anything'));
  });
}
