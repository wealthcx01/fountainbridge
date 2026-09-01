/**
 * The run-report sources that touch the filesystem or the network (FB-042).
 *
 * Split from lib/runreports.ts for the same reason lib/budgets-load.ts is split from lib/budgets.ts:
 * the pure half — the types, the normaliser, `describeRun` — is imported by a `'use client'`
 * component, and a module that reaches for `node:fs` (or, transitively, for `server-only`) cannot be.
 * The build failure is loud, but the fix is a boundary, not a suppression.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { failIfFaulted } from './read-faults';
import { join } from 'node:path';
import type { GitHubClient } from './github';
import { fullRepoName } from './venture-repos';
import { STATE_REF, type RunReportSource } from './runreports';

/**
 * A GitHub-backed source over the `foundry-state` ref.
 *
 * Repos arrive as manifest slugs (`arca`); GitHub needs `owner/slug` (FB-094). Before the prefix,
 * every listing here hit `/repos/arca/...`, 404ed, and rendered as "no sign of an agent lane" on a
 * venture whose lane had written a heartbeat minutes earlier.
 */
export function githubRunReportSource(client: GitHubClient, org?: string): RunReportSource {
  return {
    async list(repo) {
      // No catch here (FB-094): a venture with no lane has no state ref, and `listDir` already
      // reads that 404 as []. Anything ELSE — rate limit, bad credential — must propagate, so the
      // page renders "could not be read" instead of "no sign of an agent lane". The two states
      // looked identical for weeks, and the difference is the whole point of CLAUDE.md #10.
      const entries = await client.listDir(fullRepoName(repo, org), 'runreports', STATE_REF);
      return entries.filter((e) => e.type === 'file' && e.name.endsWith('.json')).map((e) => e.name);
    },
    async read(repo, name) {
      try {
        const text = await client.getFileContent(fullRepoName(repo, org), `runreports/${name}`, STATE_REF);
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    },
  };
}

/** Fixture source for the UI gate and offline dev, matching tickets/PRs/health/approvals. */
export function fixtureRunReportSource(dir: string): RunReportSource {
  const key = (repo: string) => repo.replace(/\//g, '__');
  return {
    async list(repo) {
      // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
      failIfFaulted('runreports');
      try {
        return readdirSync(join(dir, key(repo))).filter((f) => f.endsWith('.json'));
      } catch {
        return [];
      }
    },
    async read(repo, name) {
      // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
      failIfFaulted('runreports');
      try {
        return JSON.parse(readFileSync(join(dir, key(repo), name), 'utf8'));
      } catch {
        return null;
      }
    },
  };
}
