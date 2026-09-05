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

/**
 * Production unless someone asks for development, and `NODE_ENV` set to match.
 *
 * `next start` sets `NODE_ENV=production` itself before it boots. A custom server does not, and
 * nothing else in the stack does it either — so `process.env.NODE_ENV !== 'production'` was true
 * everywhere the studio was not handed the variable, and this file quietly started Next in
 * DEVELOPMENT mode against a production build.
 *
 * That is the whole of FB-163's "the custom server destabilises the suite". The UI gate does
 * `next build` and then starts this server with no `NODE_ENV`, so every gate run since has been a
 * dev server compiling routes on demand, serving a build it was not reading, and running an HMR
 * socket the upgrade handler below was destroying. Measured on the same commit: 280 passed with
 * `NODE_ENV=production`, 3 failures in 52 tests without it, and a run that died outright with
 * `uncaughtException: [Error: aborted] { code: 'ECONNRESET' }`.
 *
 * `--dev` is how you ask for the other thing. Nothing in the studio does; it exists so that running
 * a dev server through this file is a deliberate act rather than an accident of an unset variable.
 */
const dev = process.argv.includes('--dev');
process.env.NODE_ENV = dev ? 'development' : 'production';

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
  // Both handlers come from Next and both are only available once `prepare()` has resolved.
  const upgradeToNext = app.getUpgradeHandler();

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
      // Next's own upgrades — the dev HMR socket is the one that matters — go to Next.
      //
      // This used to call `socket.destroy()`, on the belief that Next had no upgrade of its own.
      // In production that is nearly true; in development it is false, and the studio was tearing
      // down the browser's HMR socket as fast as it could open one. Handing them over costs
      // nothing and means this file cannot silently break a part of Next it does not know about.
      upgradeToNext(req, socket, head);
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

    // The box first, the browser second — and the office already in hand when the browser is
    // answered.
    //
    // The other order is the obvious one and it does not survive a real proxy. FB-195 measured it:
    // the studio answered the handshake at once and then went quiet for the ~400ms it takes to reach
    // Hetzner from Railway, and the browser's connection was cut at around 240ms, every time, before
    // the box had said anything. A ping bought 140ms and no more. Railway's edge relays frames
    // perfectly well — the ping arrives — and then ends a connection that has carried no real
    // traffic.
    //
    // So there is no silent period any more. The studio dials the box, sends the handshake ITSELF
    // rather than waiting to be handed one, and collects the opening burst — the office sends its
    // whole room in one go, about 52 messages, and says nothing at all until it is asked. Only then
    // is the browser's upgrade answered, and the burst goes out immediately behind the 101.
    //
    // Two things fall out of it for free. A box that cannot be reached now answers the browser with
    // a plain 502 instead of a socket that opens and dies, which is a far easier thing to read. And
    // the browser's own `webviewReady`, when it arrives, is simply forwarded: the box answers it
    // again, which costs one more burst and keeps a reconnect working exactly as it did.
    const upstream = new WebSocket(`wss://${host}/office/ws`, {
      headers: { 'X-Foundry-Office': secret },
      handshakeTimeout: 10_000,
    });

    /** The office's opening burst, held until there is a browser to give it to. */
    const opening = [];
    let upgraded = false;
    /** Declared before `giveUp` uses it, and set once the listeners below are in place. */
    let waitingForOffice = null;

    const giveUp = (why) => {
      clearTimeout(waitingForOffice);
      console.error('[office] could not open the office for this browser', { venture: claim.ventureId, why });
      if (!upgraded && !socket.destroyed) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      }
      try { upstream.close(); } catch { /* already gone */ }
    };

    upstream.on('error', (err) => { if (!upgraded) giveUp(err.message); });
    upstream.on('close', () => { if (!upgraded) giveUp('the box closed it before the office answered'); });

    // A box that accepts the connection and then says nothing would leave the browser waiting on an
    // upgrade that never comes. `handshakeTimeout` covers the handshake and not the silence after
    // it, so the silence gets its own limit.
    waitingForOffice = setTimeout(
      () => { if (!upgraded) giveUp('the office did not answer within 10s'); },
      10_000,
    );

    // And a browser that walks away while the box is being dialled must not leave the studio holding
    // a connection to a venture machine for nobody.
    socket.on('close', () => { if (!upgraded) { clearTimeout(waitingForOffice); try { upstream.close(); } catch {} } });

    // The office says nothing until it is asked, so the studio asks. `webviewReady` is the one
    // message that ever travels in this direction (OFFICE_ALLOWED_CLIENT_MESSAGES), so this is the
    // studio saying exactly what a browser would say and nothing a browser could not.
    upstream.on('open', () => upstream.send(JSON.stringify({ type: 'webviewReady' })));

    upstream.on('message', (data, isBinary) => {
      if (!upgraded) { opening.push([data, isBinary]); return; }
      if (client && client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
    });

    let client = null;

    // The first thing the office says is the signal that there is an office to show. Everything it
    // says after that, up to the moment the browser is upgraded, waits in `opening`.
    upstream.once('message', () => {
      clearTimeout(waitingForOffice);
      wss.handleUpgrade(req, socket, head, (ws) => {
        client = ws;
        upgraded = true;
        const openedAt = Date.now();
        let ended = null;

        // Straight out behind the 101, so the connection carries real traffic from its first
        // moment. This is the whole point of the order above.
        while (opening.length) {
          const [data, isBinary] = opening.shift();
          ws.send(data, { binary: isBinary });
        }

        // And kept alive through the quiet spells afterwards, which are most of the day. A ping is
        // protocol-level, so the office app never sees it and has nothing to misparse.
        const beat = () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          try { ws.ping(); } catch { /* it is going away anyway */ }
        };
        const heartbeat = setInterval(beat, 20_000);

        // Which side ended it, and how long it lasted. FB-194: `shut()` used to be called from four
        // places and say nothing about which, so the only line in the log was the CONSEQUENCE of
        // shutting down mid-connect, and it read like the box being unreachable. It never was.
        const shut = (why) => {
          if (ended) return;
          ended = why;
          clearInterval(heartbeat);
          console.log('[office] the office socket ended', {
            venture: claim.ventureId,
            endedBy: why,
            afterMs: Date.now() - openedAt,
            browser: ws.readyState,
            box: upstream.readyState,
          });
          try { ws.close(); } catch {}
          try { upstream.close(); } catch {}
        };

        // browser → box: the handshake and nothing else.
        //
        // `closeAgent` is accepted by the box from any connection and removes an agent; only the
        // hooks install is token-gated upstream. So read-only cannot be a setting on the box — it is
        // this allow-list, and anything not on it is dropped without an answer.
        ws.on('message', (data) => {
          const raw = data.toString();
          if (!officeMessageAllowed(raw)) return;
          if (upstream.readyState === WebSocket.OPEN) upstream.send(raw);
        });

        ws.on('close', (code, reason) => shut(`the browser closed it (${code}${reason?.length ? ` ${reason}` : ''})`));
        ws.on('error', (err) => shut(`the browser's socket errored (${err.message})`));
        upstream.on('close', (code) => shut(`the box closed it (${code})`));
        upstream.on('error', (err) => shut(`the box could not be reached (${err.message})`));
      });
    });
  });

  server.listen(port, () => {
    console.log(`  ▲ studio ready on http://localhost:${port} (custom server, office socket on /ws)`);
  });
});
