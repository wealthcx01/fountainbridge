import { appendFileSync, readFileSync } from 'node:fs';
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
 * nothing here runs. The card store (FB-275) and the box's listener (FB-276) replace it for real
 * presses.
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
  decision: 'signed-off' | 'approved' | 'sent-back';
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

/** Every press on one piece of work, oldest first. A missing file is no presses yet. */
export function pressesFor(file: string, repo: string, number: number): PressLine[] {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out: PressLine[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    try {
      const line = JSON.parse(raw) as PressLine;
      if (line.repo === repo && line.number === number) out.push(line);
    } catch {
      // A torn last line from a copy that was killed mid-write. The others still count.
    }
  }
  return out;
}
