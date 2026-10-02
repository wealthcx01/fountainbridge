import { shouldNotify, pushMessage, pushDestination } from './push';
import { forgetPhone, observeQueue, phones, type Querier } from './push-store';
import { sendWebPush, type Poster, type VapidKeys } from './webpush';

/**
 * The only place in the studio that sends a push (FB-141).
 *
 * "Nothing else pushes" is a rule that erodes one well-meant addition at a time, so it is held two
 * ways. This function takes a COUNT, not a message: there is no parameter through which a caller
 * could send anything other than "you are the blocker". And `lib/__tests__/push-send.test.ts` fails
 * if `sendWebPush` is ever called from any other file.
 */
export interface QueueCheck {
  /** What was waiting last time, or null for a first look. */
  before: number | null;
  /** What is waiting now, or null when it could not be read — then nothing is recorded or sent. */
  now: number | null;
  sent: number;
  /** Phones that had unsubscribed themselves, removed so they are not tried again. */
  removed: number;
  failed: number;
}

/**
 * Look at one venture's queue, remember it, and buzz this venture's phones if the founder has just
 * become the blocker.
 *
 * `q` must already be scoped to this venture (`withVenture`). The phones it reads are therefore only
 * this venture's phones — a push for ARCA cannot reach a phone that only subscribed to The Reset.
 *
 * An unreadable queue is NOT zero. Recording it as zero would turn the next good read into a
 * "zero to something" transition, and the founder would be buzzed about work that had been waiting
 * all along, because GitHub hiccupped.
 */
export async function checkQueue(
  q: Querier,
  venture: { id: string; name: string },
  waiting: number | null,
  keys: VapidKeys,
  opts: { post?: Poster } = {},
): Promise<QueueCheck> {
  if (waiting === null) return { before: null, now: null, sent: 0, removed: 0, failed: 0 };

  const before = await observeQueue(q, waiting);
  const out: QueueCheck = { before, now: waiting, sent: 0, removed: 0, failed: 0 };
  if (!shouldNotify({ before, now: waiting })) return out;

  const message = { ...pushMessage(venture.name, waiting), url: pushDestination(venture.id), tag: `blocker-${venture.id}` };
  for (const phone of await phones(q)) {
    const r = await sendWebPush(phone, message, keys, { post: opts.post });
    if (r === 'sent') out.sent += 1;
    else if (r === 'gone') { await forgetPhone(q, phone.endpoint); out.removed += 1; }
    else out.failed += 1;
  }
  return out;
}
