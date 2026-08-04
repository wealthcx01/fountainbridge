/**
 * Fixture source for the work view (FB-064) — the UI gate and offline dev.
 *
 * Matches the seam every other read model uses (tickets, PRs, health, approvals, run reports), and is
 * gated on `E2E_TEST_LOGIN` at the call site rather than on the directory existing: this surface can
 * MERGE things, and a stray environment variable must never be able to swap a founder's real work
 * queue for files on disk.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PrCiStatus } from './attention';
import type { WorkSource } from './work-load';

export function fixtureWorkSource(dir: string): WorkSource {
  const key = (repo: string) => repo.replace(/\//g, '__');
  const read = (repo: string, number: number) => {
    try {
      return JSON.parse(readFileSync(join(dir, key(repo), `${number}.json`), 'utf8'));
    } catch {
      return null;
    }
  };
  return {
    async get(repo, number) {
      const j = read(repo, number);
      if (!j) return null;
      return {
        number, title: j.title, body: j.body ?? null,
        state: j.state ?? 'open', merged: Boolean(j.merged),
        mergeable: j.mergeable ?? true,
        author: j.author ?? null,
        createdAt: j.createdAt ?? '2026-07-21T10:00:00Z',
        headSha: j.headSha ?? `sha-${repo}-${number}`,
        changedFiles: j.changedFiles ?? (Array.isArray(j.files) ? j.files.length : 0),
        url: j.url ?? null,
      };
    },
    async files(repo, number) {
      const j = read(repo, number);
      return Array.isArray(j?.files) ? j.files : [];
    },
    /**
     * Whole-file reads — FB-107's ask. The fixture carries the text under `fileTexts`, keyed by
     * path, and finds the right work the same way `preview` and `checks` do: the default headSha
     * carries the number.
     */
    async file(repo, path, ref) {
      const [, num] = ref.split(/-(\d+)$/);
      const texts = read(repo, Number(num))?.fileTexts;
      const text = texts?.[path];
      return typeof text === 'string' ? text : null;
    },
    async preview(repo, sha) {
      const [, num] = sha.split(/-(\d+)$/);
      return read(repo, Number(num))?.previewUrl ?? null;
    },
    async checks(repo, sha) {
      // The fixture pins checks on the work itself; the sha is carried so a fixture can model a
      // moved branch by changing it.
      const [, num] = sha.split(/-(\d+)$/);
      const j = read(repo, Number(num));
      return (j?.checks as PrCiStatus) ?? 'success';
    },
  };
}
