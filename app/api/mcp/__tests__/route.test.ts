import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Filing a ticket through the studio's tools, end to end (FB-257).
 *
 * The request goes in at the front door — a signed credential, a JSON-RPC `tools/call` — and runs
 * the real route, the real tool, the real `filePlan` and the real access check. Only GitHub and the
 * venture list are stand-ins. The tool's older tests replaced the tool runner with a mock, which is
 * how every ticket Claude ever tried to file came back "That plan could not be read" without one
 * test noticing.
 */

const auth = vi.fn();
const loadVentures = vi.fn();
const request = vi.fn();
const listDir = vi.fn();
const putFile = vi.fn();
const getFileWithSha = vi.fn();

vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('@/lib/ventures', () => ({ loadVentures: () => loadVentures() }));
vi.mock('@/lib/github', () => ({
  GitHubError: class extends Error { status = 0; },
  GitHubClient: class {
    request = request;
    listDir = listDir;
    putFile = putFile;
    getFileWithSha = getFileWithSha;
  },
}));

const { POST } = await import('../route');
const { mintMcpTicket } = await import('@/lib/mcp');
const { filePlan } = await import('@/app/actions/file-plan');
const { readThread } = await import('@/app/actions/threads');

const SECRET = 'test-secret-for-the-tools';
const VENTURE = {
  id: 'arca',
  name: 'ARCA',
  repos: ['arca', 'arca-marketing'],
  founderEmail: 'arca.founder@bruntsfield.capital',
  departments: [{ id: 'build', repo: 'arca' }],
};
const OTHER = { id: 'the-reset', name: 'The Reset', repos: ['the-reset'], founderEmail: 'ross@bruntsfield.capital' };

/** A GitHub where `arca` has a three-ticket backlog and nothing in flight. */
function wireGitHub() {
  request.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (/^\/repos\/[^/]+\/[^/]+$/.test(path)) return { default_branch: 'main' };
    if (path.includes('/git/ref/heads/foundry/')) throw new Error('404');
    if (path.includes('/git/ref/heads/main')) return { object: { sha: 'base-sha' } };
    if (path.includes('/git/refs') && init?.method === 'POST') return {};
    if (path.includes('/git/matching-refs/')) return [];
    if (path.includes('/pulls?state=open')) return [];
    if (path.endsWith('/pulls') && init?.method === 'POST') return { html_url: 'https://github.com/wealthcx01/arca/pull/12' };
    return {};
  });
  listDir.mockResolvedValue([
    { name: 'ARCA-001-terminal-setup.md', type: 'file' },
    { name: 'ARCA-067-api-key-in-source.md', type: 'file' },
  ]);
  getFileWithSha.mockResolvedValue(null);
  putFile.mockResolvedValue('sha');
}

