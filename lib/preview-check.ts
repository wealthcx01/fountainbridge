import { verdictFor, type Hop, type Verdict } from '../scripts/preview-link-lib.mjs';
import type { PreviewCheck } from './result-link';

/**
 * Open a preview address and say whether it really opens that preview (FB-184).
 *
 * The judgement is `verdictFor` in `scripts/preview-link-lib.mjs`, the same one
 * `check-preview-link.mjs` runs from a terminal. One implementation, so the studio and the script
 * cannot disagree about whether a link works.
 *
 * ## Cost, and why it is bounded
 *
 * One address per ticket opened, at most `MAX_HOPS` requests, each cut off at `HOP_TIMEOUT_MS`.
 * Called only for the ticket a founder has open, never for the list. Remembered for `REMEMBER_MS`,
 * so moving between tickets does not re-open the same preview every time.
 *
 * ## The test rig never looks
 *
 * The UI gate makes no live call (FB-217): a required gate whose answer depends on a third party's
 * response time teaches people to re-run it. So in the rig every preview is `not-checked`, which
 * renders no link. That is also the honest answer: nothing was checked.
 */

const MAX_HOPS = 5;
const HOP_TIMEOUT_MS = 4_000;
const REMEMBER_MS = 5 * 60_000;
/** Enough for every open piece of work on a venture; the oldest is forgotten first. */
const REMEMBER_AT_MOST = 200;

/** What a founder is told when a preview does not open, by why. No addresses, no status codes. */
const WHY: Record<Exclude<Verdict['kind'], 'ok'>, string> = {
  'wrong-host': 'it opens a different site',
  'not-serving': 'it is not answering',
  'never-settles': 'it keeps redirecting',
  unreachable: 'it could not be reached',
};

export type Fetcher = (url: string, init: { redirect: 'manual'; signal: AbortSignal }) => Promise<{ status: number; headers: { get(name: string): string | null } }>;

/** Follow redirects by hand, so the place the link LANDS is what gets judged. */
async function follow(from: string, fetcher: Fetcher): Promise<Hop[]> {
  const hops: Hop[] = [];
  let current = from;
  for (let i = 0; i < MAX_HOPS; i += 1) {
    const res = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(HOP_TIMEOUT_MS) });
    const location = res.headers.get('location');
    hops.push({ url: current, status: res.status, location: location ?? null });
    if (!location) return hops;
    current = new URL(location, current).toString();
  }
  return hops;
}

/** Judge one address. Never throws: a failure to reach it is an answer, not an error. */
export async function checkPreview(url: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<PreviewCheck> {
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('not a web address');
    host = parsed.host;
  } catch {
    return { url, state: 'does-not-open', reason: WHY.unreachable };
  }
  let hops: Hop[] = [];
  try {
    hops = await follow(url, fetcher);
  } catch {
    return { url, state: 'does-not-open', reason: WHY.unreachable };
  }
  const verdict = verdictFor(hops, host);
  return verdict.ok ? { url, state: 'opens' } : { url, state: 'does-not-open', reason: WHY[verdict.kind] };
}

const remembered = new Map<string, { at: number; check: Promise<PreviewCheck> }>();

/**
 * `checkPreview`, remembered for a few minutes, and skipped in the test rig.
 *
 * Remembers the promise rather than the answer, so two parts of one page asking at once share one
 * check.
 */
export function checkedPreview(
  url: string,
  env: Record<string, string | undefined> = process.env,
  now: number = Date.now(),
): Promise<PreviewCheck> {
  if (env.E2E_TEST_LOGIN === '1' && env.PRS_FIXTURE_DIR) return Promise.resolve({ url, state: 'not-checked' });
  const hit = remembered.get(url);
  if (hit && now - hit.at < REMEMBER_MS) return hit.check;
  const check = checkPreview(url);
  remembered.set(url, { at: now, check });
  if (remembered.size > REMEMBER_AT_MOST) remembered.delete(remembered.keys().next().value as string);
  return check;
}
