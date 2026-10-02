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

/**
 * The hosts a preview can live on. Matched against the PARSED hostname, start to end — never by
 * searching the address as text. A text search let `http://169.254.169.254/?a.up.railway.app`
 * through, and the studio's own server would have opened an internal address of someone's choosing
 * (FB-184 review). Anyone who can post a commit status on a venture repo chooses this address.
 */
const PREVIEW_HOST = /^[a-z0-9][a-z0-9-]*\.(?:up\.railway\.app|vercel\.app|netlify\.app|pages\.dev)$/i;

/** An https address on a preview host, on the default port. The only kind the studio will open. */
export function isPreviewAddress(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.port === '' && !u.username && !u.password && PREVIEW_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

const NOT_A_PREVIEW = 'it is not a preview address the studio can check';

export type Fetcher = (url: string, init: { redirect: 'manual'; signal: AbortSignal }) => Promise<{ status: number; headers: { get(name: string): string | null } }>;

/** Follow redirects by hand, so the place the link LANDS is what gets judged. */
async function follow(from: string, fetcher: Fetcher): Promise<Hop[]> {
  const hops: Hop[] = [];
  const home = new URL(from).host;
  let current = from;
  for (let i = 0; i < MAX_HOPS; i += 1) {
    const res = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(HOP_TIMEOUT_MS) });
    const location = res.headers.get('location');
    hops.push({ url: current, status: res.status, location: location ?? null });
    if (!location) return hops;
    current = new URL(location, current).toString();
    // A redirect off the preview's own host is already the answer ("opens a different site"), and
    // following it would let a preview send the studio's server anywhere. Record where it pointed,
    // and stop without opening it.
    if (new URL(current).host !== home) {
      hops.push({ url: current, status: 0, location: null });
      return hops;
    }
  }
  return hops;
}

/** Judge one address. Never throws: a failure to reach it is an answer, not an error. */
export async function checkPreview(url: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<PreviewCheck> {
  if (!isPreviewAddress(url)) return { url, state: 'does-not-open', reason: NOT_A_PREVIEW };
  const host = new URL(url).host;
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
