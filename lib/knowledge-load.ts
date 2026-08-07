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
import { toDoc, type KnowledgeCorpus, type KnowledgeDoc, type KnowledgeArea } from './knowledge';

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
