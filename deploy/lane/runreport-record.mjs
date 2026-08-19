/**
 * Build the RunReport record the lane writes to the state ref (FB-060).
 *
 *   node runreport-record.mjs <slug> <status> <summary> <pr_url> <started> <repo> <lane> <trigger>
 *
 * A file rather than a `node -e '…'` inside `foundry-lib.sh`, for three reasons: shellcheck cannot
 * usefully read an embedded program (and silencing it there is a fight with the wrong tool), the
 * shape is worth testing directly instead of by scraping it back out of a shell script, and it
 * matches every other seam on this box — `prp-check.mjs`, `proposal-check.mjs`, `handoff-check.mjs`.
 *
 * ## Two shapes, on purpose
 *
 * It emits the bcap-contracts fields **alongside** the lane's original vocabulary, not instead of
 * it. The studio's reader has accepted both since FB-042 — reader first, deliberately — so this can
 * change on the box without a flag day, and the legacy fields keep every report already on the ref
 * readable. Dropping them is a separate decision, once those have aged out.
 */

/**
 * The lane states a STATUS; the contract states an OUTCOME.
 *
 * The same mapping the studio applies (`OUTCOME_OF_STATUS` in lib/runreports.ts). The two must not
 * disagree about what a word means, which is what the test on the studio side is for.
 */
const OUTCOME_OF_STATUS = {
  idle: 'no-useful-work',
  opened_pr: 'opened-pr',
  blocked: 'blocked',
  awaiting_founder: 'awaiting-approval',
  failed: 'error',
  progress: 'progress',
};

/** Outcomes that owe the founder a reason rather than just a status word. */
const OWES_A_REASON = new Set(['blocked', 'error']);

export function buildRecord({ slug, status, summary, prUrl, started, repo, lane, trigger, now }) {
  // `working` means in flight. The contract's invariant is that `ended_at` and `outcome` travel
  // together, so a run that has not finished states neither — half of that fact renders as
  // something untrue, which is the failure this whole surface exists to prevent.
  const inFlight = status === 'working';

  // A status the studio does not recognise becomes `blocked`, never nothing. A lane that grows a new
  // state must show up as "something happened I cannot explain", not vanish from the founder's view.
  const outcome = inFlight ? null : (OUTCOME_OF_STATUS[status] ?? 'blocked');

  return {
    // The contract (bcap-contracts RunReport).
    lane_id: lane,
    started_at: started,
    ended_at: inFlight ? null : now,
    trigger,
    outcome,
    summary_md: summary,
    tickets_touched: slug && slug !== 'heartbeat' ? [slug] : [],
    error_detail: outcome && OWES_A_REASON.has(outcome) ? summary || null : null,
    pr_url: prUrl || null,

    // The lane's own vocabulary, kept so a report written today still reads on anything that has
    // not learned the contract shape. Removed once nothing depends on it.
    ticket: slug,
    lane,
    status,
    summary,
    started,
    finished: inFlight ? undefined : now,
    repo,
  };
}

// Only run when invoked directly, so the tests can import `buildRecord` without printing anything.
if (process.argv[1] && process.argv[1].endsWith('runreport-record.mjs')) {
  const [slug, status, summary, prUrl, started, repo, lane, trigger] = process.argv.slice(2);
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  process.stdout.write(
    JSON.stringify(
      buildRecord({ slug, status, summary, prUrl, started, repo, lane, trigger: trigger || 'scheduled', now }),
      null,
      2,
    ),
  );
}
