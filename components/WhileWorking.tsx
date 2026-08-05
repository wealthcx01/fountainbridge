'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-read the board while something is actually being worked (FB-098, landed here in FB-083).
 *
 * FB-098 asked for this and did not build it, on purpose: it allowed polling "bounded by FB-083's
 * request-budget discipline", and at the time a board view cost 87 requests warm. A timer on the
 * most expensive page in the studio would have multiplied the exact problem FB-083 existed to fix.
 *
 * FB-083 took a warm board from 87 requests to 21, so it is now affordable — and this is the PR
 * where the budget it has to respect actually exists. The cost is stated rather than hidden: one
 * board render a minute, ~60 an hour, against roughly 260 the budget allows.
 *
 * Three bounds, each closing a way this could quietly become expensive:
 *
 *   - **Only while something is in flight.** A board with nothing being worked does not poll at all,
 *     which is most boards most of the time. The founder watching their ticket is the case this is
 *     for.
 *   - **Only while the tab is visible.** A board left open on a second monitor overnight would
 *     otherwise spend the whole allowance answering a question nobody is asking.
 *   - **It stops when the work does.** The interval is torn down the moment `working` goes false.
 *
 * `router.refresh()` re-runs the server render and reconciles in place — no flash, no scroll jump,
 * and no client-side fetching of its own to keep in step with the server's.
 */
export function WhileWorking({ working, seconds = 60 }: { working: boolean; seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!working) return;
    const tick = () => {
      // Checked at fire time rather than at setup: a tab hidden after the interval started must stop
      // costing, and `visibilitychange` listeners are one more thing to get wrong.
      if (document.visibilityState === 'visible') router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    return () => clearInterval(id);
  }, [working, seconds, router]);

  return null;
}
