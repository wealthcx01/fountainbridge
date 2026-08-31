import 'server-only';

/**
 * Reading a venture's corpus off git (FB-106).
 *
 * Split from lib/knowledge.ts for the reason every read model here is split: the pure half is
 * imported by a client component, and a module that reaches for the network cannot be.
 *
 * One GraphQL query per area, for the same reason FB-083 moved the tickets there: it fetches the
 * directory AND every file's text in a single round trip, on a 5,000-point allowance the REST reads
 * do not touch. A corpus of forty documents costs two queries rather than forty-two requests — which
 * matters on a surface whose whole purpose is to grow.
 */

import { GitHubClient, GitHubError } from './github';
import { toDoc, type DocCommit, type KnowledgeCorpus, type KnowledgeDoc, type KnowledgeArea } from './knowledge';

/** `entries` two levels down: `context/<dept>/<file>` and `context/<file>` both exist in the wild. */
const CORPUS_QUERY = `
  query Corpus($owner: String!, $name: String!, $expr: String!) {
    repository(owner: $owner, name: $name) {
      object(expression: $expr) {
        ... on Tree {
          entries {
            name
            type
            object {
              ... on Blob { byteSize isTruncated text }
              ... on Tree {
                entries {
                  name
                  type
                  object { ... on Blob { byteSize isTruncated text } }
                }
              }
            }
          }
        }
      }
    }
  }`;

interface Blob { byteSize?: number; isTruncated?: boolean; text?: string | null }
interface Entry { name: string; type: string; object?: (Blob & { entries?: Entry[] }) | null }
interface CorpusResult { repository: { object: { entries?: Entry[] } | null } | null }

export type KnowledgeSourceFn = (repo: string) => Promise<KnowledgeCorpus>;

export function githubKnowledgeSource(
  client: GitHubClient,
  org = process.env.GITHUB_ORG ?? 'wealthcx01',
): KnowledgeSourceFn {
  return async (repo) => {
    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    const [owner, name] = fullName.split('/');
    const docs: KnowledgeDoc[] = [];

    for (const area of ['context', 'library'] as KnowledgeArea[]) {
      try {
        const data = await client.graphql<CorpusResult>(CORPUS_QUERY, {
          owner, name, expr: `HEAD:${area}`,
        });
        // A readable repository with no `context/` yet is the honest empty case, not a failure.
        if (!data.repository) throw new GitHubError('not found', 404, false);
        for (const entry of data.repository.object?.entries ?? []) {
          if (entry.type === 'blob') {
            docs.push(...build(`${area}/${entry.name}`, entry.object ?? null));
          } else if (entry.type === 'tree') {
            for (const child of entry.object?.entries ?? []) {
              if (child.type === 'blob') docs.push(...build(`${area}/${entry.name}/${child.name}`, child.object ?? null));
            }
          }
        }
      } catch (e) {
        // One unreadable area must not blank the other, and must never read as "you have given it
        // nothing" — FB-021's distinction, on a surface where the difference is a founder's own work.
        return {
          docs,
          error: e instanceof GitHubError && e.status === 404
            ? null // no such directory yet: genuinely empty
            : `${fullName}: this venture’s knowledge could not be read just now.`,
        };
      }
    }
    return { docs, error: null };
  };
}

/**
 * A blob GraphQL declined to inline is listed with its size and no text.
 *
 * Shown rather than dropped: a founder who uploaded a 2MB deck needs to see that it landed. The
 * studio says it cannot render it here, which is true, instead of pretending it is not there.
 */
function build(path: string, blob: Blob | null | undefined): KnowledgeDoc[] {
  const text = blob && !blob.isTruncated && typeof blob.text === 'string' ? blob.text : null;
  const doc = toDoc(path, text, blob?.byteSize ?? 0);
  return doc ? [doc] : [];
}

/** Offline fixture source (dev / Playwright): reads `<dir>/<repo>/<area>/<dept>/<file>`. */
export function fixtureKnowledgeSource(dir: string): KnowledgeSourceFn {
  return async (repo) => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const docs: KnowledgeDoc[] = [];
    const walk = (base: string, rel: string) => {
      let entries: string[];
      try {
        entries = readdirSync(join(base, rel));
      } catch {
        return; // the area does not exist in this fixture — the honest empty case
      }
      for (const entry of entries) {
        const next = `${rel}/${entry}`;
        const full = join(base, next);
        if (statSync(full).isDirectory()) walk(base, next);
        else {
          const text = readFileSync(full, 'utf8');
          const doc = toDoc(next, text, Buffer.byteLength(text));
          if (doc) docs.push(doc);
        }
      }
    };
    const base = join(dir, repo);
    walk(base, 'context');
    walk(base, 'library');
    return { docs, error: null };
  };
}

