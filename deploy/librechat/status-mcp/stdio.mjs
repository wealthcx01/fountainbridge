// Foundry status connector — stdio MCP server (FB-036), READ-ONLY.
//
// Lets a founder ask the composer "what's in review?" / "what shipped recently?" and get the
// venture's real GitHub state. Two tools, both read-only GETs against VENTURE_REPO:
//   - list_open_prs        → open pull requests (what's in review / being worked)
//   - list_recent_activity → recently merged/closed PRs (what shipped recently)
//
// Same durable shape as the ticket-filer (FB-033): a zero-dependency stdio MCP server spawned inside
// the api container by its own node — no URL, no SSRF, no node_modules. Depends only on node + fetch.
//
// Auth: STATUS_GITHUB_TOKEN, falling back to TICKET_GITHUB_TOKEN (which already has PR read on the
// venture repo). This connector NEVER writes — read-only by construction (only GET requests).
//
// STDOUT carries ONLY protocol messages (newline-delimited JSON). All logging goes to STDERR.

import readline from 'node:readline';

// LibreChat passes the literal ${VAR} when the referenced env var is empty — treat that as unset.
function envVal(name) {
  const v = process.env[name];
  if (!v || /^\$\{.+\}$/.test(v.trim())) return '';
  return v.trim();
}

const REPO = envVal('VENTURE_REPO') || 'wealthcx01/arca';
const TOKEN = envVal('STATUS_GITHUB_TOKEN') || envVal('TICKET_GITHUB_TOKEN');
const API = 'https://api.github.com';

const log = (...a) => console.error('[status-connector]', ...a);

// READ-ONLY BY CONTRACT: this helper takes only a path and issues a bare GET (no method param, no
// body). Do NOT add a method/init argument here — the connector's read-only guarantee rests on this.
// Any write capability belongs in a separate, explicitly-authorised tool (e.g. the ticket-filer).
async function gh(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    let msg = '';
    try { msg = (JSON.parse(await res.text()) || {}).message || ''; } catch { /* non-JSON */ }
    const err = new Error(`GitHub ${res.status}${msg ? `: ${msg}` : ''}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function friendlyError(e) {
  const s = e && e.status;
  if (!s) return String((e && e.message) || e);
  if (s === 401) return "I couldn't check GitHub — the connector's access token was rejected (it may have expired). An admin needs to refresh it.";
  if (s === 403) return 'GitHub is temporarily rate-limiting the request. Please try again in a few minutes.';
  if (s === 404) return "I couldn't reach the venture's repo on GitHub — an admin should check the connector's repo setting.";
  return `I couldn't check GitHub right now (${s}). Please try again shortly.`;
}

function requireToken() {
  if (!TOKEN) {
    throw new Error(
      'The status connector is installed but not yet authorized (no token on the box). ' +
      'Ask an admin to add a read token for the venture repo.',
    );
  }
}

async function listOpenPrs() {
  requireToken();
  const prs = await gh(`/repos/${REPO}/pulls?state=open&sort=updated&direction=desc&per_page=30`);
  const items = prs.map((p) => ({
    number: p.number,
    title: p.title,
    url: p.html_url,
    branch: p.head?.ref,
    author: p.user?.login,
    draft: p.draft,
    updated: p.updated_at,
  }));
  return { repo: REPO, open_pr_count: items.length, pull_requests: items };
}

async function listRecentActivity() {
  requireToken();
  const prs = await gh(`/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=15`);
  const items = prs.map((p) => ({
    number: p.number,
    title: p.title,
    url: p.html_url,
    merged: Boolean(p.merged_at),
    closed_at: p.closed_at,
  }));
  return { repo: REPO, recent: items };
}

const TOOLS = [
  {
    name: 'list_open_prs',
    description:
      "List the venture's open pull requests — what is currently in review or being worked on. " +
      'Read-only. Use when the founder asks "what\'s in review?", "what\'s being worked on?", etc.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    run: listOpenPrs,
  },
  {
    name: 'list_recent_activity',
    description:
      "List the venture's recently closed/merged pull requests — what shipped or was decided " +
      'recently. Read-only. Use when the founder asks "what shipped recently?", "what\'s new?".',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    run: listRecentActivity,
  },
];

// ---- Minimal MCP JSON-RPC over stdio (same shape as the ticket-filer) -------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}
function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'foundry-status-connector', version: '1.0.0' },
      });
      return;
    case 'notifications/initialized':
    case 'initialized':
      return;
    case 'ping':
      if (!isNotification) reply(id, {});
      return;
    case 'tools/list':
      reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      return;
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) {
        reply(id, { content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }], isError: true });
        return;
      }
      try {
        const data = await tool.run();
        reply(id, { content: [{ type: 'text', text: JSON.stringify(data) }] });
      } catch (e) {
        log(`${tool.name} failed:`, String(e));
        reply(id, { content: [{ type: 'text', text: friendlyError(e) }], isError: true });
      }
      return;
    }
    default:
      if (!isNotification) replyError(id, -32601, `Method not found: ${method}`);
      return;
  }
}

log(`starting (repo=${REPO}, authorized=${Boolean(TOKEN)})`);
const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { log('non-JSON line ignored'); return; }
  Promise.resolve(handle(msg)).catch((e) => log('handler error:', String(e)));
});
rl.on('close', () => process.exit(0));
