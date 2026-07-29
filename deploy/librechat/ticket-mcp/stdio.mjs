// Foundry ticket-filer — stdio MCP server (FB-033).
//
// Exposes one tool, `file_venture_ticket`, that the Foundry composer calls AFTER the founder
// approves a drafted ticket: it opens a PR adding the ticket to the venture repo's docs/tickets/ on
// a new branch. Nothing merges (non-negotiable 2 + 4): a human still reviews + merges the PR. The
// studio then renders it on the venture board.
//
// TRANSPORT: stdio. LibreChat spawns this file with the api container's own `node` (see
// librechat.yaml mcpServers.ticket-filer). stdio servers are a local child process — no URL — so
// they bypass LibreChat's SSRF/domain allowlist entirely (which blocked the old streamable-http
// server). Ref: https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/mcp_servers
//
// ZERO DEPENDENCIES: implements the MCP JSON-RPC handshake directly over stdin/stdout, using only
// node built-ins (global fetch, node:readline). No @modelcontextprotocol/sdk, no node_modules to
// mount — portable across LibreChat's :latest image churn.
//
// Auth: TICKET_GITHUB_TOKEN (write-scoped fine-grained PAT for VENTURE_REPO). Repo: VENTURE_REPO.
//
// STDOUT carries ONLY protocol messages (newline-delimited JSON). All logging goes to STDERR.

import readline from 'node:readline';

// LibreChat interpolates ${VAR} in the yaml `env:` block from its own process.env, but when the
// referenced var is empty/unset it passes the LITERAL "${VAR}" placeholder through (see
// extractEnvVariable in librechat-data-provider). Treat an unresolved placeholder as empty so the
// tool fails CLOSED (clean "not yet authorized") instead of sending a garbage bearer to GitHub.
function envVal(name) {
  const v = process.env[name];
  if (!v || /^\$\{.+\}$/.test(v.trim())) return '';
  return v.trim();
}

const REPO = envVal('VENTURE_REPO') || 'wealthcx01/arca';
const TOKEN = envVal('TICKET_GITHUB_TOKEN');   // only this token — never an ambient GITHUB_TOKEN
const API = 'https://api.github.com';

const log = (...a) => console.error('[ticket-filer]', ...a);

// gh() throws an Error carrying a numeric `.status` so callers classify by HTTP status, never by
// substring-matching the message. Returns parsed JSON ({} on 204).
async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let ghMessage = '';
    try {
      ghMessage = (JSON.parse(await res.text()) || {}).message || '';
    } catch { /* non-JSON body */ }
    const err = new Error(`GitHub ${res.status} on ${path}${ghMessage ? `: ${ghMessage}` : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return {};
  return res.json();
}

// Like gh() but returns null on 404 instead of throwing — for "does this branch/file exist?" probes.
async function ghMaybe(path, init = {}) {
  try {
    return await gh(path, init);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

// Map a failure to ONE plain-English sentence for the founder (non-negotiable 10 — never surface a
// raw GitHub body). Errors we raise ourselves (auth/validation) have no .status → pass them through.
function friendlyError(e) {
  const s = e && e.status;
  if (!s) return String((e && e.message) || e);
  if (s === 401) return "I couldn't file it — the filing tool's access to GitHub was rejected (the token may have expired). An admin needs to refresh it. Nothing was filed.";
  if (s === 403) return 'I could not file it — GitHub is temporarily refusing the request (rate limit or permissions). Please try again in a few minutes. Nothing was filed.';
  if (s === 404) return "I couldn't reach the venture's backlog on GitHub — an admin should check the tool's repo setting. Nothing was filed.";
  if (s === 422) return "GitHub wouldn't accept this as-is (a ticket with that name may already exist). Try a slightly different name. Nothing new was filed.";
  return `I couldn't file it right now (GitHub ${s}). Please try again; if it keeps happening, tell an admin. Nothing was filed.`;
}

// slug guard so a model can't inject a path or a huge blob.
const slugRe = /^[a-z0-9][a-z0-9-]{1,60}$/;

