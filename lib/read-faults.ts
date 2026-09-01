/**
 * Making a read fail on purpose (FB-137).
 *
 * ## Why this exists
 *
 * CLAUDE.md #10 is a promise about the worst moment: a founder blocked at 22:00 must see *why*.
 * Every screen therefore owes two different sentences — **empty** ("there is genuinely nothing") and
 * **degraded** ("we could not read") — and confusing them is the failure the rule exists to prevent.
 * A blank panel that could mean either teaches a founder that empty means broken, and after that they
 * stop believing the full panels too.
 *
 * The problem is that the degraded half only appeared when a code host happened to be having a bad
 * day. It could not be checked in CI, could not be checked by eye, and so it drifted: half the
 * screens had it, half rendered a zero, and nobody could tell which without waiting for an outage.
 *
 * The design's own wireframe has a `degraded` switch for exactly this reason. This is the studio's.
 *
 * ## The gate is the same one that turns the studio into a test rig
 *
 * `E2E_TEST_LOGIN=1` **and** `E2E_FAIL_READS`. Both, deliberately: keying off the fault list alone
 * would mean one stray environment variable could make a founder's real venture render as broken.
 * One well-known flag turns this studio into a rig, and it already exists — the same discipline every
 * fixture source uses (`APPROVALS_FIXTURE_DIR && E2E_TEST_LOGIN`).
 *
 * In production neither is set, and every call here is a set lookup that returns false.
 */

/** The reads that can be failed by name. `all` fails every one of them. */
export const FAULTABLE = [
  'tickets',
  'prs',
  'health',
  'approvals',
  'runreports',
  'knowledge',
  'provenance',
  'routines',
  'work',
  'trail',
] as const;

export type FaultableRead = (typeof FAULTABLE)[number];

/**
 * Parse the fault list.
 *
 * Unknown names are ignored rather than thrown on: this is a diagnostic switch, and a typo in it
 * should leave the studio working rather than take a screen down in a way that looks like the very
 * failure being tested.
 */
export function faultyReads(env: NodeJS.ProcessEnv = process.env): Set<FaultableRead> {
  if (env.E2E_TEST_LOGIN !== '1') return new Set();
  const raw = env.E2E_FAIL_READS;
  if (!raw) return new Set();
  const names = raw.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
  if (names.includes('all')) return new Set(FAULTABLE);
  return new Set(FAULTABLE.filter((f) => names.includes(f)));
}

export function shouldFail(read: FaultableRead, env: NodeJS.ProcessEnv = process.env): boolean {
  return faultyReads(env).has(read);
}

/**
 * The error a faulted read throws.
 *
 * Shaped like the real thing — a message a loader might log, never a founder-facing sentence. The
 * whole point is that the SCREEN writes the founder's words; if this message ever reached a founder
 * that would itself be the defect (a raw error surfaced instead of a translated one).
 */
export function readFault(read: FaultableRead): Error {
  return new Error(`E2E_FAIL_READS: ${read} was failed on purpose`);
}

/** Throw if this read is being failed. One line at the top of a source. */
export function failIfFaulted(read: FaultableRead, env: NodeJS.ProcessEnv = process.env): void {
  if (shouldFail(read, env)) throw readFault(read);
}
