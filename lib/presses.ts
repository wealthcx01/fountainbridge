/**
 * Presses on the factory's cards (FB-276): what they are, and who may make which.
 *
 * Pure: no reads, no clock. The store keeps them (`lib/press-store.ts`, `db/009_factory_presses.sql`);
 * the studio's side of a press is `lib/press.ts`; the box's side is the door (`lib/factory-door.ts`).
 */

/** Every press, as the box and the database name them. */
export const PRESS_ACTIONS = ['stop', 'send-back', 'accept', 'approve', 'reject', 'try-again', 'split'] as const;
export type PressAction = (typeof PRESS_ACTIONS)[number];

export const isPressAction = (v: unknown): v is PressAction => (PRESS_ACTIONS as readonly unknown[]).includes(v);

/**
 * What a founder may press on their own venture's cards (PRD, "Who may press what"). John may press
 * everything, and his Accept is his Approve.
 */
export const FOUNDER_ACTIONS: readonly PressAction[] = ['stop', 'send-back', 'accept'];

export function mayPress(action: PressAction, isJohn: boolean): boolean {
  return isJohn ? action !== 'accept' : FOUNDER_ACTIONS.includes(action);
}

/** Every press but a sign-off settles the card: nothing more can be pressed on that version. */
export const settles = (action: PressAction) => action !== 'accept';

/** What the box said happened. */
export const OUTCOMES = ['done', 'out-of-date', 'refused'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const isOutcome = (v: unknown): v is Outcome => (OUTCOMES as readonly unknown[]).includes(v);

export interface BoxAnswer {
  outcome: Outcome;
  message: string;
  at: string;
}

/** One press, as the store keeps it. */
export interface StoredPress {
  id: string;
  ventureId: string;
  repo: string;
  number: number;
  action: PressAction;
  /** The address the presser signed in with. For a tap on Telegram, John's. */
  by: string;
  byJohn: boolean;
  source: 'studio' | 'telegram';
  note: string;
  /** The version of the work they were shown. */
  seenHeadSha: string;
  pressedAt: string;
  collectedAt: string | null;
  answer: BoxAnswer | null;
}

/** A press the studio is about to record. Who pressed, and whether they are John, are the server's. */
export interface NewPress {
  repo: string;
  number: number;
  action: PressAction;
  by: string;
  byJohn: boolean;
  note: string;
  /** The version of the work the page showed, when it said. Must still be the card's. */
  seenHeadSha: string | null;
}

/**
 * What the store did with a press.
 *
 *   - `recorded`: kept, for the box to collect.
 *   - `no-card`: there is no such card for this venture.
 *   - `out-of-date`: a press already stands on this version of the card. The first press wins.
 *   - `changed`: the card is about a newer version of the work than the page showed.
 *   - `already-signed-off`: this founder has signed this version off already.
 */
export type PressKept = 'recorded' | 'no-card' | 'out-of-date' | 'changed' | 'already-signed-off';

/** A tap on Telegram, as the box reports it. */
export interface TelegramPress {
  repo: string;
  number: number;
  action: PressAction;
  at: string;
  /** John's address: Telegram is John's. */
  by: string;
  outcome: Outcome;
  message: string;
}

/**
 * A press that still stands: it settles the card, and the box has not said it did nothing. While one
 * stands, every other settling press on that version of the card is out of date.
 */
export function stands(p: Pick<StoredPress, 'action' | 'answer'>): boolean {
  return settles(p.action) && (p.answer === null || p.answer.outcome === 'done');
}

/** The most the box collects at once, of presses and of sign-offs each, so an answer stays small. */
export const COLLECT_LIMIT = 20;
