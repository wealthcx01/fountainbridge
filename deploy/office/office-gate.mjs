/**
 * The venture office's gate (FB-198).
 *
 * Sits on loopback in front of pixel-agents and is the only thing between a browser and this
 * venture's machine. Everything it decides is in `office-gate-lib.mjs`, with the reasons, and is
 * tested there by trying to break it.
 *
 *   browser ──https──▶ Caddy ──▶ this gate (127.0.0.1:4311) ──▶ pixel-agents (127.0.0.1:4310)
 *
 * Two jobs, and nothing else:
 *
 *   1. Check the studio's ticket. The studio issues one only to someone who has passed
 *      `canAccessVenture`, so which venture a person may watch is still decided by the studio,
 *      server-side (CLAUDE.md #6). This box only checks that the studio said so.
 *   2. Refuse to carry anything from the browser except the office's own handshake. pixel-agents
 *      accepts `closeAgent` from any connection; read-only is this filter and nothing else.
 *
 * It fails closed. No secret, no venture id, no service — it refuses to start rather than serve
 * a venture's machine to whoever asks (CLAUDE.md #10).
 */
import { createServer, request as httpRequest } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { readTicket, allowedFromBrowser, routeFor, dressDocument } from './office-gate-lib.mjs';

const VENTURE = process.env.OFFICE_VENTURE?.trim();
const SECRET = process.env.OFFICE_SECRET?.trim();
const PORT = Number(process.env.OFFICE_GATE_PORT || 4311);
const UPSTREAM_PORT = Number(process.env.OFFICE_UPSTREAM_PORT || 4310);
const UPSTREAM_HOST = '127.0.0.1';

/**
 * Who may put this office in a frame.
 *
 * Configuration rather than a constant, because the studio's address is not this box's business to
 * know and a wrong guess is a blank frame with the reason buried in a browser console — which is
 * exactly how this was found. `'none'` is the default: a box that has not been told who may frame
 * it should refuse everyone rather than guess.
 *
 * It is defence in depth and not the lock. The lock is the ticket: a page that frames this office
 * without one is shown nothing at all.
 */
const FRAME_ANCESTORS = process.env.OFFICE_FRAME_ANCESTORS?.trim() || "'none'";

if (!VENTURE || !SECRET) {
  console.error('[office-gate] refusing to start: OFFICE_VENTURE and OFFICE_SECRET are both required');
  process.exit(1);
}

const ticketFrom = (url) => {
  try { return new URL(url, 'http://gate.invalid').searchParams.get('token'); } catch { return null; }
};
const pathFrom = (url) => {
  try { return new URL(url, 'http://gate.invalid').pathname; } catch { return null; }
};

const refuse = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
};

const server = createServer((req, res) => {
  // A visitor who walks away mid-request is ordinary, and an unheard 'error' on a stream is an
  // uncaught exception that takes the process with it.
  req.on('error', () => {});
  res.on('error', () => {});

  const pathname = pathFrom(req.url);
  const route = pathname && routeFor(pathname);

  // Anything not named is refused rather than passed along. This gate is on a public hostname and
  // the thing behind it is on loopback: forwarding an unknown path would be a door into the rest
  // of the box.
  if (!route) return refuse(res, 404, 'Not found.');
  if (req.method !== 'GET' && req.method !== 'HEAD') return refuse(res, 405, 'The office is a view.');

  if (route.needsTicket && !readTicket(ticketFrom(req.url), { venture: VENTURE, secret: SECRET })) {
    return refuse(res, 401, 'This office is watched from the studio.');
  }

  const upstream = httpRequest(
    { host: UPSTREAM_HOST, port: UPSTREAM_PORT, path: pathname, method: req.method, headers: { host: 'localhost' } },
    (up) => {
      const type = up.headers['content-type'] ?? '';
      const headers = {
        'content-type': type,
        // The office is live: a cached sprite sheet is fine, a cached picture of the room is not.
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        // Framed by the studio and by nothing else.
        'content-security-policy': `frame-ancestors ${FRAME_ANCESTORS}`,
        // The frame is sandboxed without `allow-same-origin`, on purpose: pixel-agents is code we
        // do not write, and an opaque origin means it can never reach the studio's cookies or its
        // server actions. The cost is that every file it then pulls is a cross-origin fetch from
        // `null`, and without this header the browser refuses them and the room stays blank.
        //
        // It is safe because there is nothing here to borrow. These requests carry no cookie and no
        // credential; the ticket is in the URL, and a page that does not have one is shown nothing.
        'access-control-allow-origin': '*',
      };

      // The document gets the studio's stylesheet before it goes out; everything else is passed
      // through byte for byte.
      if (type.includes('text/html')) {
        let html = '';
        up.setEncoding('utf8');
        up.on('data', (chunk) => { html += chunk; });
        up.on('end', () => {
          const dressed = dressDocument(html);
          res.writeHead(up.statusCode ?? 200, { ...headers, 'content-length': Buffer.byteLength(dressed) });
          res.end(dressed);
        });
        up.on('error', () => refuse(res, 502, 'The office is not answering.'));
        return;
      }

      res.writeHead(up.statusCode ?? 200, headers);
      up.pipe(res);
    },
  );

  upstream.on('error', () => refuse(res, 502, 'The office is not answering.'));
  upstream.end();
});

// Malformed request line or headers: answer if we still can, hang up either way. The default is to
// throw, which would take the gate down.
server.on('clientError', (_err, socket) => {
  if (!socket.writable || socket.destroyed) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// `noServer` is what makes the ticket check unavoidable: there is no path to this WebSocket server
// except the handler below.
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {});

  const pathname = pathFrom(req.url);
  if (pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!readTicket(ticketFrom(req.url), { venture: VENTURE, secret: SECRET })) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    const office = new WebSocket(`ws://${UPSTREAM_HOST}:${UPSTREAM_PORT}/ws`, { handshakeTimeout: 5_000 });
    const openedAt = Date.now();
    let ended = null;

    const shut = (why) => {
      if (ended) return;
      ended = why;
      console.log('[office-gate] a watcher left', { venture: VENTURE, endedBy: why, afterMs: Date.now() - openedAt });
      try { client.close(); } catch { /* going anyway */ }
      try { office.close(); } catch { /* going anyway */ }
    };

    // office → browser: everything. This is the direction that carries the room.
    office.on('message', (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });

    // The office says nothing until it is asked, and the browser's own ask has to cross the whole
    // internet to get here. Asking on its behalf starts the room coming immediately; the browser's
    // copy is forwarded when it arrives and the office simply answers again.
    office.on('open', () => office.send(JSON.stringify({ type: 'webviewReady' })));

    // browser → office: the handshake, and nothing else, ever.
    client.on('message', (data, isBinary) => {
      if (!allowedFromBrowser(isBinary ? data : data.toString(), isBinary)) return;
      if (office.readyState === WebSocket.OPEN) office.send(data.toString());
    });

    client.on('close', (code) => shut(`the browser closed it (${code})`));
    client.on('error', (err) => shut(`the browser's socket errored (${err.message})`));
    office.on('close', (code) => shut(`the office closed it (${code})`));
    office.on('error', (err) => shut(`the office could not be reached (${err.message})`));
  });
});

server.listen(PORT, UPSTREAM_HOST, () => {
  console.log(`[office-gate] watching ${VENTURE}'s office on ${UPSTREAM_HOST}:${PORT} → ${UPSTREAM_HOST}:${UPSTREAM_PORT}`);
});
