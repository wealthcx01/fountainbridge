import 'server-only';

/**
 * Reading the record of use off the state ref (FB-156).
 *
 * Split from `lib/readings.ts` for the reason every read model here is split: the pure half is
 * imported by a client component, and a module that reaches for the network cannot be.
 *
 * **One request per surface, whatever the venture has done.** The record is a single file, so this
 * is the cheapest read on the Memory screen — deliberately, because `Last used` is a column on a
 * table that already costs a corpus query and a provenance query, and a third read whose cost grew
 * with the venture's history would have made the screen worse for a nicety (FB-083).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { failIfFaulted } from './read-faults';
import { GitHubClient } from './github';
import { fullRepoName } from './venture-repos';
import { STATE_REF } from './runreports';
import { NO_READINGS, READINGS_PATH, parseReadings, type ReadingsSource } from './readings';

export function githubReadingsSource(client: GitHubClient, org?: string): ReadingsSource {
  return async (repo) => {
    // A 404 comes back as null, and null is the honest "this surface does not keep the record yet"
    // — which is a different sentence from "nothing has read it" and renders as one. Anything else
    // (a rate limit, a revoked credential) throws, and the caller turns that into a third sentence
    // again rather than letting a broken read masquerade as an unread document.
    const text = await client.getFileContent(fullRepoName(repo, org), READINGS_PATH, STATE_REF);
    if (text === null) return NO_READINGS;
    // A file that is there but will not parse is NOT "no record". It is a record we cannot read,
    // and saying "nothing has read this" over it would be inventing a fact out of a broken one.
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { log: new Map(), present: false, error: `${repo}: the record of what has been read could not be parsed.` };
    }
    return { log: parseReadings(raw), present: true, error: null };
  };
}

/** Fixture source for the UI gate and offline dev, matching the other fixture sources. */
export function fixtureReadingsSource(dir: string): ReadingsSource {
  return async (repo) => {
    // FB-137: fail at READ time, where a real read fails — inside whatever the loader catches.
    failIfFaulted('readings');
    let text: string;
    try {
      text = readFileSync(join(dir, repo.replace(/\//g, '__'), 'readings.json'), 'utf8');
    } catch {
      return NO_READINGS;
    }
    try {
      return { log: parseReadings(JSON.parse(text)), present: true, error: null };
    } catch {
      return { log: new Map(), present: false, error: `${repo}: the record of what has been read could not be parsed.` };
    }
  };
}

export function defaultReadingsSource(): ReadingsSource {
  return process.env.READINGS_FIXTURE_DIR && process.env.E2E_TEST_LOGIN === '1'
    ? fixtureReadingsSource(process.env.READINGS_FIXTURE_DIR)
    : githubReadingsSource(new GitHubClient());
}
