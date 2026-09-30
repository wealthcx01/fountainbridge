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

/**
 * How long since an agent's transcript was written before the office stops drawing it (FB-218).
 *
 * A Claude session writes to its `.jsonl` continuously while it works and stops the moment it ends.
 * That is the ONLY per-agent signal on this box that separates working from finished, and it took
 * three measurements on ARCA to establish that:
 *
 *   - The agent record in `standalone-state.json` carries `id, sessionId, jsonlFile, projectDir,
 *     palette, hueShift` and **no status and no timestamp**. pixel-agents has no concept of an agent
 *     ending, so there is nothing in its registry to reap by.
 *   - Its own `agentStatus` message is no help either: all 120 agents reported `waiting`, including
 *     the hundred whose transcripts had not been touched for over a day. `waiting` is its resting
 *     state for everything, not a claim about liveness.
 *   - `watchAllSessions` was NOT the cause. `settingsLoaded` reports it as `false` while the office
 *     still held 120 agents, so the earlier diagnosis blaming that flag was wrong. The cause is
 *     simply that the lane opens a new session per wake and pixel-agents never removes one.
 *
 * Thirty minutes, because a lane round can sit inside a single long model call and a founder must
 * never watch a working agent vanish. It is generous on purpose: this bounds a room that reached 120,
 * so precision is not what it is for.
 */
export const LIVE_WINDOW_MS = Number(process.env.OFFICE_LIVE_WINDOW_MS || 30 * 60 * 1000);

/**
 * Keep the agents that are working; drop the ones that finished.
 *
 * Why this runs in the gate rather than on the office: pixel-agents is an npm package that
 * `provision-office.sh` reinstalls at a pinned version, so anything edited inside it is overwritten
 * on the next provision. The gate is ours and is already the only thing between a browser and this
 * machine, which makes it the one place a bound can be stated and kept.
 *
 * Why this is more truthful rather than less: the office was drawing 120 figures over a machine where
 * **nothing had run for two hours**. Dropping the finished ones does not hide work, it stops the room
 * claiming work that ended days ago — which is the failure CLAUDE.md #10 exists to forbid. When the
 * lane is genuinely busy every one of its agents is writing, so every one of them passes.
 *
 * `mtimeOf` is injected so the tests can drive time instead of touching a filesystem.
 *
 * @param {{type: string, agents: number[], agentMeta?: object, externalAgents?: object, folderNames?: object}} roster
 * @param {Map<number, string>} files  agent id → its transcript path
 * @param {(path: string) => number | null} mtimeOf  epoch ms, or null when the file is gone
 * @param {number} now
 * @returns the roster with only live agents, and the ids that were dropped
 */
export function liveRoster(roster, files, mtimeOf, now = Date.now(), windowMs = LIVE_WINDOW_MS) {
  const ids = Array.isArray(roster?.agents) ? roster.agents : [];
  const live = [];
  const dropped = [];

  for (const id of ids) {
    const path = files.get(id);
    // No transcript recorded for this id is not evidence that it finished. It is evidence that we
    // cannot tell, and the office should keep drawing what it has rather than delete a figure on a
    // guess. Fail towards showing, because an empty office over a working machine is the worse lie.
    if (!path) { live.push(id); continue; }
    const at = mtimeOf(path);
    if (at === null || at === undefined) { dropped.push(id); continue; }
    (now - at <= windowMs ? live : dropped).push(id);
  }

  const keep = new Set(live);
  const only = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (keep.has(Number(k))) out[k] = v;
    return out;
  };

  return {
    roster: {
      ...roster,
      agents: live,
      ...(roster.agentMeta ? { agentMeta: only(roster.agentMeta) } : {}),
      ...(roster.externalAgents ? { externalAgents: only(roster.externalAgents) } : {}),
    },
    dropped,
  };
}

/**
 * Messages that name a single agent, and so must not reach the browser for one we dropped.
 *
 * Without this the room refills itself: `agentStatus` arrives for agent 97, the browser has never
 * heard of 97, and it draws it anyway. Filtering the roster and then forwarding per-agent traffic for
 * agents not in it would have looked like the bound failing at random.
 */
export const PER_AGENT_MESSAGES = new Set(['agentStatus', 'agentContextUsage', 'agentActivity']);

/**
 * Should this office→browser message be forwarded, given the agents we decided are working?
 *
 * Anything that is not about one specific agent passes untouched — the room, the sprites, the layout,
 * the settings. This only ever withholds news about an agent the browser was never told exists.
 */
