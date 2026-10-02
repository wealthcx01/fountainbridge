import 'server-only';

/**
 * Reading whether the team can find every document, off the venture's state ref (FB-169).
 *
 * Split from `lib/brain-corpus.ts` for the reason every read model here is split: the pure half holds
 * the sentences and is tested without a network; this half reaches for GitHub and the filesystem.
 *
 * **One request per venture, on the Memory screen only.** The record is a single small file, so this
 * costs the screen one read whatever the venture grows to (FB-083's rule), and it is not on the rail.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { failIfFaulted } from './read-faults';
import { GitHubClient } from './github';
import { fullRepoName } from './venture-repos';
import { STATE_REF } from './runreports';
import { CORPUS_RECORD_PATH, readCorpusText, type CorpusRead, type CorpusSource } from './brain-corpus';

export function githubCorpusSource(client: GitHubClient, org?: string): CorpusSource {
  // A 404 is null, which is "never reported" — its own sentence. Anything else (a rate limit, a
  // revoked credential) throws, and the page turns that into "could not be read".
  return async (repo) => readCorpusText(await client.getFileContent(fullRepoName(repo, org), CORPUS_RECORD_PATH, STATE_REF));
}

/** Fixture source for the UI gate and offline dev: `<dir>/<repo>/brain-corpus.json`. */
export function fixtureCorpusSource(dir: string): CorpusSource {
  return async (repo) => {
    // FB-137: fail at READ time, where a real read fails — inside whatever the page catches.
    failIfFaulted('braincorpus');
    let text: string | null;
    try {
      text = readFileSync(join(dir, repo.replace(/\//g, '__'), 'brain-corpus.json'), 'utf8');
    } catch {
      text = null;
    }
    return readCorpusText(text);
  };
}

export function defaultCorpusSource(): CorpusSource {
  return process.env.BRAINCORPUS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureCorpusSource(process.env.BRAINCORPUS_FIXTURE_DIR)
    : githubCorpusSource(new GitHubClient());
}

/**
 * One venture's answer, never throwing.
 *
 * Read from the venture's FIRST repo: that is the one its machine indexes and the one it reports to
 * (`PRIMARY_REPO` in `deploy/lane/run-once.sh`). A venture with no repo has no record anywhere.
 */
export async function loadCorpusRead(repos: readonly string[], source: CorpusSource = defaultCorpusSource()): Promise<CorpusRead> {
  const repo = repos[0];
  if (!repo) return { kind: 'absent' };
  try {
    return await source(repo);
  } catch (err) {
    return { kind: 'unreadable', error: err instanceof Error ? err.message : String(err) };
  }
}
