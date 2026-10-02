// Print one venture's whole approval record from git, as JSON lines (FB-171).
//
// This is the migration's first half. Its output is fed to `foundry_graph.py migrate`, which takes
// every event into ActiveGraph with the time it was recorded on git, then checks that replaying the
// graph's log reproduces the graph exactly:
//
//   node deploy/activegraph/export-history.mjs arca \
//     | /opt/activegraph/bin/python deploy/activegraph/foundry_graph.py migrate
//
// It only reads. It uses the git trees API rather than directory listings, because a contents
// listing stops at 1,000 entries without saying so — the fault that froze every ARCA screen on
// 31 August (FB-161).
//
// Env: GITHUB_TOKEN (read access to the studio repo), ACTIVEGRAPH_REPO (default
// wealthcx01/fountainbridge), ACTIVEGRAPH_REF (default foundry-activegraph), GITHUB_API_URL.

import { fileURLToPath } from 'node:url';

/** The event files for one venture in a recursive tree listing, in a stable order. */
export function historyPaths(tree, venture) {
  const prefix = `activegraph/${venture}/`;
  return (tree ?? [])
    .filter((t) => t.type === 'blob' && t.path.startsWith(prefix) && /\/\d{4}-[a-z.]+\.json$/.test(t.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

async function main() {
  const venture = process.argv[2];
  if (!venture || !/^[a-z0-9-]+$/.test(venture)) {
    console.error('usage: export-history.mjs <venture-id>');
    process.exit(2);
  }
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const repo = process.env.ACTIVEGRAPH_REPO || 'wealthcx01/fountainbridge';
  const ref = process.env.ACTIVEGRAPH_REF || 'foundry-activegraph';
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const get = async (url) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub ${res.status} on ${url}`);
    return res.json();
  };

  const tree = await get(`${api}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
  if (tree.truncated) {
    // Said, not swallowed: a partial history is a migration with a hole in it.
    throw new Error('GitHub truncated the tree listing, so this export would be incomplete. Stopping.');
  }
  const paths = historyPaths(tree.tree, venture);
  for (const t of paths) {
    const blob = await get(t.url ?? `${api}/repos/${repo}/git/blobs/${t.sha}`);
    const text = Buffer.from(blob.content, 'base64').toString('utf8');
    process.stdout.write(`${JSON.stringify(JSON.parse(text))}\n`);
  }
  console.error(`exported ${paths.length} event(s) for ${venture} from ${repo}@${ref}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
}
