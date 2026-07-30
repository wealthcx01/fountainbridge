// Foundry venture-brain search — stdio MCP server (FB-050), READ-ONLY.
//
// Lets the composer answer from everything the venture knows — the founder's deposited context
// (FB-043), the library, the ticket backlog and the code — instead of only the files attached to
// this chat. Closes the last of the FB-034 silo: LibreChat's per-chat store defers to the brain,
// which indexes git (D8).
//
// SHAPE. Same zero-dependency stdio server as the ticket-filer (FB-033) and status connector
// (FB-036): spawned inside the api container by its own node, no URL allowlist, no SSRF surface,
// no node_modules. gbrain itself runs on the HOST (its brain is a single-writer local database that
// must never leave the box), so this forwards to the host's read-only brain bridge
// (deploy/lane/brain-bridge.mjs) over the docker bridge.
//
// READ-ONLY BY CONTRACT: one tool, one POST to the bridge's /query. The bridge in turn runs a fixed
// `gbrain call query` argv. Nothing here can write to the brain or to git — depositing is the
// separate, explicitly-authorised deposit tool (FB-043).
//
// STDOUT carries ONLY protocol messages (newline-delimited JSON). All logging goes to STDERR.

import readline from 'node:readline';

// LibreChat passes the literal ${VAR} when the referenced env var is empty — treat that as unset.
function envVal(name) {
  const v = process.env[name];
  if (!v || /^\$\{.+\}$/.test(v.trim())) return '';
  return v.trim();
}

const BRIDGE = envVal('FOUNDRY_BRAIN_URL') || 'http://host.docker.internal:3131';
const TOKEN = envVal('FOUNDRY_BRAIN_TOKEN');
const TIMEOUT_MS = Number(envVal('FOUNDRY_BRAIN_TIMEOUT_MS') || 120000);
const log = (...a) => console.error('[venture-brain]', ...a);

const UNAVAILABLE =
  "I couldn't search the venture's knowledge just now — the brain service on the box isn't " +
  'answering. An admin should check `systemctl status foundry-brain-bridge`. (Anything you have ' +
  'attached to this chat still works.)';

async function searchBrain({ question, department }) {
  if (!TOKEN) {
    throw new Error(
      'The venture brain is installed but not yet authorized on this box (no bridge token). ' +
      'Ask an admin to set FOUNDRY_BRAIN_TOKEN for the composer.',
    );
  }
  if (!question || !String(question).trim()) throw new Error('question is required');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${BRIDGE}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: String(question), department: department || null, limit: 12 }),
      signal: controller.signal,
    });
  } catch (e) {
    log('bridge unreachable:', String(e));
    throw new Error(UNAVAILABLE);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    throw new Error(
      "I couldn't search the venture's knowledge — the brain rejected this connector's token. " +
      'An admin needs to align FOUNDRY_BRAIN_TOKEN on the box and in the composer.',
    );
  }
  if (res.status === 503) {
    // Busy is not broken — sending the founder to check a systemd unit would be a wild goose chase.
    throw new Error(
      "The venture's knowledge is being re-indexed right now, so I couldn't search it this second. " +
      'Ask me again in a minute and it should be back.',
    );
  }
  if (!res.ok) {
    log('bridge error', res.status);
    throw new Error(UNAVAILABLE);
  }

  const data = await res.json();
  if (!data || !data.digest) {
    return {
      found: 0,
      answer:
        "Nothing in the venture's knowledge covers that yet. If it matters, tell me and I can save " +
        'it so every lane can use it.',
    };
  }
  return { found: data.found || 0, pages: data.pages || [], answer: data.digest };
}

const TOOL = {
  name: 'search_venture_brain',
  description:
    "Search everything the venture knows — the founder's saved context and library, the ticket " +
    'backlog, and the code — and get the relevant passages back. Read-only. Use this BEFORE ' +
    'answering questions about the venture (audience, brand, positioning, pricing, what was ' +
    'decided, how something works) so the answer reflects the whole venture, not just this chat.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['question'],
    properties: {
      question: { type: 'string', description: 'what you want to know, in plain English' },
      department: {
        type: 'string',
        enum: ['build', 'sell', 'scale'],
        description: 'optional: narrow to one surface. Omit to search the whole venture.',
      },
    },
  },
};

// ---- Minimal MCP JSON-RPC over stdio (same shape as the status connector) ---------------------------
function send(m) { process.stdout.write(JSON.stringify(m) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function replyError(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'foundry-venture-brain', version: '1.0.0' },
      });
      return;
    case 'notifications/initialized':
    case 'initialized':
      return;
    case 'ping':
      if (!isNotification) reply(id, {});
      return;
    case 'tools/list':
      reply(id, { tools: [TOOL] });
      return;
    case 'tools/call': {
      if (params?.name !== TOOL.name) {
        reply(id, { content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }], isError: true });
        return;
      }
      try {
        const r = await searchBrain(params.arguments || {});
        reply(id, { content: [{ type: 'text', text: JSON.stringify(r) }] });
      } catch (e) {
        log('search failed:', String(e));
        reply(id, { content: [{ type: 'text', text: String((e && e.message) || e) }], isError: true });
      }
      return;
    }
    default:
      if (!isNotification) replyError(id, -32601, `Method not found: ${method}`);
      return;
  }
}

log(`starting (bridge=${BRIDGE}, authorized=${Boolean(TOKEN)})`);
const rl = readline.createInterface({ input: process.stdin, terminal: false });

// A brain query is a network round trip, so unlike the sibling connectors we track what is in
// flight: exiting the moment stdin closes would drop a reply the client is still waiting on.
const inFlight = new Set();
rl.on('line', (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { log('non-JSON line ignored'); return; }
  const p = Promise.resolve(handle(msg))
    .catch((e) => log('handler error:', String(e)))
    .finally(() => inFlight.delete(p));
  inFlight.add(p);
});
rl.on('close', async () => {
  if (inFlight.size) {
    await Promise.race([
      Promise.allSettled([...inFlight]),
      new Promise((r) => setTimeout(r, TIMEOUT_MS + 1000)),
    ]);
  }
  process.exit(0);
});
