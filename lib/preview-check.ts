import { readFileSync } from 'node:fs';
import { verdictFor, type Hop, type Verdict } from '../scripts/preview-link-lib.mjs';
import type { PreviewCheck } from './result-link';
import { isDoorAddress, isPreviewAddress } from './preview-address';

// Re-exported: callers and tests have always found these here.
export { isDoorAddress, isPreviewAddress };

/**
 * Open a preview address, or a surface's door, and say whether it really opens (FB-184).
 *
 * The judgement for a preview is `verdictFor` in `scripts/preview-link-lib.mjs`, the same one
 * `check-preview-link.mjs` runs from a terminal. One implementation, so the studio and the script
 * cannot disagree about whether a preview link works. A door is judged a little more loosely: see
 * `doorVerdict` below for why.
 *
 * ## Cost, and why it is bounded
 *
 * Each address costs at most `MAX_HOPS` requests, each cut off at `HOP_TIMEOUT_MS`, and the whole
 * check gives up after `CHECK_DEADLINE_MS`. That last limit matters because the desk and the work
 * page wait for their doors before drawing: a door that does not answer holds the page for at most
 * that long, not for five slow hops in a row. Each answer is remembered for `REMEMBER_MS` per
 * address, so a page viewed again does not open the same address again.
 *
 * Who asks: the ticket a founder has open, the work page, each row of the cross-venture queue that
 * has a preview (streamed, so the list never waits for one), and each surface's door on the desk.
 *
 * ## The test rig never looks
 *
 * The UI gate makes no live call (FB-217): a required gate whose answer depends on a third party's
 * response time teaches people to re-run it. In the rig a check is answered from the file named by
 * `PREVIEW_CHECK_FIXTURE`; an address that file does not list is `not-checked`, which renders no
 * link. Nothing is ever opened.
 */

const MAX_HOPS = 5;
const HOP_TIMEOUT_MS = 4_000;
/** The longest one check may take, all its hops together. */
const CHECK_DEADLINE_MS = 6_000;
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
/** A door is the founder's product, not a preview, so the words never call it one. */
const NOT_A_DOOR = 'it is not a public web address the studio can check';

export type Fetcher = (url: string, init: { redirect: 'manual'; signal: AbortSignal }) => Promise<{ status: number; headers: { get(name: string): string | null } }>;

/** Follow redirects by hand, so the place the link LANDS is what gets judged. */
async function follow(from: string, fetcher: Fetcher, clock: () => number): Promise<Hop[]> {
  const hops: Hop[] = [];
  const home = new URL(from).host;
  const deadline = clock() + CHECK_DEADLINE_MS;
  let current = from;
  for (let i = 0; i < MAX_HOPS; i += 1) {
    const left = deadline - clock();
    // Out of time is "could not be reached": the caller turns this throw into that answer.
    if (left <= 0) throw new Error('the check ran out of time');
    const res = await fetcher(current, { redirect: 'manual', signal: AbortSignal.timeout(Math.min(HOP_TIMEOUT_MS, left)) });
    const location = res.headers.get('location');
    hops.push({ url: current, status: res.status, location: location ?? null });
    if (!location) return hops;
    current = new URL(location, current).toString();
    // A redirect off the starting host is never followed: following it would let an address send
    // the studio's server anywhere. Record where it pointed, and stop without opening it. For a
    // preview that is already the answer ("opens a different site"). For a door it is a sign-in.
    if (new URL(current).host !== home) {
      hops.push({ url: current, status: 0, location: null });
      return hops;
    }
  }
  return hops;
}

/**
 * Whether a surface's door opens. Looser than a preview, on purpose.
 *
 * The preview rule exists to catch one fault: a preview that quietly shows the live site instead of
 * the change. A door IS the live product, so that fault cannot happen to it. What a door often is,
 * is behind a sign-in, and a product behind a sign-in is working. So a door opens when its own
 * server answers with a page, asks for a sign-in (401 or 403), or sends the visitor on to sign in
 * somewhere else (a redirect to another site, which the studio records and does not follow). It does
 * not open when it answers with an error, keeps redirecting, or does not answer at all.
 */
function doorVerdict(hops: Hop[], host: string): Verdict {
  const verdict = verdictFor(hops, host);
  if (verdict.ok) return verdict;
  const last = hops[hops.length - 1];
  const before = hops[hops.length - 2];
  // The door's own server sent the visitor to another site: the hop `follow` recorded and stopped at.
  if (verdict.kind === 'wrong-host' && before && new URL(before.url).host === host) {
    return { ok: true, kind: 'ok', host, status: before.status, reason: 'sends visitors on to sign in.' };
  }
  if (verdict.kind === 'not-serving' && (last.status === 401 || last.status === 403)) {
    return { ok: true, kind: 'ok', host, status: last.status, reason: 'asks visitors to sign in.' };
  }
  return verdict;
}

/** Judge one preview address. Never throws: a failure to reach it is an answer, not an error. */
export async function checkPreview(
  url: string,
  fetcher: Fetcher = fetch as unknown as Fetcher,
  clock: () => number = Date.now,
): Promise<PreviewCheck> {
  if (!isPreviewAddress(url)) return { url, state: 'does-not-open', reason: NOT_A_PREVIEW };
  return checkAddress(url, verdictFor, fetcher, clock);
}

/** Judge a surface's door from the manifest (FB-184). Never throws, like `checkPreview`. */
export async function checkDoor(
  url: string,
  fetcher: Fetcher = fetch as unknown as Fetcher,
  clock: () => number = Date.now,
): Promise<PreviewCheck> {
  if (!isDoorAddress(url)) return { url, state: 'does-not-open', reason: NOT_A_DOOR };
  return checkAddress(url, doorVerdict, fetcher, clock);
}

async function checkAddress(
  url: string,
  judge: (hops: Hop[], host: string) => Verdict,
  fetcher: Fetcher,
  clock: () => number,
): Promise<PreviewCheck> {
  const host = new URL(url).host;
  let hops: Hop[] = [];
  try {
    hops = await follow(url, fetcher, clock);
  } catch {
    return { url, state: 'does-not-open', reason: WHY.unreachable };
  }
  const verdict = judge(hops, host);
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
