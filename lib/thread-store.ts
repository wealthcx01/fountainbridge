import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GitHubClient } from './github';
import { failIfFaulted } from './read-faults';
import { fullRepoName } from './venture-repos';
import { THREADS_REF, threadPath } from './threads';

/**
 * Where a ticket's conversation is read from and written to (FB-209).
 *
 * Split out of the server actions for two reasons.
 *
 * **The file's version has to travel with it.** Saving a file that already exists needs the
 * version that was read, or the save is refused. The actions read with a call that returned the
 * text only, so the first message on a ticket saved and every message after it failed with "Could
 * not save that message". That included a founder answering a note the composer had left, which
 * is the one thing this screen exists for. `read` now returns the version and `write` sends it back.
 *
 * **The UI gate needs a conversation without the network.** The same rule every fixture source
 * here follows: a fixture directory AND `E2E_TEST_LOGIN=1`, never one alone, so a stray setting
 * cannot point a founder's real venture at test files.
 */
export interface StoredThread {
  text: string;
  /** The version the save must name. Absent from the rig's in-memory copy, which needs none. */
  sha?: string;
}

export interface ThreadStore {
  /** The stored text, or null when nothing has ever been said. Throws when it could not look. */
  read(repo: string, ticketId: string): Promise<StoredThread | null>;
  write(repo: string, ticketId: string, content: string, message: string, sha?: string): Promise<void>;
  /** Whether this studio can save at all. Said before trying, so the founder is told why. */
  canWrite(): boolean;
}

export function githubThreadStore(): ThreadStore {
  return {
    async read(repo, ticketId) {
      const got = await new GitHubClient().getFileWithSha(fullRepoName(repo), threadPath(repo, ticketId), THREADS_REF);
      return got ? { text: got.text, sha: got.sha } : null;
    },
    async write(repo, ticketId, content, message, sha) {
      const writer = new GitHubClient({ token: process.env.STUDIO_APPROVAL_GITHUB_TOKEN });
      await writer.putFile(fullRepoName(repo), threadPath(repo, ticketId), {
        content, message, branch: THREADS_REF, ...(sha ? { sha } : {}),
      });
    },
    canWrite: () => Boolean(process.env.STUDIO_APPROVAL_GITHUB_TOKEN),
  };
}

/**
 * The rig's conversations: `<dir>/<repo>/<ticket id>.json`, with anything added during a run kept in
 * this server's memory and never written to the committed files.
 *
 * Kept on the process rather than in this module, for the reason `lib/venture-access.ts` gives: the
 * route and the actions can load this file twice, and two copies of the memory would lose a message
 * between them.
 */
const SAID = Symbol.for('foundry-studio.rig-threads');
const said: Map<string, string> = ((globalThis as { [SAID]?: Map<string, string> })[SAID] ??= new Map());

export function fixtureThreadStore(dir: string): ThreadStore {
  return {
    async read(repo, ticketId) {
      // FB-137: fail at read time, where a real read fails.
      failIfFaulted('threads');
      const kept = said.get(`${repo} ${ticketId}`);
      if (kept) return { text: kept };
      try {
        return { text: readFileSync(join(dir, repo.replace(/\//g, '__'), `${ticketId}.json`), 'utf8') };
      } catch {
        return null;
      }
    },
    async write(repo, ticketId, content) {
      said.set(`${repo} ${ticketId}`, content);
    },
    canWrite: () => true,
  };
}

export function defaultThreadStore(): ThreadStore {
  return process.env.THREADS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureThreadStore(process.env.THREADS_FIXTURE_DIR)
    : githubThreadStore();
}
