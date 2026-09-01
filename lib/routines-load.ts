/**
 * The routine sources that touch the filesystem or the network (FB-047).
 *
 * Split from `lib/routines.ts` for the same reason `lib/runreports-load.ts` is split from
 * `lib/runreports.ts`: the pure half is importable by a `'use client'` component, and a module that
 * reaches for `node:fs` is not. The build failure is loud, but the fix is a boundary.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { failIfFaulted } from './read-faults';
import { join } from 'node:path';
import type { GitHubClient } from './github';
import { fullRepoName } from './venture-repos';
import { STATE_REF } from './runreports';
import { ROUTINES_DIR, type RoutineSource } from './routines';

/** A GitHub-backed source over the `foundry-state` ref, beside the run reports. */
export function githubRoutineSource(client: GitHubClient, org?: string): RoutineSource {
  return {
    async list(repo) {
      // Deliberately uncaught, matching FB-094's lesson on the run reports: a venture with no
      // routines has no directory, and `listDir` already reads that 404 as []. Anything else — a
      // rate limit, a bad credential — must propagate so the page can say "could not be read"
      // rather than "you have no routines". Those two looked identical for weeks once already.
      const entries = await client.listDir(fullRepoName(repo, org), ROUTINES_DIR, STATE_REF);
      return entries.filter((e) => e.type === 'file' && e.name.endsWith('.json')).map((e) => e.name);
    },
    async read(repo, name) {
      try {
        const text = await client.getFileContent(
          fullRepoName(repo, org),
          `${ROUTINES_DIR}/${name}`,
          STATE_REF,
        );
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    },
  };
}

/** Fixture source for the UI gate and offline dev, matching the other fixture sources. */
export function fixtureRoutineSource(dir: string): RoutineSource {
  return {
    async list(repo) {
      // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
      failIfFaulted('routines');
      try {
        return readdirSync(join(dir, repo)).filter((f) => f.endsWith('.json'));
      } catch {
        return [];
      }
    },
    async read(repo, name) {
      // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
      failIfFaulted('routines');
      try {
        return JSON.parse(readFileSync(join(dir, repo, name), 'utf8'));
      } catch {
        return null;
      }
    },
  };
}
