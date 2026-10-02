import { readFileSync } from 'node:fs';
import { verdictFor, type Hop, type Verdict } from '../scripts/preview-link-lib.mjs';
import type { PreviewCheck } from './result-link';
import { isDoorAddress, isPreviewAddress } from './preview-address';

// Re-exported: callers and tests have always found these here.
export { isDoorAddress, isPreviewAddress };

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

/** Judge one preview address. Never throws: a failure to reach it is an answer, not an error. */
export function checkPreview(url: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<PreviewCheck> {
  return checkAddress(url, isPreviewAddress, fetcher);
}

/** Judge a surface's door from the manifest, by the same verdict as a preview (FB-184). */
export function checkDoor(url: string, fetcher: Fetcher = fetch as unknown as Fetcher): Promise<PreviewCheck> {
  return checkAddress(url, isDoorAddress, fetcher);
}

async function checkAddress(url: string, allowed: (url: string) => boolean, fetcher: Fetcher): Promise<PreviewCheck> {
  if (!allowed(url)) return { url, state: 'does-not-open', reason: NOT_A_PREVIEW };
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
 * What the test rig says a check found, when it says anything (FB-184).
 *
 * The rig never opens an address (FB-217). Without this, every link it drew was "not checked", so
 * the UI gate could only ever see the no-link half and a link that should appear could vanish
 * unnoticed. `PREVIEW_CHECK_FIXTURE` names a JSON file of address → answer; an address it does not
 * list stays "not checked", which is still the honest answer for it.
 */
function rigAnswer(url: string, env: Record<string, string | undefined>): PreviewCheck {
  const file = env.PREVIEW_CHECK_FIXTURE;
  if (file) {
    try {
      const all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, { state: string; reason?: string }>;
      const a = all[url];
      if (a?.state === 'opens') return { url, state: 'opens' };
      if (a?.state === 'does-not-open') return { url, state: 'does-not-open', reason: a.reason ?? WHY.unreachable };
    } catch {
      // A broken fixture file is a rig fault; "not checked" draws no link, which is the safe side.
    }
  }
  return { url, state: 'not-checked' };
}

const inRig = (env: Record<string, string | undefined>) => env.E2E_TEST_LOGIN === '1' && Boolean(env.PRS_FIXTURE_DIR);

function remember(key: string, now: number, run: () => Promise<PreviewCheck>): Promise<PreviewCheck> {
  const hit = remembered.get(key);
  if (hit && now - hit.at < REMEMBER_MS) return hit.check;
  const check = run();
  remembered.set(key, { at: now, check });
  if (remembered.size > REMEMBER_AT_MOST) remembered.delete(remembered.keys().next().value as string);
  return check;
}

/**
 * `checkPreview`, remembered for a few minutes, and answered from a fixture in the test rig.
 *
 * Remembers the promise rather than the answer, so two parts of one page asking at once share one
 * check.
 */
export function checkedPreview(
  url: string,
  env: Record<string, string | undefined> = process.env,
  now: number = Date.now(),
): Promise<PreviewCheck> {
  if (inRig(env)) return Promise.resolve(rigAnswer(url, env));
  return remember(url, now, () => checkPreview(url));
}

/** `checkDoor`, remembered the same way. A surface's door is opened before it is drawn as a link. */
export function checkedDoor(
  url: string,
  env: Record<string, string | undefined> = process.env,
  now: number = Date.now(),
): Promise<PreviewCheck> {
  if (inRig(env)) return Promise.resolve(rigAnswer(url, env));
  return remember(`door ${url}`, now, () => checkDoor(url));
}
