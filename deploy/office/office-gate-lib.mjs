/**
 * The venture office's gate — the part worth testing on its own (FB-198).
 *
 * ## Why this exists at all
 *
 * The office is a live picture of a venture's own machine, and the browser now watches it directly
 * rather than through the studio. That is not a shortcut: Railway's edge will not carry a WebSocket
 * for the studio (FB-197 measured it cut at ~75ms, with the box disconnected, from two continents),
 * and a proxy that cannot proxy is worse than no proxy.
 *
 * Taking the studio out of the middle takes two things with it, and this file is where they land.
 *
 * ## One: who is allowed to watch
 *
 * The studio used to prove itself to the box with a shared header, and a browser cannot send one.
 * So the studio issues a **ticket** instead: signed, naming one venture, expiring. The studio only
 * issues it to someone who has already passed `canAccessVenture`, so which venture a person may see
 * is still decided by the studio and still decided server-side (CLAUDE.md #6). The box only checks
 * that the studio said so.
 *
 * The ticket is signed with the venture's OWN office secret, never the studio's approval secret. A
 * venture box that was broken into must not be able to forge anything but its own office ticket —
 * least of all a grant (CLAUDE.md #4).
 *
 * ## Two: read-only
 *
 * pixel-agents accepts `closeAgent` from any connection and removes an agent. Read-only cannot be a
 * setting on the box because there is no such setting; it has only ever been a filter, and the
 * filter used to run in the studio. With the studio out of the path the filter has to run here.
 *
 * This is the only lock. It is not one of two. So it is an allow-list of exactly one message,
 * everything else is dropped without an answer, and `allowedFromBrowser` is tested against the
 * shapes an attacker would actually try rather than the shape the app happens to send.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** `<venture>.<expiry ms>.<signature>` — the same shape the studio mints. */
const TICKET = /^([a-z0-9][a-z0-9-]{0,62})\.(\d{1,15})\.([A-Za-z0-9_-]{1,200})$/;

/** The signature over a ticket body, base64url, so it is safe in a URL. */
export function signTicket(body, secret) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

/**
 * Is this ticket good, for THIS venture, right now?
 *
 * Returns the venture id or null. Never throws: a malformed ticket is simply not a ticket, and a
 * gate that can be crashed by a query string is not a gate.
 */
export function readTicket(ticket, { venture, secret, now = Date.now() }) {
  if (typeof ticket !== 'string' || !secret) return null;
  const m = TICKET.exec(ticket);
  if (!m) return null;
  const [, named, expRaw, signature] = m;

  // The box serves one venture. A ticket for another one is a ticket for somewhere else, however
  // well it is signed — and with a secret per venture it could not be signed here anyway. Checked
  // regardless: two independent reasons to refuse is the right number for the only lock there is.
  if (named !== venture) return null;
  if (Number(expRaw) < now) return null;

  const expected = signTicket(`${named}.${expRaw}`, secret);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Length first: timingSafeEqual throws on a mismatch, and a throw here would be a way to ask
  // whether a guess was the right length.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return named;
}

/** The one message a browser may send to a venture's machine. */
export const ALLOWED_FROM_BROWSER = 'webviewReady';

/**
 * May this message go from the browser to the box?
 *
 * Only one may, and it carries nothing: the office's own handshake. Anything else — an instruction
 * to remove an agent, to install hooks, to rewrite the room — is dropped in silence, because an
 * error reply would tell whoever sent it that they had found the right shape.
 *
 * Binary frames are refused outright rather than decoded. The office's protocol is JSON and a
 * binary frame from a browser is nothing this gate should be trying to understand.
 */
export function allowedFromBrowser(raw, isBinary = false) {
  if (isBinary) return false;
  if (typeof raw !== 'string') return false;
  // A cheap ceiling before any parsing: the one permitted message is about thirty bytes, and
  // JSON.parse on a megabyte of nesting is work an unauthenticated shape should never buy.
  if (raw.length > 512) return false;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return false; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  // `type` alone, and by identity. A message that is the handshake plus extra fields is not the
  // handshake — it is somebody seeing what else gets through.
  const keys = Object.keys(parsed);
  if (keys.length !== 1 || keys[0] !== 'type') return false;
  return parsed.type === ALLOWED_FROM_BROWSER;
}

/**
 * Which paths this gate will serve, and what each one needs.
 *
 * The gate sits on a venture's public hostname, so anything it does not recognise must be refused
 * rather than passed along: an office gate that forwards unknown paths to a machine on loopback is
 * an open door to everything else running on that box.
 *
 * The document needs a ticket. The app's own files do not, and that is deliberate rather than
 * lazy — they are the unmodified files of a public npm package, they carry nothing about the
 * venture, and requiring a ticket for them means rewriting every `url()` inside a stylesheet to
 * carry one, which is a thing that went wrong once already (FB-192). Everything about this venture
 * arrives over the socket, and the socket needs a ticket.
 */
export function routeFor(pathname) {
  if (pathname === '/ws') return { kind: 'socket', needsTicket: true };
  if (pathname === '/' || pathname === '/index.html') return { kind: 'document', needsTicket: true };
  if (pathname === '/api/health') return { kind: 'health', needsTicket: false };
  const asset = /^\/(assets|fonts)((?:\/[A-Za-z0-9._-]+)+)$/.exec(pathname);
  if (asset) {
    // Every segment named, and `.` and `..` are not names.
    //
    // The first version of this regex allowed them, because a dot is a legal character in a
    // filename and `..` is made of legal characters. `/assets/a/../../b` went straight through it.
    // The test that tried it is the reason this line exists — it was written to break the gate and
    // it did, before any of this reached a box.
    const segments = asset[2].split('/').filter(Boolean);
    if (segments.every((seg) => seg !== '.' && seg !== '..')) {
      return { kind: 'asset', needsTicket: false };
    }
  }
  return null;
}

/**
 * The studio's own stylesheet, added to the office's document.
 *
 * pixel-agents is an editor extension and its interface says so: Layout, Settings, a "what's new"
 * card for the version it just updated to, and a version number in the corner. Layout and Settings
 * write to the box, and this gate carries no writes, so pressing them does nothing at all — a
 * control that does nothing is worse than no control. Zoom goes too: the studio shows the office
 * through a window that clips the empty space above the room, and zooming moves the room out from
 * under it.
 *
 * This used to be injected by the studio as the page passed through. With the studio out of the
 * path it is injected here instead. Same list, same reasons, one place further along.
 */
export const CHROME_HIDDEN = [
  '.absolute.top-8.left-8',        // zoom
  '.absolute.bottom-10.left-10',   // Layout and Settings
  '.absolute.bottom-42.right-28',  // "Updated to v1.4! / See what's new"
  '.absolute.bottom-8.right-28',   // the version watermark
];

/** Put the studio's stylesheet into the office's document. */
export function dressDocument(html) {
  const style = `<style data-foundry="office-chrome">${CHROME_HIDDEN.join(',')}{display:none !important}</style>`;
  return html.includes('</head>') ? html.replace('</head>', `${style}</head>`) : `${style}${html}`;
}
