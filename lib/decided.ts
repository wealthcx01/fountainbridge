import { DECIDED_EVENT, PUSH_KEYS } from './push-offer';

/**
 * Mark that the founder has just decided something on this device (FB-141).
 *
 * The studio asks for permission to buzz a phone only after a founder has decided something — see
 * `lib/push-offer.ts`. Every place a founder approves or refuses passes its result through here:
 * accepting or sending back work, approving or refusing a send. Only a decision that went through
 * counts; a refused click is not a decision.
 *
 * Returns the result unchanged, so a call site reads `noteDecision(await acceptWork(...))`.
 * `lib/__tests__/push-offer.test.ts` fails if a decision call site skips it.
 */
export function noteDecision<R extends { ok: boolean }>(result: R): R {
  if (!result.ok || typeof window === 'undefined') return result;
  try {
    window.localStorage.setItem(PUSH_KEYS.decided, '1');
  } catch {
    /* a private window: the offer simply waits for a device that remembers */
  }
  window.dispatchEvent(new Event(DECIDED_EVENT));
  return result;
}
