// Foundry knowledge-deposit tool — stdio MCP server (FB-043).
//
// The second-brain bridge: when a founder gives the composer a durable fact/file "for the venture",
// this deposits it to the venture repo's D8 `context/`/`library/` as a PR — so it lands in GIT (the
// source of truth) and the agent LANES can read it during RESEARCH, not just LibreChat's per-chat
// store. Closes the FB-034/036 silo: what the founder tells the composer reaches the work.
//
// SAFETY: every deposit is secret/PII-scanned before it can be committed — a pasted key/password/
// token is rejected, never written to git history. Same durable shape as the ticket-filer (FB-033):
// a zero-dependency stdio MCP server, no URL, no SSRF. A human still merges the deposit PR.
//
// Auth: TICKET_GITHUB_TOKEN (repo-write on VENTURE_REPO). STDOUT = protocol only; logs → STDERR.

import readline from 'node:readline';

function envVal(name) {
  const v = process.env[name];
  if (!v || /^\$\{.+\}$/.test(v.trim())) return '';
  return v.trim();
}

const REPO = envVal('VENTURE_REPO') || 'wealthcx01/arca';
const TOKEN = envVal('DEPOSIT_GITHUB_TOKEN') || envVal('TICKET_GITHUB_TOKEN');
const API = 'https://api.github.com';
const log = (...a) => console.error('[deposit]', ...a);

const slugRe = /^[a-z0-9][a-z0-9-]{1,60}$/;
const DEPARTMENTS = new Set(['build', 'sell', 'scale', 'general']);

// Reject a deposit that looks like it contains a secret — this content becomes permanent git history.
const SECRET_PATTERNS = [
  [/-----BEGIN[ A-Z]*PRIVATE KEY-----/, 'a private key'],
  [/AKIA[0-9A-Z]{16}/, 'an AWS access key'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'an API key (sk-…)'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'a GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}/, 'a GitHub fine-grained token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/\btvly-[A-Za-z0-9-]{10,}/, 'a Tavily key'],
  [/(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?\S{8,}/i, 'a password/secret assignment'],
];
function scanForSecrets(text) {
  for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) return what;
  return null;
}

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
    let msg = '';
    try { msg = (JSON.parse(await res.text()) || {}).message || ''; } catch { /* non-JSON */ }
    const err = new Error(`GitHub ${res.status}${msg ? `: ${msg}` : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return {};
  return res.json();
}
async function ghMaybe(path, init = {}) {
  try { return await gh(path, init); } catch (e) { if (e.status === 404) return null; throw e; }
}

function friendlyError(e) {
  const s = e && e.status;
  if (!s) return String((e && e.message) || e);
  if (s === 401) return "I couldn't save it — the deposit tool's GitHub access was rejected (the token may have expired). An admin needs to refresh it. Nothing was saved.";
  if (s === 403) return 'GitHub is temporarily refusing the request. Please try again in a few minutes. Nothing was saved.';
  if (s === 404) return "I couldn't reach the venture's repo. An admin should check the tool's repo setting. Nothing was saved.";
  return `I couldn't save it right now (GitHub ${s}). Please try again. Nothing was saved.`;
}

async function deposit({ department, slug, title, content, kind }) {
  if (!TOKEN) throw new Error('The deposit tool is installed but not yet authorized (no token on the box). Ask an admin to add a write token.');
  const dept = DEPARTMENTS.has(department) ? department : 'general';
  const area = kind === 'library' ? 'library' : 'context';
  if (!slugRe.test(slug || '')) throw new Error(`slug must be lowercase-kebab (a-z0-9-), got "${slug}"`);
  if (!title || !content) throw new Error('title and content are required');
  const secret = scanForSecrets(content);
  if (secret) {
    throw new Error(
      `I did NOT save this — it looks like it contains ${secret}. Secrets and passwords must never go ` +
      `into the venture's files. Remove it and try again, or ask an admin to store it on the box securely.`,
    );
  }

  const repo = await gh(`/repos/${REPO}`);
  const base = repo.default_branch;
  const owner = REPO.split('/')[0];
  const branch = `foundry/deposit-${dept}-${slug}`;
  const path = `${area}/${dept}/${slug}.md`;
  const body = `# ${title}\n\n${content}\n`;

  const existingBranch = await ghMaybe(`/repos/${REPO}/git/ref/heads/${branch}`);
  if (!existingBranch) {
    const baseRef = await gh(`/repos/${REPO}/git/ref/heads/${base}`);
    await gh(`/repos/${REPO}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }) });
  }
  const put = { message: `context: ${title}`, content: Buffer.from(body, 'utf8').toString('base64'), branch };
  const existingFile = await ghMaybe(`/repos/${REPO}/contents/${path}?ref=${branch}`);
  if (existingFile && existingFile.sha) put.sha = existingFile.sha;
  await gh(`/repos/${REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify(put) });

  const openPrs = await gh(`/repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`);
  if (Array.isArray(openPrs) && openPrs.length) return { url: openPrs[0].html_url, number: openPrs[0].number, path, updated: true };
  const pr = await gh(`/repos/${REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title: `Add to venture knowledge: ${title}`, head: branch, base, body: `Deposited from the Foundry composer into \`${path}\` so the agent lanes can use it. A human still reviews + merges.` }),
  });
  return { url: pr.html_url, number: pr.number, path };
}

const TOOL = {
  name: 'deposit_venture_file',
  description:
    "Save a durable fact or document into the venture's shared knowledge (its git context/library), " +
    'so the agent lanes doing the work can read it — not just this chat. Use for brand, audience, ' +
    'positioning, pricing decisions, research. Secrets/passwords are rejected. A human merges the PR.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['slug', 'title', 'content'],
    properties: {
      department: { type: 'string', enum: ['build', 'sell', 'scale', 'general'], description: 'which surface this is for (default general)' },
      kind: { type: 'string', enum: ['context', 'library'], description: 'context = durable background (default); library = an artifact/output' },
      slug: { type: 'string', description: 'lowercase-kebab id, e.g. ideal-customer' },
      title: { type: 'string' },
      content: { type: 'string', description: 'the text to save (markdown)' },
    },
  },
};

// ---- MCP JSON-RPC over stdio (same shape as the ticket-filer) --------------------------------------
function send(m) { process.stdout.write(JSON.stringify(m) + '\n'); }
function reply(id, result) { send({ jsonrpc: '2.0', id, result }); }
function replyError(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;
  switch (method) {
    case 'initialize':
      reply(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'foundry-deposit', version: '1.0.0' } });
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
      if (params?.name !== TOOL.name) { reply(id, { content: [{ type: 'text', text: `Unknown tool: ${params?.name}` }], isError: true }); return; }
      try {
        const r = await deposit(params.arguments || {});
        const verb = r.updated ? 'Updated' : 'Saved';
        reply(id, { content: [{ type: 'text', text: `${verb} to the venture's knowledge (${r.path}): PR #${r.number} — ${r.url}. Your team will OK it, then every lane can use it.` }] });
      } catch (e) {
        log('deposit failed:', String(e));
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
