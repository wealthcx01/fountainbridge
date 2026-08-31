/**
 * Where the studio spends its time (FB-151).
 *
 * ## Why this exists
 *
 * FB-128 made the venture page faster and missed its target, because the page was never the slow
 * part. FB-151 was then written on the theory that the rail was — every screen under a venture
 * renders it, and a static handbook page cost five seconds. That theory was also wrong. Measured on
 * production, the SAME route costs 196 ms signed out and 5,354 ms signed in, and `/login` — which
 * has no rail at all — is one of the slow ones.
 *
 * Twice now the studio has been optimised by reasoning about which code looked expensive. So this
 * is the boring thing: a timer, a ring buffer, and an admin screen that prints the numbers. The
 * answer to "what is slow" should be a reading, not an argument.
 *
 * ## What it costs
 *
 * Two `performance.now()` calls and a push onto a bounded array per timed step. It is on the hot
 * path deliberately — a measurement that only runs when someone goes looking measures a cold cache
 * and a quiet box, which is not the thing anybody is complaining about.
 *
 * ## What it is not
 *
 * Not persistence, and not a metrics pipeline. The ring lives in one server process; a deployment
 * or a second replica starts empty, which the admin screen says out loud rather than presenting a
 * partial picture as the whole one.
 */

/** One measured step. `detail` carries the venture or route it was measured on, when there is one. */
export interface TimedStep {
  name: string;
  ms: number;
  /** Epoch millis, so the screen can say how old the reading is. */
  at: number;
  detail?: string;
}

/**
 * How many readings to keep.
 *
 * Bounded because this is in memory on the server: a studio under load must not accumulate a
 * measurement for every request it has ever served. Two hundred is a few minutes of real use, which
 * is the window anybody is actually asking about.
 */
export const RING_SIZE = 200;

const ring: TimedStep[] = [];

/** Record a reading, oldest dropped first. Exported for callers that time something themselves. */
export function record(step: TimedStep): void {
  ring.push(step);
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
}

/**
 * Time an async step, recording it whatever happens.
 *
 * `finally` rather than after the await: a read that fails is a reading too, and often the
 * interesting one — a five-second failure and a five-second success look identical from outside and
 * mean completely different things.
 */
export async function timed<T>(name: string, fn: () => Promise<T>, detail?: string): Promise<T> {
  const started = performance.now();
  try {
    return await fn();
  } finally {
    record({ name, ms: Math.round(performance.now() - started), at: Date.now(), detail });
  }
}

/** Newest first — the order somebody debugging reads them in. */
export function recentSteps(): TimedStep[] {
  return [...ring].reverse();
}

/** Test seam: the ring is process-global, so a test that fills it must be able to empty it. */
export function clearSteps(): void {
  ring.length = 0;
}

export interface StepSummary {
  name: string;
  count: number;
  /** The middle reading. Resistant to the one cold start that would drag a mean everywhere. */
  medianMs: number;
  slowestMs: number;
  /** The most recent reading's age in millis, so a stale row can be read as stale. */
  newestAt: number;
}

/**
 * One row per step, slowest median first.
 *
 * Median rather than mean, and slowest kept beside it: the mean of one 30-second cold start and
 * nine 200 ms reads is 3 seconds, which describes none of the ten. The pair says both things.
 */
export function summarise(steps: readonly TimedStep[]): StepSummary[] {
  const byName = new Map<string, TimedStep[]>();
  for (const step of steps) {
    const list = byName.get(step.name);
    if (list) list.push(step);
    else byName.set(step.name, [step]);
  }
  return [...byName.entries()]
    .map(([name, list]) => {
      const sorted = [...list].map((s) => s.ms).sort((a, b) => a - b);
      return {
        name,
        count: list.length,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        slowestMs: sorted[sorted.length - 1],
        newestAt: Math.max(...list.map((s) => s.at)),
      };
    })
    .sort((a, b) => b.medianMs - a.medianMs || a.name.localeCompare(b.name));
}
