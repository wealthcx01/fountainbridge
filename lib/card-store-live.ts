import 'server-only';
import { studioDatabase, withVenture, withoutVenture } from './db';
import { memoryCardStore, sqlCardStore, type CardStore, type Querier } from './card-store';

/**
 * The card store this studio uses (FB-275), or null when it has none.
 *
 *   - **With a database** (`DATABASE_URL`): the database. Production, staging, previews, and every
 *     test copy (`scripts/test-copy.mjs` makes each one its own throwaway database).
 *   - **In the browser tests' own studio**: kept in memory. That studio is the one Playwright starts
 *     for the UI gate, in CI and on the planning box, and it has no database; giving it one would
 *     mean changing CI, which is John's to change. The tests still put every card and picture in
 *     through the real door, signed, so the door, the checks and the screen are all the real ones.
 *     What they do not exercise is the SQL, which `lib/__tests__/card-store.test.ts` runs against
 *     real Postgres, under the studio's own role. Only when `E2E_TEST_LOGIN=1`, like every other
 *     test switch here, and never when there is a database.
 *   - **Otherwise**: none. The door answers that it has nowhere to keep a card, and every Review
 *     address answers "That work isn't here".
 */
export function cardStore(env: Record<string, string | undefined> = process.env): CardStore | null {
  if (studioDatabase(env)) {
    return sqlCardStore({
      asVenture: (id, fn) => withVenture(id, (c) => fn(c as unknown as Querier), env),
      asNobody: (fn) => withoutVenture((c) => fn(c as unknown as Querier), env),
    });
  }
  if (env.E2E_TEST_LOGIN === '1') return rigStore();
  return null;
}

/**
 * One memory store per server process. Kept on the process rather than in this file, because
 * Next.js can load one file twice (once for the door, once for the page), and two copies would each
 * keep their own cards: the door would store a card the page could never find.
 */
const RIG = Symbol.for('foundry-studio.rig-card-store');
function rigStore(): CardStore {
  const g = globalThis as { [RIG]?: CardStore };
  return (g[RIG] ??= memoryCardStore());
}