export function forwardToBrowser(message, keptIds) {
  if (!message || typeof message !== 'object') return true;
  if (!PER_AGENT_MESSAGES.has(message.type)) return true;
  return keptIds.has(message.id);
}

/**
 * Where the lane records which ticket each session was working (FB-231).
 *
 * One JSON object per line: `{"session":"<uuid>","ticket":"ARCA-61","stage":"implement","at":"…"}`.
 * The lane appends; nothing ever rewrites it. An append-only log of operational facts, not a record of
 * anything a founder reads — the RunReport remains that, and this deliberately does not duplicate it.
 *
 * Read from disk rather than passed in, because the gate and the lane are separate services on the same
 * machine and a file is the cheapest thing they can both reach.
 */
export const SESSION_INDEX_DEFAULT = '/opt/foundry/lane/state/sessions.jsonl';

/**
 * session id → ticket, from the lane's index.
 *
 * Tolerant on purpose: a malformed line is skipped rather than throwing, because a half-written line is
 * normal for a file being appended to while it is read. The last entry for a session wins, so a session
 * re-recorded under a corrected ticket takes the correction.
 */
export function ticketsBySession(indexText) {
  const out = new Map();
  for (const line of String(indexText ?? '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t);
      if (typeof row?.session === 'string' && typeof row?.ticket === 'string' && row.ticket) {
        out.set(row.session, row.ticket);
      }
    } catch { /* a half-written line is normal while the lane is appending */ }
  }
  return out;
}

/** The session id out of a transcript path: `/…/<uuid>.jsonl` → `<uuid>`. */
export function sessionIdFromPath(path) {
  const m = /([^/\\]+)\.jsonl$/.exec(String(path ?? ''));
  return m ? m[1] : null;
}

/**
 * One character per ticket, helpers invisible (FB-231).
 *
 * **Ruled by John on 2026-09-30**: *"one machine and one character per ticket, helpers invisible."* So a
 * character means a piece of work, not an agent and not a department.
 *
 * ## Why this is needed on top of the liveness bound
 *
 * FB-218 stopped the room filling with agents that had finished. It did not stop **one ticket being drawn
 * many times over**, and nobody had ruled on that yet. `supervisor.sh` calls `claude_lane` five times per
 * round — plan, implement, gate check, review, qa — each a fresh `claude -p` writing its own transcript,
 * and `MAX_VALIDATION_ROUNDS` defaults to 2. **So one ticket produced between five and eleven characters.**
 *
 * ## What it keeps
 *
 * The **most recently active** session for each ticket, so the character tracks the work rather than
 * whichever stage happened to start first. Everything else for that ticket is collapsed into it.
 *
 * An agent whose session is not in the index is **kept, not dropped**. No record is "we cannot tell", not
 * "this is a helper" — the same fail-towards-showing rule as the liveness bound, for the same reason: an
 * empty office over a working machine is the worse lie.
 */
export function oneCharacterPerTicket(roster, ticketOf, files, mtimeOf) {
  const ids = Array.isArray(roster?.agents) ? roster.agents : [];
  const bestForTicket = new Map();
  const keep = [];
  const collapsed = [];

  for (const id of ids) {
    const session = sessionIdFromPath(files.get(id));
    const ticket = session ? ticketOf.get(session) : undefined;
    if (!ticket) { keep.push(id); continue; }

    const at = mtimeOf(files.get(id)) ?? 0;
    const held = bestForTicket.get(ticket);
    if (!held) { bestForTicket.set(ticket, { id, at }); continue; }
    // The newer transcript is the one still being written, so it is the one to draw.
    if (at > held.at) { bestForTicket.set(ticket, { id, at }); collapsed.push(held.id); }
    else collapsed.push(id);
  }

  for (const { id } of bestForTicket.values()) keep.push(id);
  // Back into the office's own order, so the room does not reshuffle between messages.
  const order = new Map(ids.map((id, i) => [id, i]));
  keep.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  const kept = new Set(keep);
  const only = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (kept.has(Number(k))) out[k] = v;
    return out;
  };

  return {
    roster: {
      ...roster,
      agents: keep,
      ...(roster.agentMeta ? { agentMeta: only(roster.agentMeta) } : {}),
      ...(roster.externalAgents ? { externalAgents: only(roster.externalAgents) } : {}),
    },
    collapsed,
    // What each drawn character is working, so a surface above can say so rather than only draw it.
    ticketOfAgent: Object.fromEntries([...bestForTicket].map(([ticket, { id }]) => [id, ticket])),
  };
}
