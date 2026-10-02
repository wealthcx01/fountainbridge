import 'server-only';

/**
 * Reading each venture box's credential scan record off its state ref (FB-206).
 *
 * Split from `lib/box-scan.ts` for the reason every read model here is split: the pure half holds
 * the sentences and is tested without a network; this half reaches for GitHub and the filesystem.
 *
 * **Imported by the admin ledger and nothing else.** One file, one request per venture, on the one
 * screen Bruntsfield reads. A read added to the rail is a read on every screen under every venture
 * (FB-164), and a founder must never see this at all (FB-083's rule). `lib/__tests__/box-scan.test.ts`
 * fails if any other module imports it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { failIfFaulted } from './read-faults';
import { GitHubClient } from './github';
import { fullRepoName } from './venture-repos';
import { STATE_REF } from './runreports';
import { SCAN_RECORD_PATH, parseScanRecord, scanState, type ScanRead, type ScanSource, type ScanState } from './box-scan';
import type { VentureSummary } from './ventures';

/** Turn the file's text into a read. A file that is there and will not parse is NOT "absent". */
export function readScanText(repo: string, text: string | null): ScanRead {
  if (text === null) return { kind: 'absent' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'unreadable', error: `The file on ${repo} is not valid JSON.` };
  }
  const record = parseScanRecord(raw);
  return record
    ? { kind: 'record', record }
    : { kind: 'unreadable', error: `The file on ${repo} does not say when it ran or how much it found.` };
}

export function githubScanSource(client: GitHubClient, org?: string): ScanSource {
  // A 404 is null, and null is "this box has never reported" — a sentence of its own. Anything else
  // (a rate limit, a revoked credential) throws, and the loader turns it into "could not be read".
  return async (repo) => readScanText(repo, await client.getFileContent(fullRepoName(repo, org), SCAN_RECORD_PATH, STATE_REF));
}

/** Fixture source for the UI gate and offline dev: `<dir>/<repo>/secret-scan.json`. */
export function fixtureScanSource(dir: string): ScanSource {
  return async (repo) => {
    // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
    failIfFaulted('boxscan');
    let text: string | null;
    try {
      text = readFileSync(join(dir, repo.replace(/\//g, '__'), 'secret-scan.json'), 'utf8');
    } catch {
      text = null;
    }
    return readScanText(repo, text);
  };
}

export function defaultScanSource(): ScanSource {
  return process.env.BOXSCAN_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureScanSource(process.env.BOXSCAN_FIXTURE_DIR)
    : githubScanSource(new GitHubClient());
}

/**
 * One venture's answer.
 *
 * Read from the venture's FIRST repo: that is `REPO` in the box's `lane.env`, which is where the
 * scanner writes. A venture with no repo at all has nowhere a record could be, which is "not
 * reported" in its plainest form.
 */
export async function loadVentureScan(
  venture: VentureSummary,
  nowMs: number,
  source: ScanSource = defaultScanSource(),
): Promise<ScanState> {
  const repo = venture.repos[0];
  const hasMachine = Boolean(venture.vpsHost);
  if (!repo) return scanState({ kind: 'absent' }, nowMs, hasMachine);
  let read: ScanRead;
  try {
    read = await source(repo);
  } catch {
    // The raw error is not shown: it is a GitHub status line, and the sentence already says what it
    // means. The read is retried on the next page load.
    read = { kind: 'unreadable', error: 'GitHub did not answer when the studio asked for it.' };
  }
  return scanState(read, nowMs, hasMachine);
}