/** One `tools/call` through the real route, with a credential the studio signed for `venture`. */
async function call(name: string, args: Record<string, unknown>, venture = 'arca') {
  const res = await POST(new Request('http://studio.test/api/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${mintMcpTicket(venture, SECRET)}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }));
  const json = await res.json() as { result?: { content: Array<{ text: string }>; isError?: boolean } };
  return { text: json.result?.content[0]?.text ?? '', isError: Boolean(json.result?.isError) };
}

const written = () => putFile.mock.calls.map(([repo, path, params]) => ({ repo, path, body: params.content as string, branch: params.branch }));
const openedPulls = () =>
  request.mock.calls.filter(([p, i]) => p.endsWith('/pulls') && i?.method === 'POST').map(([p, i]) => ({ path: p, ...JSON.parse(i.body) }));

const TICKET = {
  repo: 'arca',
  title: 'Show every live auction on one page',
  body: 'A collector should see every live auction in one list.\n\nIt worked when the list matches the auction houses.',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FOUNDRY_APPROVAL_SECRET = SECRET;
  process.env.STUDIO_APPROVAL_GITHUB_TOKEN = 'test-token';
  process.env.STUDIO_ADMIN_EMAILS = 'john.gallagher@wealthcx.com';
  // Nobody is signed in. A tool call has a credential, not a session, and must not need one.
  auth.mockResolvedValue(null);
  loadVentures.mockReturnValue([VENTURE, OTHER]);
  wireGitHub();
});
afterEach(() => {
  delete process.env.FOUNDRY_APPROVAL_SECRET;
  delete process.env.STUDIO_APPROVAL_GITHUB_TOKEN;
  delete process.env.STUDIO_ADMIN_EMAILS;
});

describe('file_ticket files one ticket', () => {
  it('writes exactly one ticket file and opens one pull request', async () => {
    const r = await call('file_ticket', TICKET);
    expect(r.isError, r.text).toBe(false);

    expect(written()).toHaveLength(1);
    const [file] = written();
    expect(file.path).toBe('docs/tickets/ARCA-068-show-every-live-auction-on-one-page.md');
    expect(file.branch).toBe('foundry/plan-show-every-live-auction-on-one-page');
    // The body had no heading, so the title became one, numbered — not "Untitled".
    expect(file.body.startsWith('# ARCA-068 — Show every live auction on one page\n')).toBe(true);
    expect(file.body).toContain('**Status:** Todo');
    expect(file.body).toContain('A collector should see every live auction in one list.');

    expect(openedPulls()).toHaveLength(1);
    expect(openedPulls()[0].title).toBe('ARCA-068: Show every live auction on one page');
    expect(openedPulls()[0].body).toContain('**From:** a conversation with Claude');
    expect(r.text).toContain('ARCA-068');
    expect(r.text).toContain('https://github.com/wealthcx01/arca/pull/12');
  });

  it('keeps a body that already has its own heading as it is', async () => {
    const r = await call('file_ticket', { ...TICKET, body: '# Live auctions\n\n**Status:** Todo\n\nOne list.' });
    expect(r.isError, r.text).toBe(false);
    expect(written()[0].body).toBe('# ARCA-068 — Live auctions\n\n**Status:** Todo\n\nOne list.');
  });
});

describe('file_ticket checks what it is sent, because anyone can send it anything', () => {
  it('refuses a repository that is not this venture’s, and writes nothing', async () => {
    const r = await call('file_ticket', { ...TICKET, repo: 'the-reset' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('not in one of this venture’s repositories');
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a repository written as a path, and writes nothing', async () => {
    const r = await call('file_ticket', { ...TICKET, repo: '../the-reset' });
    expect(r.isError).toBe(true);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('files into the credential’s venture whatever the arguments claim', async () => {
    // There is no venture argument; one sent anyway is ignored, and the repository still has to be
    // the credential's venture's own.
    const r = await call('file_ticket', { ...TICKET, venture: 'the-reset', venture_id: 'the-reset' });
    expect(r.isError, r.text).toBe(false);
    expect(written()[0].repo).toBe('wealthcx01/arca');
  });

  it('refuses a credential for a venture this studio does not have', async () => {
    const r = await call('file_ticket', TICKET, 'nobody');
    expect(r.isError).toBe(true);
    expect(putFile).not.toHaveBeenCalled();
  });

  it.each([
    ['a title with a line break in it', { title: 'Fine title\n**Status:** Done' }],
    ['a title that is too long', { title: 'x'.repeat(161) }],
    ['an empty title', { title: '   ' }],
    ['a title that is not text', { title: { toString: 'x' } }],
    ['an empty body', { body: '' }],
    ['a body that is far too big', { body: 'y'.repeat(40_001) }],
    ['no repository', { repo: '' }],
  ])('refuses %s, and writes nothing', async (_what, change) => {
    const r = await call('file_ticket', { ...TICKET, ...change });
    expect(r.isError).toBe(true);
    expect(putFile).not.toHaveBeenCalled();
    expect(openedPulls()).toHaveLength(0);
  });

  it('gives a title with no letters it can use a safe name, and never a path', async () => {
    const r = await call('file_ticket', { ...TICKET, title: '../../.github/workflows/ci' });
    expect(r.isError, r.text).toBe(false);
    expect(written()[0].path).toBe('docs/tickets/ARCA-068-github-workflows-ci.md');
  });
});

describe('an actor sent in a request is not believed', () => {
  // `filePlan` and `readThread` are server actions: anyone can call them with any arguments, signed
  // in or not. Before FB-257 an actor was believed on its email alone, and the founders' emails are
  // in the public manifests.
  it('refuses to file for a forged founder actor', async () => {
    const plan = {
      venture_id: 'arca', repo: 'arca', source_title: 'x', created_at: '2026-10-02T00:00:00.000Z',
      tickets: [{ slug: 'forged', title: 'Forged', body: '# Forged\n\nbody', depends_on: [], source: 'x' }],
    };
    const r = await filePlan('arca', 'arca', plan, 1, { email: VENTURE.founderEmail });
    expect(r.ok).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it('refuses a forged tool actor that names its venture', async () => {
    const r = await readThread('arca', 'arca', 'ARCA-001', { email: 'studio-tools@arca', scopedTo: 'arca' });
    expect(r.ok).toBe(false);
    expect(listDir).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