// Idempotent: re-filing the same slug UPDATES the ticket on its branch and returns the existing PR,
// rather than 422-ing (the composer is told to revise + re-file, so this path is common).
async function fileTicket({ slug, title, body }) {
  if (!TOKEN) {
    throw new Error(
      'The filing tool is installed but not yet authorized (no TICKET_GITHUB_TOKEN on the box). ' +
      'Ask an admin to add a write token for the venture repo.',
    );
  }
  if (!slugRe.test(slug || '')) throw new Error(`slug must be lowercase-kebab (a-z0-9-), got "${slug}"`);
  if (!title || !body) throw new Error('title and body are required');

  const repo = await gh(`/repos/${REPO}`);
  const base = repo.default_branch;
  const owner = REPO.split('/')[0];
  const branch = `foundry/${slug}`;

  // Ensure the branch exists (create only if missing — no more swallowing unrelated 422s).
  const existingBranch = await ghMaybe(`/repos/${REPO}/git/ref/heads/${branch}`);
  if (!existingBranch) {
    const baseRef = await gh(`/repos/${REPO}/git/ref/heads/${base}`);
    await gh(`/repos/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
    });
  }

  // slug is guarded to [a-z0-9-] and the rest is URL-safe, so use the path literally — do NOT
  // encodeURIComponent it (that would percent-encode the slashes and file at the wrong path).
  const path = `docs/tickets/${slug}.md`;
  const put = {
    message: `ticket: ${title}`,
    content: Buffer.from(body, 'utf8').toString('base64'),
    branch,
  };
  // If the file already exists on this branch, GitHub requires its sha to update in place.
  const existingFile = await ghMaybe(`/repos/${REPO}/contents/${path}?ref=${branch}`);
  if (existingFile && existingFile.sha) put.sha = existingFile.sha;
  await gh(`/repos/${REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify(put) });

  // Reuse an open PR for this branch if one exists, else open one.
  const openPrs = await gh(`/repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
  if (Array.isArray(openPrs) && openPrs.length) {
    return { url: openPrs[0].html_url, number: openPrs[0].number, branch, updated: true };
  }
  const pr = await gh(`/repos/${REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      head: branch,
      base,
      body: `Filed from the Foundry composer on the founder's approval.\n\n---\n\n${body}`,
    }),
  });
  return { url: pr.html_url, number: pr.number, branch };
}

// ---- MCP tool definition ----------------------------------------------------

const TOOL = {
  name: 'file_venture_ticket',
  description:
    'File a drafted ticket to the venture backlog as a pull request. Only call this AFTER the ' +
    'founder has explicitly approved the ticket. Returns the PR URL. A human still merges the PR — ' +
    'this never merges or ships anything.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['slug', 'title', 'body'],
    properties: {
      slug: { type: 'string', description: 'lowercase-kebab id/slug, e.g. arca-price-history' },
      title: { type: 'string', description: 'the ticket title / PR title' },
      body: { type: 'string', description: 'the full ticket markdown in the house format' },
    },
  },
};

// ---- Minimal MCP JSON-RPC over stdio ----------------------------------------

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
      // Echo the client's protocol version so we always agree; advertise the tools capability.
      reply(id, {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'foundry-ticket-filer', version: '2.0.0' },
      });
      return;

    case 'notifications/initialized':
    case 'initialized':
      return; // notification — no response

    case 'ping':
      if (!isNotification) reply(id, {});
      return;

    case 'tools/list':
      reply(id, { tools: [TOOL] });
      return;

    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      if (name !== TOOL.name) {
        // Tool errors are returned in-band (isError) so the model sees them.
        reply(id, { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true });
        return;
      }
      try {
        const r = await fileTicket(args);
        const verb = r.updated ? 'Updated the ticket on' : 'Filed to';
        reply(id, {
          content: [{ type: 'text', text: `${verb} ${REPO}: PR #${r.number} — ${r.url}` }],
        });
      } catch (e) {
        log('file_venture_ticket failed:', String(e));
        reply(id, { content: [{ type: 'text', text: friendlyError(e) }], isError: true });
      }
      return;
    }

    default:
      if (!isNotification) replyError(id, -32601, `Method not found: ${method}`);
      return;
  }
}

function runStdio() {
  log(`starting (repo=${REPO}, authorized=${Boolean(TOKEN)})`);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      log('non-JSON line ignored:', trimmed.slice(0, 120));
      return;
    }
    // Fire-and-forget; ordering per-request is preserved by GitHub, not required here.
    Promise.resolve(handle(msg)).catch((e) => log('handler error:', String(e)));
  });
  rl.on('close', () => process.exit(0));
}

// ---- Self-test seam: `node stdio.mjs --file '<json>'` -----------------------
// Exercises the GitHub filing path directly (no MCP), for verifying auth on the box.

async function runSelfTest(json) {
  try {
    const r = await fileTicket(JSON.parse(json));
    process.stdout.write(JSON.stringify(r) + '\n');
  } catch (e) {
    process.stderr.write(String(e.message || e) + '\n');
    process.exit(1);
  }
}

const fileIdx = process.argv.indexOf('--file');
if (fileIdx !== -1) {
  runSelfTest(process.argv[fileIdx + 1] || '{}');
} else {
  runStdio();
}
