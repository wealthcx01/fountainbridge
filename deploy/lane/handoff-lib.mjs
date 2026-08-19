/**
 * The implement phase's hand-off to the PR body (FB-060).
 *
 * ## The bug this exists to fix
 *
 * SELL-001, the first real Sell run on ARCA's box, asked the lane to "flag, in the PR description,
 * anything you could not establish from the repos rather than filling it in with a plausible guess".
 * It did exactly that — listed the founder-only facts it could not source, price tiers, competitors,
 * brand voice — and then **its own coverage gate failed**, because `supervisor.sh` built the PR body
 * from `tail -1` of the implement log.
 *
 * One line. The enumeration the ticket asked for could not reach the founder no matter how well the
 * agent did its job. An agent catching a limitation of its own harness is worth acting on.
 *
 * ## Why a file, and not better log parsing
 *
 * Same seam as the PRP and the proposal (`prp-lib.mjs`, `proposal-lib.mjs`): **the model writes a
 * file, bash validates it, the harness decides what happens next.** Scraping stdout makes the PR
 * body a function of how chatty the model felt, which is not a contract. A file is.
 *
 * ## What this deliberately does not do
 *
 * It does not police *content*. Unlike a proposal — which is written by the party being gated, and
 * where a field nobody reads today is a field somebody trusts tomorrow — a hand-off is the agent
 * reporting to a human who is about to read the diff anyway. So the shape is checked, the strings
 * are bounded, and the words are the agent's own.
 */

/** Long enough for a real caveat, short enough that the PR body stays readable. */
export const MAX_ITEM = 500;
export const MAX_ITEMS = 20;
export const MAX_SUMMARY = 500;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** A list of short strings, bounded and cleaned. Anything that is not a string is dropped. */
function list(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v).slice(0, MAX_ITEM))
    .filter((v) => v.length > 0)
    .slice(0, MAX_ITEMS);
}

/**
 * Read the hand-off the implement phase wrote.
 *
 * Returns null only when there is no usable summary — everything else is optional, because a ticket
 * with nothing to caveat is the normal case and must not be treated as a failure.
 */
export function readHandoff(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const summary = str(raw.summary).slice(0, MAX_SUMMARY);
  if (!summary) return null;

  return {
    summary,
    findings: list(raw.findings),
    could_not_establish: list(raw.could_not_establish),
    caveats: list(raw.caveats),
  };
}

/** The one line that goes in the RunReport, where a single sentence is the right shape. */
export const summaryLine = (handoff) => handoff.summary;

const section = (heading, items) =>
  items.length === 0 ? '' : `\n## ${heading}\n${items.map((i) => `- ${i}`).join('\n')}\n`;

/**
 * The part of the PR body that comes from the agent.
 *
 * `could_not_establish` is FIRST and named plainly. It is the thing a founder most needs and the
 * thing a summary is most likely to swallow — the whole reason this ticket exists is that it was
 * being swallowed. Putting it under the findings would repeat the fault more politely.
 */
export function handoffMarkdown(handoff) {
  return [
    handoff.summary,
    section('What the lane could not establish', handoff.could_not_establish),
    section('What it found', handoff.findings),
    section('Worth knowing', handoff.caveats),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
