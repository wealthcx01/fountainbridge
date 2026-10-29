import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The record of presses in a test copy (FB-274).
 *
 * `harness/END-TO-END.md` says: "In the test copy, each decision and press is also written as one
 * line to a file in its state folder." This is that file. The factory's checker reads it to see that
 * a founder's note was recorded exactly once, and that nothing was approved that should not have been.
 *
 * Only in the test rig: `E2E_TEST_LOGIN=1`, and a state folder named by `FACTORY_RUNTIME_STATE`
 * (the test copy sets it; so does Playwright's own server). Outside the rig there is no file and
 * nothing here runs.
 *
 * Since FB-276 the record that counts is the press store (`db/009_factory_presses.sql`): the card's
 * state is read from it, and the planning box collects from it. This file is written as well, once
 * for each press the store recorded, and is read by nothing in the studio.
 */

/** One press, as one line of the file. */
export interface PressLine {
  at: string;
  venture: string;
  repo: string;
  number: number;
  /** Who pressed: the address they signed in with. */
  by: string;
  /** A founder's Accept is a sign-off. Only John's Accept is an approval. */
  decision: 'signed-off' | 'approved' | 'sent-back' | 'rejected' | 'try-again' | 'split' | 'stopped';
  /** The note that went with it, in full. Empty when there was none. */
  note: string;
  /** The version of the work they were shown, when the screen said. */
  seen: string | null;
}

export const PRESS_FILE = 'presses.jsonl';

/** The file presses go to, or null when this is not a test copy. */
export function pressRecordFile(env: Record<string, string | undefined> = process.env): string | null {
  if (env.E2E_TEST_LOGIN !== '1') return null;
  const state = env.FACTORY_RUNTIME_STATE?.trim();
  return state ? join(state, PRESS_FILE) : null;
}

export function recordPress(file: string, line: PressLine): void {
  appendFileSync(file, `${JSON.stringify(line)}\n`);
}
