/**
 * The studio's own server (FB-163).
 *
 * ## Why this file exists
 *
 * FB-163 recorded that the studio "cannot proxy a WebSocket", because Next's App Router route
 * handlers do not support an upgrade and "Railway runs `next start`". The first half is true. The
 * second was our own start command in `railway.json`, not a constraint — so the studio can hold the
 * upgrade itself, and does, here.
 *
 * The usual objection to a custom server is losing Automatic Static Optimization. There is nothing
 * to lose: `next build` reports one static route in this app (the web manifest) and every other one
 * is server-rendered on demand. Checked before this was written, not assumed.
 *
 * What it buys: the venture office is proxied by the studio, so isolation stays on the studio's
 * session (CLAUDE.md #6), no credential or hostname of the venture box reaches a browser
 * (CLAUDE.md #8), and there is no second service to deploy and operate.
 *
 * Everything that is not the office socket is handed straight to Next.
 */
import { createServer } from 'node:http';
import { parse } from 'node:url';
import { createHmac, timingSafeEqual } from 'node:crypto';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * The port, from `--port`/`-p` or `PORT`.
 *
 * `next start` accepted the flag, so everything that starts the studio passes it — the Playwright
 * gate runs `npm run start -- --port 3100`. Reading only `PORT` made this a drop-in replacement that
 * silently listened somewhere else, and every test in the suite timed out at once.
 */
function portFromArgs(argv) {
  const i = argv.findIndex((a) => a === '--port' || a === '-p');
  if (i !== -1 && argv[i + 1]) return Number(argv[i + 1]);
  const inline = argv.find((a) => a.startsWith('--port='));
  return inline ? Number(inline.slice('--port='.length)) : null;
}

const port = portFromArgs(process.argv.slice(2)) || Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

/** Kept in step with `lib/office-embed.ts`; this file cannot import TypeScript. */
const OFFICE_TOKEN_RE = /^([A-Za-z0-9_-]+)\.(\d+)\.([A-Za-z0-9_-]+)$/;

function readOfficeToken(token, secret, now = Date.now()) {
  if (!token || !secret) return null;
  const m = OFFICE_TOKEN_RE.exec(token);
  if (!m) return null;
  const [, ventureId, expRaw, mac] = m;
  if (Number(expRaw) < now) return null;
  const expected = createHmac('sha256', secret).update(`${ventureId}.${expRaw}`).digest('base64url');
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { ventureId };
}

function officeMessageAllowed(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return false; }
  if (!parsed || typeof parsed !== 'object') return false;
  return parsed.type === 'webviewReady';
}

const envName = (id) => `OFFICE_SECRET_${String(id).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // A client that walks away mid-request is ordinary — a founder closing a tab, a browser
    // cancelling a prefetch. Node reports it by emitting 'error' on the request and the response,
    // and an unheard 'error' on a stream is an uncaught exception that takes the process with it.
    //
    // `next start` was doing this for us. It is the real cost of running our own server, it is not
    // optional, and it is not theoretical: without these three lines the studio died partway
    // through the test suite with `uncaughtException: [Error: aborted] { code: 'ECONNRESET' }`, and
    // 49 tests failed after it.
    req.on('error', () => {});
    res.on('error', () => {});
    handle(req, res, parse(req.url, true)).catch((err) => {
      console.error('[studio] request failed', { url: req.url, message: err?.message });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  // A malformed request line or header. Answer if we still can, hang up either way — the default is
  // to throw, which is the same fatal shape as above.
  server.on('clientError', (err, socket) => {
    if (!socket.writable || socket.destroyed) return;
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  // One WebSocket server, no HTTP server of its own — it is fed by the upgrade handler below, which
  // is where the token is checked. `noServer` is what keeps the check unavoidable.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    // An upgrade socket that errors with nobody listening takes the whole studio down with it —
    // `net.Socket` emits 'error' as an unhandled exception. A client that vanishes mid-handshake is
    // ordinary, so this is attached before anything else can go wrong.
    socket.on('error', () => {});

    const { pathname, query } = parse(req.url || '', true);
    if (pathname !== '/ws') {
      // Next has no upgrade of its own to serve. Anything else is refused rather than left hanging.
      socket.destroy();
      return;
    }

    const claim = readOfficeToken(query.token, process.env.FOUNDRY_APPROVAL_SECRET);
    if (!claim) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const secret = process.env[envName(claim.ventureId)];
    const host = process.env[`OFFICE_HOST_${String(claim.ventureId).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
    if (!secret || !host) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    // The 101 goes out immediately, and the box is dialled behind it.
    //
    // The other order looks safer and does not work: leave the raw socket unanswered while the box's
    // TLS handshake completes and it is closed out from under you in about eight milliseconds —
    // measured, with a browser and with a plain client, both the same. `ws` has to take the socket
    // over first.
    //
    // Which leaves a real window: the app sends its handshake the instant its socket opens, and the
    // studio has nowhere to put it for the ~20ms the box takes to answer. Dropping it is not
    // harmless — the box has nothing to reply to, the app waits, times out and reconnects, for
    // ever. So it waits in `pending` and is flushed on open.
    wss.handleUpgrade(req, socket, head, (client) => {
      const upstream = new WebSocket(`wss://${host}/office/ws`, {
        headers: { 'X-Foundry-Office': secret },
        handshakeTimeout: 10_000,
      });

      const pending = [];
      const shut = () => {
        try { client.close(); } catch {}
        try { upstream.close(); } catch {}
      };

      // box → browser: everything. This is the direction that carries the office.
      upstream.on('message', (data, isBinary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
      });

      upstream.on('open', () => {
        while (pending.length) upstream.send(pending.shift());
      });

      // browser → box: the handshake and nothing else.
      //
      // `closeAgent` is accepted by the box from any connection and removes an agent; only the hooks
      // install is token-gated upstream. So read-only cannot be a setting on the box — it is this
      // allow-list, and anything not on it is dropped without an answer.
      client.on('message', (data) => {
        const raw = data.toString();
        if (!officeMessageAllowed(raw)) return;
        if (upstream.readyState === WebSocket.OPEN) upstream.send(raw);
        else if (pending.length < 8) pending.push(raw);
      });

      client.on('close', shut);
      client.on('error', shut);
      upstream.on('close', shut);
      upstream.on('error', (err) => {
        console.error('[office] could not reach the venture office', {
          venture: claim.ventureId, message: err.message,
        });
        shut();
      });
    });
  });

  server.listen(port, () => {
    console.log(`  ▲ studio ready on http://localhost:${port} (custom server, office socket on /ws)`);
  });
});
