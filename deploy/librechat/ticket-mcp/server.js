// Foundry ticket-filer MCP server (FB-025). Exposes one tool — `file_venture_ticket` — that the
// Foundry composer calls AFTER the founder approves a drafted ticket: it opens a PR adding the
// ticket to the venture repo's docs/tickets/ on a new branch. Nothing merges (non-negotiable 2):
// a human still reviews + merges the PR. The studio then renders it on the venture board.
//
// Auth: GITHUB_TOKEN (a write-scoped token for VENTURE_REPO). Repo: VENTURE_REPO (owner/name).
// Transport: Streamable HTTP at /mcp. Also serves /health and a /file-ticket test route.
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const REPO = process.env.VENTURE_REPO || 'wealthcx01/arca';
const TOKEN = process.env.GITHUB_TOKEN || '';
const PORT = Number(process.env.PORT || 3100);
const API = 'https://api.github.com';

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
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// slug/title guards so a model can't inject a path or a huge blob.
const slugRe = /^[a-z0-9][a-z0-9-]{1,60}$/;

async function fileTicket({ slug, title, body }) {
  if (!TOKEN) throw new Error('The filing tool is installed but not yet authorized (no GITHUB_TOKEN on the box). Ask an admin to add a write token.');
  if (!slugRe.test(slug)) throw new Error(`slug must be lowercase-kebab (a-z0-9-), got "${slug}"`);
  const repo = await gh(`/repos/${REPO}`);
  const base = repo.default_branch;
  const ref = await gh(`/repos/${REPO}/git/ref/heads/${base}`);
  const branch = `foundry/${slug}`;
  // create the branch (ignore "already exists")
  try {
    await gh(`/repos/${REPO}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha }) });
  } catch (e) {
    if (!String(e).includes('422')) throw e;
  }
  const path = `docs/tickets/${slug}.md`;
  await gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `ticket: ${title}`, content: Buffer.from(body, 'utf8').toString('base64'), branch }),
  });
  const pr = await gh(`/repos/${REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, head: branch, base, body: `Filed from the Foundry composer on the founder's approval.\n\n---\n\n${body}` }),
  });
  return { url: pr.html_url, number: pr.number, branch };
}

function buildServer() {
  const server = new McpServer({ name: 'foundry-ticket-filer', version: '1.0.0' });
  server.tool(
    'file_venture_ticket',
    'File a drafted ticket to the venture backlog as a pull request. Only call this AFTER the founder has explicitly approved the ticket. Returns the PR URL.',
    { slug: z.string().describe('lowercase-kebab id/slug, e.g. arca-price-history'), title: z.string(), body: z.string().describe('the full ticket markdown in the house format') },
    async ({ slug, title, body }) => {
      const r = await fileTicket({ slug, title, body });
      return { content: [{ type: 'text', text: `Filed to ${REPO}: PR #${r.number} — ${r.url}` }] };
    },
  );
  return server;
}

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, repo: REPO, authorized: Boolean(TOKEN) }));

// Test seam (not used by LibreChat): POST {slug,title,body} to exercise the filing logic directly.
app.post('/file-ticket', async (req, res) => {
  try { res.json(await fileTicket(req.body || {})); } catch (e) { res.status(400).json({ error: String(e) }); }
});

// MCP Streamable HTTP endpoint (stateless — a fresh transport per request).
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await buildServer().connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => console.log(`foundry-ticket-mcp on :${PORT} (repo=${REPO}, authorized=${Boolean(TOKEN)})`));
