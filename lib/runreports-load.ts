/**
 * The run-report sources that touch the filesystem or the network (FB-042).
 *
 * Split from lib/runreports.ts for the same reason lib/budgets-load.ts is split from lib/budgets.ts:
 * the pure half — the types, the normaliser, `describeRun` — is imported by a `'use client'`
 * component, and a module that reaches for `node:fs` (or, transitively, for `server-only`) cannot be.
 * The build failure is loud, but the fix is a boundary, not a suppression.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GitHubClient } from './github';
import { STATE_REF, type RunReportSource } from './runreports';

/** A GitHub-backed source over the `foundry-state` ref. */
export function githubRunReportSource(client: GitHubClient): RunReportSource {
  return {
    async list(repo) {
      try {
        const entries = await client.listDir(repo, 'runreports', STATE_REF);
        return entries.filter((e) => e.type === 'file' && e.name.endsWith('.json')).map((e) => e.name);
      } catch {
        // A venture with no lane has no state ref, which is the normal case and not an error.
        return [];
      }
    },
    async read(repo, name) {
      try {
        const text = await client.getFileContent(repo, `runreports/${name}`, STATE_REF);
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
      try {
        return readdirSync(join(dir, key(repo))).filter((f) => f.endsWith('.json'));
      } catch {
        return [];
      }
    },
    async read(repo, name) {
      try {
        return JSON.parse(readFileSync(join(dir, key(repo), name), 'utf8'));
      } catch {
        return null;
      }
    },
  };
}
