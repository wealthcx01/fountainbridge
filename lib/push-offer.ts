/**
 * When the studio asks a founder's phone for permission to buzz it, and what it says (FB-141).
 *
 * ## The rule
 *
 * Ask **after a founder has decided something**, never on first load. On first load a permission
 * prompt reads as a website being pushy, and a "no" there is close to permanent: the browser stops
 * offering the prompt at all. After a founder has just approved or refused something, the question
 * "do you want to know the next time something needs you?" answers itself.
 *
 * ## iPhones have a gate
 *
 * Safari on an iPhone will not let a web page ask for notifications at all until the studio has been
 * **added to the Home Screen** and opened from there. So on an iPhone in a browser tab the studio
 * does not ask — it says how to install first. Asking there would spend the founder's one "yes" on a
 * prompt the phone cannot honour.
 *
 * ## Turning it off sticks
 *
 * "Not now" and "Turn it off" are both one press, and both are remembered on this device. The studio
 * never asks again on a device where the founder has said no. They can still turn it back on from the
 * Tickets screen's "Needs you" list, which is where every buzz lands.
 *
 * This file is pure so the rule can be tested without a browser.
 */

export interface PushOfferInput {
  /** The browser has a service worker, the Push API and notifications. */
  supported: boolean;
  /** The studio has a public key to subscribe with. Without one nothing could ever be sent. */
  keyConfigured: boolean;
  /** `Notification.permission`. */
  permission: 'default' | 'granted' | 'denied';
  /** This device has a live subscription for this venture. */
  subscribed: boolean;
  /** The founder has approved or refused something on this device. */
  decided: boolean;
  /** The founder pressed "Not now" or "Turn it off" on this device. */
  declined: boolean;
  /** An iPhone or iPad. */
  ios: boolean;
  /** Opened from the Home Screen rather than in a browser tab. */
  standalone: boolean;
  /** The screen the founder is on is where the buzz lands — Tickets, "Needs you". */
  onNeedsYou: boolean;
}

/**
 * - `none` — draw nothing.
 * - `offer` — ask: "Buzz this phone when something new needs you?"
 * - `install-first` — an iPhone in a browser tab: say how to add the studio to the Home Screen.
 * - `on` — this device is subscribed: say so, with one button to turn it off.
 * - `off` — the founder turned it off here: one quiet line to turn it back on. Only where the buzz
 *   would land, so it never follows them round the studio.
 * - `blocked` — the browser has refused permission. Only the browser's own settings can undo that,
 *   so the studio says so once, where the buzz would land, rather than offering a button that
 *   cannot work.
 */
export type PushOffer = 'none' | 'offer' | 'install-first' | 'on' | 'off' | 'blocked';

export function pushOffer(i: PushOfferInput): PushOffer {
  // An iPhone in a browser tab has no Push API at all, so it reads as "unsupported". It is the one
  // unsupported case the founder can fix, so it is decided first.
  if (i.ios && !i.standalone && i.keyConfigured) {
    if (i.declined) return 'none';
    return i.decided ? 'install-first' : 'none';
  }
  if (!i.supported || !i.keyConfigured) return 'none';
  if (i.subscribed && i.permission === 'granted') return i.onNeedsYou ? 'on' : 'none';
  if (i.permission === 'denied') return i.onNeedsYou ? 'blocked' : 'none';
  if (i.declined) return i.onNeedsYou ? 'off' : 'none';
  return i.decided ? 'offer' : 'none';
}

/** The words for each state. One place, so copy-lint and a reviewer read them together. */
export const PUSH_WORDS = {
  offer: {
    title: 'Want a buzz when something needs you?',
    body: 'One notification on this device the moment something new is waiting on you. One at a time, and it never says what the item is.',
    yes: 'Turn on notifications',
    no: 'Not now',
  },
  installFirst: {
    title: 'Want a buzz when something needs you?',
    body: 'An iPhone only allows this once the studio is on your Home Screen. Press Share, then “Add to Home Screen”, and open the studio from there.',
    no: 'Not now',
  },
  on: { body: 'This device gets a notification when something new needs you.', off: 'Turn it off' },
  off: { body: 'This device does not get a notification when something needs you.', on: 'Turn on notifications' },
  blocked: { body: 'This browser has blocked notifications from the studio. To get them, allow them in the browser’s settings.' },
} as const;

/**
 * Remembered on this device. Browser storage is right here and only here: whether THIS phone said no
 * is a fact about this phone, not about the founder's other devices. Every read and write is wrapped,
 * because a private window throws, and a studio that broke on a private window would be a worse fault
 * than forgetting a "Not now".
 */
export const PUSH_KEYS = {
  decided: 'foundry.decided',
  declined: (ventureId: string) => `foundry.push.declined.${ventureId}`,
  /**
   * This device said yes for this venture. A browser holds one subscription for the whole studio, so
   * the subscription alone cannot say which venture it was given to — an admin who can see two
   * ventures may have said yes to one.
   */
  on: (ventureId: string) => `foundry.push.on.${ventureId}`,
} as const;

/** The event a decision raises, so an open screen can offer at once rather than on the next load. */
export const DECIDED_EVENT = 'foundry:decided';