export function defaultKnowledgeSource(): KnowledgeSourceFn {
  return process.env.KNOWLEDGE_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureKnowledgeSource(process.env.KNOWLEDGE_FIXTURE_DIR)
    : githubKnowledgeSource(new GitHubClient());
}

// --- where each document came from (FB-133) ---------------------------------------------------

/**
 * How many paths one provenance query will ask about.
 *
 * `history(path:)` is the expensive half of this query, so the cap is a real budget rather than
 * defensive decoration: it bounds the cost of the Memory screen at one request per repository no
 * matter how large the corpus grows, which is the FB-083 rule (bounded per load, never a function of
 * how much history a venture has). Documents past the cap render with `unknown` provenance — absent,
 * which the table already knows how to say, rather than a wrong date.
 */
export const MAX_PROVENANCE_PATHS = 60;

export type ProvenanceSourceFn = (
  repo: string,
  paths: readonly string[],
) => Promise<Map<string, DocCommit>>;

interface HistoryNode {
  committedDate?: string | null;
  messageHeadline?: string | null;
  author?: { name?: string | null } | null;
}
type HistoryField = { history?: { totalCount?: number; nodes?: (HistoryNode | null)[] | null } } | null;

/**
 * One aliased query per repository, not one query per document.
 *
 * GraphQL lets a single `repository` selection carry an aliased `object(expression: "HEAD")` per
 * path, so forty documents cost one round trip instead of forty. The paths go in as declared
 * variables (`$p0`, `$p1`, …) rather than interpolated into the query text — a document path is
 * founder-supplied, and a path is not a place to learn that lesson twice (FB-127).
 */
export function githubProvenanceSource(
  client: GitHubClient,
  org = process.env.GITHUB_ORG ?? 'wealthcx01',
): ProvenanceSourceFn {
  return async (repo, paths) => {
    const out = new Map<string, DocCommit>();
    const wanted = paths.slice(0, MAX_PROVENANCE_PATHS);
    if (wanted.length === 0) return out;

    const fullName = repo.includes('/') ? repo : `${org}/${repo}`;
    const [owner, name] = fullName.split('/');

    const decls = wanted.map((_, i) => `$p${i}: String!`).join(', ');
    const fields = wanted
      .map(
        (_, i) => `
        h${i}: object(expression: $head) {
          ... on Commit {
            history(path: $p${i}, first: 1) {
              totalCount
              nodes { committedDate messageHeadline author { name } }
            }
          }
        }`,
      )
      .join('');
    const query = `
      query Provenance($owner: String!, $name: String!, $head: String!, ${decls}) {
        repository(owner: $owner, name: $name) {${fields}
        }
      }`;

    const variables: Record<string, unknown> = { owner, name, head: 'HEAD' };
    wanted.forEach((path, i) => { variables[`p${i}`] = path; });

    const data = await client.graphql<{ repository: Record<string, HistoryField> | null }>(query, variables);
    const repository = data.repository;
    if (!repository) return out;

    wanted.forEach((path, i) => {
      const node = repository[`h${i}`]?.history?.nodes?.[0];
      const committedDate = node?.committedDate;
      if (!node || !committedDate) return; // nothing known about this one; the row says so
      out.set(path, {
        committedDate,
        messageHeadline: node.messageHeadline ?? '',
        authorName: node.author?.name ?? null,
        totalCount: repository[`h${i}`]?.history?.totalCount ?? 1,
      });
    });
    return out;
  };
}

/**
 * Offline provenance (dev / Playwright): a `provenance.json` beside the fixture corpus.
 *
 * Shaped `{ "<path>": { committedDate, messageHeadline, authorName, totalCount } }`. Absent file
 * means absent provenance, which is a state the screen must render correctly anyway — so the
 * fixture can exercise both halves.
 */
export function fixtureProvenanceSource(dir: string): ProvenanceSourceFn {
  return async (repo, paths) => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const out = new Map<string, DocCommit>();
    let raw: Record<string, Partial<DocCommit>>;
    try {
      raw = JSON.parse(readFileSync(join(dir, repo, 'provenance.json'), 'utf8'));
    } catch {
      return out;
    }
    for (const path of paths) {
      const entry = raw[path];
      if (!entry?.committedDate) continue;
      out.set(path, {
        committedDate: entry.committedDate,
        messageHeadline: entry.messageHeadline ?? '',
        authorName: entry.authorName ?? null,
        totalCount: entry.totalCount ?? 1,
      });
    }
    return out;
  };
}

export function defaultProvenanceSource(): ProvenanceSourceFn {
  return process.env.KNOWLEDGE_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureProvenanceSource(process.env.KNOWLEDGE_FIXTURE_DIR)
    : githubProvenanceSource(new GitHubClient());
}
